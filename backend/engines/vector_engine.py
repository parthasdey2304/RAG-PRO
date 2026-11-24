from __future__ import annotations
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel
from flashrank import Ranker, RerankRequest

from db import get_db_connection, get_lancedb_table
from ollama_client import ollama_client

CHUNK_SIZE = 512
CHUNK_OVERLAP = 64
TOP_K_RAW = 15
TOP_K_FINAL = 4

# Initialize FlashRank CPU reranker singleton
_ranker: Optional[Ranker] = None


def get_ranker() -> Ranker:
    global _ranker
    if _ranker is None:
        _ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2")
    return _ranker


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Chunk text into segments with overlapping character windows."""
    chunks = []
    text = text.strip()
    if not text:
        return []
    
    start = 0
    text_len = len(text)
    step = max(1, chunk_size - chunk_overlap)
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        # Try to break at a space or newline if not at end
        if end < text_len:
            space_pos = text.rfind(" ", start, end)
            newline_pos = text.rfind("\n", start, end)
            break_pos = max(space_pos, newline_pos)
            if break_pos > start + (chunk_size // 2):
                end = break_pos

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= text_len:
            break
        start += step
        
    return chunks


async def ingest_document_chunks(doc_id: str, pages: List[Tuple[int, str]]) -> int:
    """
    Chunks document pages, embeds them via nomic-embed-text,
    and stores them in LanceDB and SQLite.
    pages is a list of (page_num, page_text).
    """
    lance_table = get_lancedb_table()
    db = await get_db_connection()
    chunk_rows = []
    lance_records = []
    chunk_index = 0

    try:
        for page_num, page_text in pages:
            raw_chunks = chunk_text(page_text)
            for c_text in raw_chunks:
                chunk_id = f"chk_{doc_id}_{chunk_index:04d}"
                vector = await ollama_client.get_embedding(c_text)
                
                chunk_rows.append((chunk_id, doc_id, chunk_index, c_text, page_num))
                lance_records.append({
                    "chunk_id": chunk_id,
                    "doc_id": doc_id,
                    "chunk_index": chunk_index,
                    "page_num": page_num,
                    "text": c_text,
                    "vector": vector,
                })
                chunk_index += 1

        if chunk_rows:
            await db.executemany(
                "INSERT OR REPLACE INTO chunks (id, doc_id, chunk_index, text, page_num) VALUES (?, ?, ?, ?, ?)",
                chunk_rows
            )
            await db.commit()

        if lance_records:
            lance_table.add(lance_records)

        return chunk_index
    finally:
        await db.close()


async def query_vector_pipeline(
    query: str,
    doc_id: Optional[str] = None,
    mode: str = "vector_rerank",  # "vector_raw" or "vector_rerank"
    top_k: int = TOP_K_FINAL,
) -> Dict[str, Any]:
    """
    Executes standard vector retrieval (+ optional FlashRank reranking) + answer generation.
    Returns:
    - answer: str
    - retrieved_chunks: list[dict] with before_rank, after_rank, rank_delta, score
    - raw_candidates: list[dict] (Top-15 initial vector matches)
    - latency breakdown
    """
    t0 = time.perf_counter()
    
    # 1. Embed query
    q_vec = await ollama_client.get_embedding(query)
    
    # 2. Vector search via LanceDB
    t_v0 = time.perf_counter()
    lance_table = get_lancedb_table()
    
    search_builder = lance_table.search(q_vec).metric("cosine")
    if doc_id:
        clean_doc_id = doc_id.replace("'", "")
        search_builder = search_builder.where(f"doc_id = '{clean_doc_id}'")
        
    results_df = search_builder.limit(TOP_K_RAW).to_pandas()
    t_v1 = time.perf_counter()
    vector_search_latency_ms = round((t_v1 - t_v0) * 1000, 2)
    
    # Collect raw candidate chunks with initial 1-indexed rank
    raw_candidates = []
    for idx, row in results_df.iterrows():
        raw_candidates.append({
            "chunk_id": str(row["chunk_id"]),
            "doc_id": str(row["doc_id"]),
            "chunk_index": int(row["chunk_index"]),
            "page_num": int(row["page_num"]),
            "text": str(row["text"]),
            "vector_score": float(1.0 - row["_distance"]) if "_distance" in row else 1.0,
            "before_rank": idx + 1,
        })

    rerank_latency_ms = 0.0
    final_chunks = []

    if mode == "vector_raw" or not raw_candidates:
        # Return Top-k raw candidates without reranking
        for idx, cand in enumerate(raw_candidates[:top_k]):
            item = dict(cand)
            item["after_rank"] = idx + 1
            item["rank_delta"] = 0
            item["rerank_score"] = item["vector_score"]
            final_chunks.append(item)
    else:
        # 3. FlashRank reranking
        t_r0 = time.perf_counter()
        ranker = get_ranker()
        passages = [
            {"id": c["chunk_id"], "text": c["text"], "meta": c}
            for c in raw_candidates
        ]
        
        rerank_req = RerankRequest(query=query, passages=passages)
        rerank_res = ranker.rerank(rerank_req)
        t_r1 = time.perf_counter()
        rerank_latency_ms = round((t_r1 - t_r0) * 1000, 2)

        for after_idx, r_item in enumerate(rerank_res[:top_k]):
            meta = r_item["meta"]
            before_rank = meta["before_rank"]
            after_rank = after_idx + 1
            rank_delta = before_rank - after_rank  # positive means moved up in ranking!
            
            final_chunks.append({
                "chunk_id": meta["chunk_id"],
                "doc_id": meta["doc_id"],
                "chunk_index": meta["chunk_index"],
                "page_num": meta["page_num"],
                "text": meta["text"],
                "vector_score": meta["vector_score"],
                "rerank_score": float(r_item["score"]),
                "before_rank": before_rank,
                "after_rank": after_rank,
                "rank_delta": rank_delta,
            })

    # 4. LLM Generation
    t_l0 = time.perf_counter()
    context_str = "\n\n".join([f"[Chunk {c['chunk_id']} (p.{c['page_num']})]: {c['text']}" for c in final_chunks])
    system_prompt = (
        "You are an accurate, deterministic retrieval assistant. "
        "Answer the question directly and concisely using ONLY the provided context. "
        "If the context does not contain the answer, state that clearly."
    )
    user_prompt = f"Context:\n{context_str}\n\nQuestion: {query}\n\nAnswer:"
    
    answer = await ollama_client.generate(prompt=user_prompt, system=system_prompt)
    t_l1 = time.perf_counter()
    llm_latency_ms = round((t_l1 - t_l0) * 1000, 2)
    
    total_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    
    # Calculate operational token savings
    final_tokens = int(sum(len(c["text"].split()) for c in final_chunks) * 1.3)
    raw_tokens = int(sum(len(c["text"].split()) for c in raw_candidates) * 1.3)
    tokens_saved = max(0, raw_tokens - final_tokens) if mode == "vector_rerank" else 0

    return {
        "mode": mode,
        "query": query,
        "answer": answer,
        "retrieved_chunks": final_chunks,
        "raw_candidates": raw_candidates,
        "context_tokens": final_tokens,
        "tokens_saved": tokens_saved,
        "latency_breakdown": {
            "total_ms": total_latency_ms,
            "vector_search_ms": vector_search_latency_ms,
            "rerank_ms": rerank_latency_ms,
            "llm_ms": llm_latency_ms,
        }
    }
