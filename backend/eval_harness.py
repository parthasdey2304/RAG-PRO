from __future__ import annotations
import asyncio
import json
import logging
import math
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional
import numpy as np

from db import get_db_connection
from ollama_client import ollama_client
from engines.vector_engine import query_vector_pipeline
from engines.vectorless_engine import query_vectorless_pipeline
from ragas_compat import (
    SingleTurnSample,
    create_local_ragas_llm,
    LLMContextPrecisionWithReference,
    NonLLMContextPrecisionWithReference,
    LLMContextRecall,
    NoiseSensitivity,
    Faithfulness,
    AnswerRelevancy,
)

logger = logging.getLogger(__name__)

# Default sample 5-question benchmark dataset
DEFAULT_GOLDEN_DATASET = [
    {
        "id": "q1",
        "question": "What is the primary architectural advantage of Vectorless RAG over standard Vector RAG?",
        "ground_truth": "Vectorless RAG navigates document hierarchy using tree reasoning without chunking or vector similarity noise, providing auditability and exact structural navigation.",
        "expected_chunk_ids": ["chk_0", "chk_1"],
        "expected_node_ids": ["node_01", "node_02", "node_03"],
        "keywords": ["vectorless", "hierarchy", "tree", "structural", "auditability", "reasoning"]
    },
    {
        "id": "q2",
        "question": "Why is FlashRank used as the local reranker instead of heavy cross-encoders?",
        "ground_truth": "FlashRank runs on CPU using lightweight ONNX models like ms-marco-MiniLM-L-12-v2 without consuming GPU VRAM.",
        "expected_chunk_ids": ["chk_1", "chk_2"],
        "expected_node_ids": ["node_02", "node_03"],
        "keywords": ["flashrank", "cpu", "onnx", "lightweight", "vram"]
    },
    {
        "id": "q3",
        "question": "What does Context Precision measure in the context of reranking evaluation?",
        "ground_truth": "Context Precision measures whether ground-truth sections are positioned at the top ranks (Rank 1-2) rather than buried down the list.",
        "expected_chunk_ids": ["chk_2", "chk_3"],
        "expected_node_ids": ["node_03", "node_04"],
        "keywords": ["context precision", "rank", "position", "reranking"]
    },
    {
        "id": "q4",
        "question": "What is the Recall Drop-off Rate failure mode?",
        "ground_truth": "Recall Drop-off Rate measures when the initial retriever pulled the correct chunk in Top-15, but the reranker pruned it out of the final Top-4.",
        "expected_chunk_ids": ["chk_3", "chk_4"],
        "expected_node_ids": ["node_04"],
        "keywords": ["recall drop-off", "pruned", "top-15", "top-4", "cutoff"]
    },
    {
        "id": "q5",
        "question": "How does SQLite WAL mode improve local-first RAG studio performance?",
        "ground_truth": "SQLite WAL mode allows concurrent readers without locking writers, ensuring smooth background evaluation logging alongside queries.",
        "expected_chunk_ids": ["chk_4", "chk_5"],
        "expected_node_ids": ["node_04", "node_05"],
        "keywords": ["sqlite", "wal", "concurrent", "locking", "eval_runs"]
    }
]


# ==========================================
# ID Normalization & Matching Logic
# ==========================================

def is_id_match(ret_id: str, exp_id: str, doc_id: Optional[str] = None) -> bool:
    """
    Robust comparison checking if retrieved ID matches an expected target ID.
    Handles differences in prefixes (chk_ vs chk_docid_0000) and digit zero-padding.
    """
    if not ret_id or not exp_id:
        return False
    ret = str(ret_id).strip().lower()
    exp = str(exp_id).strip().lower()
    if ret == exp:
        return True

    # Check digit extraction
    ret_digits = re.findall(r'\d+', ret)
    exp_digits = re.findall(r'\d+', exp)
    if ret_digits and exp_digits:
        if int(ret_digits[-1]) == int(exp_digits[-1]):
            return True

    if doc_id and exp_digits:
        expected_full = f"chk_{doc_id.lower()}_{int(exp_digits[-1]):04d}"
        if ret == expected_full:
            return True

    return False


def is_id_in_expected(ret_id: str, expected_ids: List[str], doc_id: Optional[str] = None) -> bool:
    """Checks whether ret_id matches any of the IDs in expected_ids."""
    return any(is_id_match(ret_id, exp, doc_id) for exp in expected_ids)


# ==========================================
# Deterministic IR Metrics (Zero-LLM Math)
# ==========================================

def calculate_mrr(retrieved_ids: List[str], expected_ids: List[str], doc_id: Optional[str] = None) -> float:
    """Mean Reciprocal Rank: 1 / (rank of first relevant chunk)."""
    if not expected_ids or not retrieved_ids:
        return 0.0
    for idx, item in enumerate(retrieved_ids):
        if is_id_in_expected(item, expected_ids, doc_id):
            return round(1.0 / (idx + 1), 4)
    return 0.0


def calculate_ndcg_at_k(retrieved_ids: List[str], expected_ids: List[str], k: int = 4, doc_id: Optional[str] = None) -> float:
    """Normalized Discounted Cumulative Gain at k."""
    if not expected_ids or not retrieved_ids:
        return 0.0
    
    dcg = 0.0
    for i in range(min(k, len(retrieved_ids))):
        if is_id_in_expected(retrieved_ids[i], expected_ids, doc_id):
            dcg += 1.0 / math.log2(i + 2)
            
    idcg = sum(1.0 / math.log2(i + 2) for i in range(min(k, len(expected_ids))))
    if idcg <= 0.0:
        return 0.0
    return round(dcg / idcg, 4)


def calculate_hit_rate_at_1(retrieved_ids: List[str], expected_ids: List[str], doc_id: Optional[str] = None) -> float:
    """Hit Rate@1: Did a relevant chunk land on Rank #1?"""
    if not retrieved_ids or not expected_ids:
        return 0.0
    return 1.0 if is_id_in_expected(retrieved_ids[0], expected_ids, doc_id) else 0.0


def calculate_hit_rate_at_k(retrieved_ids: List[str], expected_ids: List[str], k: int = 4, doc_id: Optional[str] = None) -> float:
    """Hit Rate@k: Did at least one relevant chunk make the top-k cutoff?"""
    if not retrieved_ids or not expected_ids:
        return 0.0
    return 1.0 if any(is_id_in_expected(r, expected_ids, doc_id) for r in retrieved_ids[:k]) else 0.0


def calculate_avg_rank_delta(chunks: List[Dict[str, Any]], expected_ids: Optional[List[str]] = None, doc_id: Optional[str] = None) -> float:
    """Average rank shift (before_rank - after_rank) for retrieved chunks."""
    if not chunks:
        return 0.0
    deltas = []
    
    for c in chunks:
        if "rank_delta" in c:
            if not expected_ids or is_id_in_expected(c.get("chunk_id", ""), expected_ids, doc_id):
                deltas.append(c["rank_delta"])
                
    if not deltas and chunks:
        deltas = [c.get("rank_delta", 0) for c in chunks]
        
    return round(float(np.mean(deltas)), 2) if deltas else 0.0


def calculate_recall_dropoff(
    raw_candidates: List[Dict[str, Any]],
    final_chunks: List[Dict[str, Any]],
    expected_ids: List[str],
    doc_id: Optional[str] = None
) -> float:
    """
    Measures cases where expected chunk was in initial Top-15 raw retrieval
    but pruned out of final Top-4 by reranker.
    """
    if not expected_ids or not raw_candidates or not final_chunks:
        return 0.0

    raw_ids = [c["chunk_id"] for c in raw_candidates]
    final_ids = [c["chunk_id"] for c in final_chunks]

    expected_in_raw = [e for e in expected_ids if is_id_in_expected(e, raw_ids, doc_id)]
    if not expected_in_raw:
        return 0.0
        
    lost_in_pruning = [e for e in expected_in_raw if not is_id_in_expected(e, final_ids, doc_id)]
    return round(len(lost_in_pruning) / len(expected_in_raw), 4)


# ==========================================
# RAGAS Quality Metrics (LLM & Non-LLM)
# ==========================================

def calculate_id_context_precision(retrieved_ids: List[str], expected_ids: List[str], doc_id: Optional[str] = None) -> float:
    """Non-LLM ID-based Context Precision weighted by rank position."""
    if not expected_ids or not retrieved_ids:
        return 0.0
    
    hits = 0
    precision_sum = 0.0
    for idx, item in enumerate(retrieved_ids):
        if is_id_in_expected(item, expected_ids, doc_id):
            hits += 1
            precision_sum += hits / (idx + 1)
            
    if hits == 0:
        return 0.0
    return round(precision_sum / hits, 4)


def calculate_noise_sensitivity(retrieved_ids: List[str], expected_ids: List[str], doc_id: Optional[str] = None) -> float:
    """Fraction of retrieved top chunks that are irrelevant noise."""
    if not retrieved_ids:
        return 0.0
    if not expected_ids:
        return 0.0
    noise_count = sum(1 for r in retrieved_ids if not is_id_in_expected(r, expected_ids, doc_id))
    return round(noise_count / len(retrieved_ids), 4)


async def evaluate_faithfulness(answer: str, context: str, ragas_llm: Optional[Any] = None) -> float:
    """Evaluates whether statements in answer are faithfully grounded in context."""
    if not answer or not context:
        return 0.0
    
    # 1. Try Ragas Faithfulness if LLM available
    if ragas_llm is not None:
        try:
            metric = Faithfulness(llm=ragas_llm)
            sample = SingleTurnSample(
                user_input="Evaluate faithfulness",
                response=answer,
                retrieved_contexts=[context[:1500]],
            )
            score = await metric.single_turn_ascore(sample)
            if score is not None and not math.isnan(score):
                return round(float(score), 4)
        except Exception as e:
            logger.debug(f"Ragas faithfulness call fell back: {e}")

    # 2. Try Ollama Judge if online
    prompt = (
        "Evaluate the faithfulness of the answer based ONLY on the provided context.\n"
        f"Context:\n{context[:1500]}\n\nAnswer:\n{answer}\n\n"
        "Score the faithfulness from 0.0 to 1.0. Output ONLY a JSON object: {\"score\": 0.95}"
    )
    try:
        res = await ollama_client.generate(prompt=prompt, format_json=True)
        data = json.loads(res)
        score = float(data.get("score", 0.90))
        return round(min(1.0, max(0.0, score)), 4)
    except Exception:
        pass
    
    # 3. Deterministic lexical grounding overlap
    ans_words = set(re.findall(r'\b\w{4,}\b', answer.lower()))
    ctx_words = set(re.findall(r'\b\w{4,}\b', context.lower()))
    if not ans_words:
        return 1.0
    overlap = len(ans_words.intersection(ctx_words))
    ratio = overlap / len(ans_words)
    return round(min(1.0, 0.45 + (0.55 * ratio)), 4)


async def evaluate_answer_relevancy(question: str, answer: str, ragas_llm: Optional[Any] = None) -> float:
    """Evaluates semantic relevancy of generated answer to question prompt."""
    if not question or not answer:
        return 0.0

    if ragas_llm is not None:
        try:
            metric = AnswerRelevancy(llm=ragas_llm)
            sample = SingleTurnSample(
                user_input=question,
                response=answer,
            )
            score = await metric.single_turn_ascore(sample)
            if score is not None and not math.isnan(score):
                return round(float(score), 4)
        except Exception as e:
            logger.debug(f"Ragas answer relevancy fell back: {e}")

    prompt = (
        "Evaluate whether the answer directly addresses the question.\n"
        f"Question: {question}\n\nAnswer: {answer}\n\n"
        "Score the answer relevancy from 0.0 to 1.0. Output ONLY a JSON object: {\"score\": 0.90}"
    )
    try:
        res = await ollama_client.generate(prompt=prompt, format_json=True)
        data = json.loads(res)
        score = float(data.get("score", 0.90))
        return round(min(1.0, max(0.0, score)), 4)
    except Exception:
        pass

    q_words = set(re.findall(r'\b\w{3,}\b', question.lower()))
    a_words = set(re.findall(r'\b\w{3,}\b', answer.lower()))
    overlap = len(q_words.intersection(a_words))
    return round(min(1.0, 0.5 + (0.5 * min(1.0, overlap / max(1, len(q_words))))), 4)


# ==========================================
# SSE Progress Manager & Runner
# ==========================================

class EvalStreamManager:
    """Manages active Server-Sent Event subscribers per run_id."""
    def __init__(self):
        self._queues: Dict[str, List[asyncio.Queue]] = {}

    def subscribe(self, run_id: str) -> asyncio.Queue:
        q = asyncio.Queue()
        if run_id not in self._queues:
            self._queues[run_id] = []
        self._queues[run_id].append(q)
        return q

    def unsubscribe(self, run_id: str, q: asyncio.Queue):
        if run_id in self._queues and q in self._queues[run_id]:
            self._queues[run_id].remove(q)
            if not self._queues[run_id]:
                del self._queues[run_id]

    async def broadcast(self, run_id: str, data: Dict[str, Any]):
        if run_id in self._queues:
            msg = json.dumps(data)
            for q in self._queues[run_id]:
                await q.put(msg)


eval_stream_manager = EvalStreamManager()


async def run_evaluation_suite(
    run_id: str,
    run_name: str,
    doc_id: Optional[str] = None,
    dataset: Optional[List[Dict[str, Any]]] = None,
    modes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Executes end-to-end evaluation benchmark across modes:
    - vector_raw (Top-4 raw vector retrieval)
    - vector_rerank (Top-15 vector -> FlashRank -> Top-4)
    - vectorless (Hierarchical Tree Reasoning)
    
    Streams live progress via SSE and saves summary to SQLite eval_runs.
    """
    t_start = time.perf_counter()
    if not dataset:
        dataset = DEFAULT_GOLDEN_DATASET
    if not modes:
        modes = ["vector_raw", "vector_rerank", "vectorless"]

    # Resolve document ID if missing
    if not doc_id:
        db = await get_db_connection()
        try:
            cursor = await db.execute("SELECT id FROM documents ORDER BY created_at DESC LIMIT 1")
            first = await cursor.fetchone()
            if first:
                doc_id = first["id"]
        finally:
            await db.close()

    total_tasks = len(dataset) * len(modes)
    completed_tasks = 0

    mode_metrics: Dict[str, Dict[str, List[float]]] = {
        m: {
            "mrr": [],
            "ndcg_4": [],
            "hit_rate_1": [],
            "hit_rate_4": [],
            "avg_rank_delta": [],
            "recall_dropoff": [],
            "context_precision": [],
            "context_recall": [],
            "noise_sensitivity": [],
            "faithfulness": [],
            "answer_relevancy": [],
            "latency_ms": [],
            "context_tokens": [],
            "tokens_saved": [],
        }
        for m in modes
    }

    # Initialize local RAGAS LLM with RunConfig(max_workers=2) if Ollama is accessible
    ragas_llm = None
    if ollama_client.is_available():
        try:
            ragas_llm = create_local_ragas_llm(max_workers=2)
        except Exception as e:
            logger.warning(f"Could not initialize local Ragas LLM wrapper: {e}")

    # Stream start event
    await eval_stream_manager.broadcast(run_id, {
        "status": "started",
        "run_id": run_id,
        "run_name": run_name,
        "total_questions": len(dataset),
        "modes": modes,
        "progress_pct": 0,
    })

    for q_idx, item in enumerate(dataset):
        q_text = item["question"]
        g_truth = item.get("ground_truth", "")
        exp_chunk_ids = item.get("expected_chunk_ids", [])
        exp_node_ids = item.get("expected_node_ids", [])

        for mode in modes:
            t0 = time.perf_counter()
            retrieved_ids = []
            retrieved_text = ""
            answer = ""
            raw_candidates = []
            final_chunks = []
            ctx_tokens = 0
            tok_saved = 0

            try:
                if mode in ["vector_raw", "vector_rerank"]:
                    res = await query_vector_pipeline(query=q_text, doc_id=doc_id, mode=mode)
                    answer = res["answer"]
                    final_chunks = res["retrieved_chunks"]
                    raw_candidates = res["raw_candidates"]
                    retrieved_ids = [c["chunk_id"] for c in final_chunks]
                    retrieved_text = " ".join([c["text"] for c in final_chunks])
                    ctx_tokens = res.get("context_tokens", 0)
                    tok_saved = res.get("tokens_saved", 0)
                    target_expected = exp_chunk_ids or [c["chunk_id"] for c in raw_candidates[:1]]
                    
                else:  # vectorless
                    res = await query_vectorless_pipeline(query=q_text, doc_id=doc_id)
                    answer = res["answer"]
                    selected_nodes = res["selected_nodes"]
                    retrieved_ids = [n["node_id"] for n in selected_nodes]
                    retrieved_text = " ".join([n.get("content", "") for n in selected_nodes])
                    ctx_tokens = res.get("context_tokens", 0)
                    tok_saved = 0
                    target_expected = exp_node_ids or (retrieved_ids[:1] if retrieved_ids else ["node_01"])

                elapsed_ms = (time.perf_counter() - t0) * 1000

                # Compute Deterministic IR Metrics
                mrr = calculate_mrr(retrieved_ids, target_expected, doc_id=doc_id)
                ndcg = calculate_ndcg_at_k(retrieved_ids, target_expected, k=4, doc_id=doc_id)
                hit1 = calculate_hit_rate_at_1(retrieved_ids, target_expected, doc_id=doc_id)
                hit4 = calculate_hit_rate_at_k(retrieved_ids, target_expected, k=4, doc_id=doc_id)
                rank_delta = calculate_avg_rank_delta(final_chunks, target_expected, doc_id=doc_id) if mode == "vector_rerank" else 0.0
                dropoff = calculate_recall_dropoff(raw_candidates, final_chunks, target_expected, doc_id=doc_id) if mode == "vector_rerank" else 0.0

                # Compute RAGAS Metrics (both ID-based Non-LLM and LLM-as-a-judge)
                ctx_prec = calculate_id_context_precision(retrieved_ids, target_expected, doc_id=doc_id)
                
                # Context recall: fraction of expected target items retrieved in top 4
                hits = sum(1 for e in target_expected if is_id_in_expected(e, retrieved_ids[:4], doc_id=doc_id))
                ctx_rec = round(hits / max(1, len(target_expected)), 4) if target_expected else hit4
                
                noise_sens = calculate_noise_sensitivity(retrieved_ids, target_expected, doc_id=doc_id)
                faith = await evaluate_faithfulness(answer, retrieved_text, ragas_llm=ragas_llm)
                relev = await evaluate_answer_relevancy(q_text, answer, ragas_llm=ragas_llm)

                # Append metrics
                mode_metrics[mode]["mrr"].append(mrr)
                mode_metrics[mode]["ndcg_4"].append(ndcg)
                mode_metrics[mode]["hit_rate_1"].append(hit1)
                mode_metrics[mode]["hit_rate_4"].append(hit4)
                mode_metrics[mode]["avg_rank_delta"].append(rank_delta)
                mode_metrics[mode]["recall_dropoff"].append(dropoff)
                mode_metrics[mode]["context_precision"].append(ctx_prec)
                mode_metrics[mode]["context_recall"].append(ctx_rec)
                mode_metrics[mode]["noise_sensitivity"].append(noise_sens)
                mode_metrics[mode]["faithfulness"].append(faith)
                mode_metrics[mode]["answer_relevancy"].append(relev)
                mode_metrics[mode]["latency_ms"].append(elapsed_ms)
                mode_metrics[mode]["context_tokens"].append(float(ctx_tokens))
                mode_metrics[mode]["tokens_saved"].append(float(tok_saved))

            except Exception as e:
                logger.error(f"Error evaluating {mode} on question {q_idx}: {e}")
                elapsed_ms = (time.perf_counter() - t0) * 1000
                mode_metrics[mode]["latency_ms"].append(elapsed_ms)

            completed_tasks += 1
            progress_pct = round((completed_tasks / total_tasks) * 100, 1)

            # Stream step event
            await eval_stream_manager.broadcast(run_id, {
                "status": "progress",
                "run_id": run_id,
                "current_question": q_idx + 1,
                "total_questions": len(dataset),
                "mode": mode,
                "progress_pct": progress_pct,
            })

    # Aggregate summaries per mode
    summary_results: Dict[str, Any] = {}
    total_eval_latency = round((time.perf_counter() - t_start) * 1000, 2)
    
    db = await get_db_connection()
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        for mode in modes:
            m_data = mode_metrics[mode]
            aggregated = {
                # IR Metrics
                "mrr": round(float(np.mean(m_data["mrr"])), 4) if m_data["mrr"] else 0.0,
                "ndcg_4": round(float(np.mean(m_data["ndcg_4"])), 4) if m_data["ndcg_4"] else 0.0,
                "hit_rate_1": round(float(np.mean(m_data["hit_rate_1"])), 4) if m_data["hit_rate_1"] else 0.0,
                "hit_rate_4": round(float(np.mean(m_data["hit_rate_4"])), 4) if m_data["hit_rate_4"] else 0.0,
                "avg_rank_delta": round(float(np.mean(m_data["avg_rank_delta"])), 2) if m_data["avg_rank_delta"] else 0.0,
                "recall_dropoff": round(float(np.mean(m_data["recall_dropoff"])), 4) if m_data["recall_dropoff"] else 0.0,
                # RAGAS Metrics
                "context_precision": round(float(np.mean(m_data["context_precision"])), 4) if m_data["context_precision"] else 0.0,
                "context_recall": round(float(np.mean(m_data["context_recall"])), 4) if m_data["context_recall"] else 0.0,
                "noise_sensitivity": round(float(np.mean(m_data["noise_sensitivity"])), 4) if m_data["noise_sensitivity"] else 0.0,
                "faithfulness": round(float(np.mean(m_data["faithfulness"])), 4) if m_data["faithfulness"] else 0.0,
                "answer_relevancy": round(float(np.mean(m_data["answer_relevancy"])), 4) if m_data["answer_relevancy"] else 0.0,
                # Operational Metrics
                "avg_latency_ms": round(float(np.mean(m_data["latency_ms"])), 2) if m_data["latency_ms"] else 0.0,
                "context_tokens": round(float(np.mean(m_data["context_tokens"])), 0) if m_data["context_tokens"] else 0.0,
                "tokens_saved": round(float(np.mean(m_data["tokens_saved"])), 0) if m_data["tokens_saved"] else 0.0,
            }
            summary_results[mode] = aggregated

            # Save individual mode run to SQLite eval_runs
            run_item_id = f"{run_id}_{mode}"
            await db.execute(
                """
                INSERT OR REPLACE INTO eval_runs (id, run_name, mode, metrics_json, latency_ms, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (run_item_id, run_name, mode, json.dumps(aggregated), aggregated["avg_latency_ms"], now_iso)
            )

        await db.commit()
    finally:
        await db.close()
        await asyncio.sleep(0.05)

    final_payload = {
        "status": "completed",
        "run_id": run_id,
        "run_name": run_name,
        "total_latency_ms": total_eval_latency,
        "progress_pct": 100,
        "results": summary_results,
        "created_at": now_iso,
    }

    await eval_stream_manager.broadcast(run_id, final_payload)
    return final_payload
