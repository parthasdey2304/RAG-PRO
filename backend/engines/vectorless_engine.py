from __future__ import annotations
import re
import json
import time
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from db import get_db_connection
from ollama_client import ollama_client


class DocumentNode(BaseModel):
    node_id: str
    title: str
    summary: str
    page_range: str
    content: str
    children: List[DocumentNode] = Field(default_factory=list)


class NodeSelection(BaseModel):
    selected_node_ids: List[str] = Field(
        description="List of node_id values of sections containing information to answer the question"
    )
    reasoning_trace: str = Field(
        description="Chain-of-thought explaining why these sections were selected based on titles and summaries"
    )


def extract_hierarchical_tree(text: str, filename: str, pages: Optional[List[Tuple[int, str]]] = None) -> List[Dict[str, Any]]:
    """
    Parses document into a structured hierarchical JSON tree.
    Recognizes Markdown headings (#, ##), numbered sections (1.0, 1.1),
    and PDF page splits.
    """
    nodes: List[Dict[str, Any]] = []
    
    # If pages are provided, check if headings exist per page or across document
    lines = text.splitlines()
    current_node: Optional[Dict[str, Any]] = None
    node_counter = 1
    
    heading_regex = re.compile(r'^(#{1,4}\s+|[0-9]+(\.[0-9]+)*\s+[A-Z]|[A-Z\s]{4,}:?\s*$|Section\s+[0-9]+:?)')

    accumulated_content = []
    current_title = "Document Overview"
    current_page = 1
    
    def finalize_node(title: str, content_lines: List[str], page_num: int):
        nonlocal node_counter
        content = "\n".join(content_lines).strip()
        if not content and not title:
            return None
        
        # Create concise 1-2 sentence summary
        first_few = [l.strip() for l in content_lines if l.strip() and not l.startswith("#")][:3]
        summary_raw = " ".join(first_few)
        summary = summary_raw[:220].strip() + ("..." if len(summary_raw) > 220 else "")
        if not summary:
            summary = f"Contains detailed content regarding {title}."

        node = {
            "node_id": f"node_{node_counter:02d}",
            "title": title,
            "summary": summary,
            "page_range": f"{page_num}",
            "content": content,
            "children": [],
        }
        node_counter += 1
        return node

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if accumulated_content:
                accumulated_content.append("")
            continue
            
        match = heading_regex.match(stripped)
        if match and len(stripped) < 100:
            # New section boundary detected
            if accumulated_content:
                n = finalize_node(current_title, accumulated_content, current_page)
                if n:
                    nodes.append(n)
                accumulated_content = []
                
            clean_title = re.sub(r'^(#{1,4}\s+|[0-9]+(\.[0-9]+)*\s+)', '', stripped).strip()
            current_title = clean_title or f"Section {node_counter}"
        else:
            accumulated_content.append(line)

    # Finalize remaining
    if accumulated_content:
        n = finalize_node(current_title, accumulated_content, current_page)
        if n:
            nodes.append(n)

    # If no headings were found or only 1 node found, segment into 3-6 logical sections
    if len(nodes) <= 1 and len(text) > 200:
        paras = [p.strip() for p in text.split("\n\n") if p.strip()]
        if len(paras) <= 1:
            # Try single newlines or character chunks
            paras = [p.strip() for p in text.split("\n") if len(p.strip()) > 30]
        if len(paras) <= 1:
            # Chunk every 400 characters
            paras = [text[i:i+400].strip() for i in range(0, len(text), 350) if text[i:i+400].strip()]

        nodes = []
        for idx, p in enumerate(paras[:10]):
            first_sentence = p.split(".")[0].strip()
            title = first_sentence[:50] + ("..." if len(first_sentence) > 50 else "")
            nodes.append({
                "node_id": f"node_{idx+1:02d}",
                "title": f"Section {idx+1}: {title}" if title else f"Section {idx+1}",
                "summary": p[:200] + ("..." if len(p) > 200 else ""),
                "page_range": "1",
                "content": p,
                "children": [],
            })

    if not nodes:
        nodes.append({
            "node_id": "node_01",
            "title": "Document Content",
            "summary": text[:200] + "...",
            "page_range": "1",
            "content": text,
            "children": [],
        })

    return nodes


def get_skeleton_tree(tree: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Returns tree without bulky content text, only metadata and summaries."""
    skeleton = []
    for node in tree:
        skeleton.append({
            "node_id": node["node_id"],
            "title": node["title"],
            "summary": node["summary"],
            "page_range": node["page_range"],
        })
    return skeleton


async def query_vectorless_pipeline(
    query: str,
    doc_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes Vectorless (Page-Index / Tree Reasoning) RAG:
    1. Reads lightweight tree skeleton from SQLite.
    2. Sends ONLY skeleton to Ollama qwen2.5:3b to select required node_ids.
    3. Fetches full content of chosen nodes.
    4. Generates final grounded answer.
    """
    t0 = time.perf_counter()
    
    # 1. Fetch document tree from SQLite
    db = await get_db_connection()
    try:
        if not doc_id:
            cursor = await db.execute("SELECT id, filename, tree_json FROM documents ORDER BY created_at DESC LIMIT 1")
            row = await cursor.fetchone()
            if not row:
                raise ValueError("No documents uploaded yet to run Vectorless RAG.")
            doc_id = row["id"]
        else:
            cursor = await db.execute("SELECT id, filename, tree_json FROM documents WHERE id = ?", (doc_id,))
            row = await cursor.fetchone()
            if not row:
                raise ValueError(f"Document with ID {doc_id} not found.")
        tree = json.loads(row["tree_json"])
    finally:
        await db.close()

    skeleton = get_skeleton_tree(tree)
    
    # 2. Reasoning Retrieval via Ollama
    t_r0 = time.perf_counter()
    reasoning_system = (
        "You are an expert document retrieval reasoner. "
        "You are given the structural outline (Table of Contents / Section summaries) of a document. "
        "Your task is to analyze the user's question, determine which section(s) contain the precise facts needed, "
        "and return a JSON object with 'selected_node_ids' (list of matching node_id strings) and 'reasoning_trace'."
    )
    
    reasoning_prompt = (
        f"Document Structure (Headings & Summaries):\n{json.dumps(skeleton, indent=2)}\n\n"
        f"User Question: {query}\n\n"
        "Select the relevant node_ids. Respond in JSON format: "
        '{"selected_node_ids": ["node_XX"], "reasoning_trace": "..."}'
    )
    
    selection_raw = await ollama_client.generate(
        prompt=reasoning_prompt,
        system=reasoning_system,
        format_json=True
    )
    t_r1 = time.perf_counter()
    reasoning_latency_ms = round((t_r1 - t_r0) * 1000, 2)

    # Parse JSON output
    selected_node_ids = []
    reasoning_trace = ""
    try:
        parsed = json.loads(selection_raw)
        selected_node_ids = parsed.get("selected_node_ids", [])
        reasoning_trace = parsed.get("reasoning_trace", "")
    except Exception:
        # Fallback extract node_ids with regex
        selected_node_ids = re.findall(r'node_\d+', selection_raw)
        reasoning_trace = selection_raw

    # Fallback to keyword matching if LLM selected nothing or invalid
    if not selected_node_ids:
        query_words = set(re.findall(r'\w+', query.lower()))
        best_node = None
        best_overlap = -1
        for node in skeleton:
            text_bag = set(re.findall(r'\w+', (node["title"] + " " + node["summary"]).lower()))
            overlap = len(query_words.intersection(text_bag))
            if overlap > best_overlap:
                best_overlap = overlap
                best_node = node["node_id"]
        selected_node_ids = [best_node or (skeleton[0]["node_id"] if skeleton else "node_01")]
        reasoning_trace = "Fallback tree keyword match selected highest overlap section."

    # 3. Full-Context Extraction for selected nodes
    node_map = {n["node_id"]: n for n in tree}
    selected_nodes = []
    for nid in selected_node_ids:
        if nid in node_map:
            selected_nodes.append(node_map[nid])

    # If selected_nodes is empty, take first node
    if not selected_nodes and tree:
        selected_nodes = [tree[0]]

    # 4. Generate final answer
    t_l0 = time.perf_counter()
    context_chunks = [f"=== Section: {n['title']} (Page {n['page_range']}) ===\n{n['content']}" for n in selected_nodes]
    context_text = "\n\n".join(context_chunks)

    system_prompt = (
        "You are an accurate, deterministic retrieval assistant. "
        "Answer the question directly and concisely using ONLY the provided document sections. "
        "Cite the section title when appropriate."
    )
    user_prompt = f"Selected Sections:\n{context_text}\n\nQuestion: {query}\n\nAnswer:"
    answer = await ollama_client.generate(prompt=user_prompt, system=system_prompt)
    t_l1 = time.perf_counter()
    generation_latency_ms = round((t_l1 - t_l0) * 1000, 2)
    
    total_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    estimated_context_tokens = int(sum(len(n.get("content", "").split()) for n in selected_nodes) * 1.3)

    return {
        "mode": "vectorless",
        "query": query,
        "answer": answer,
        "doc_id": doc_id,
        "selected_nodes": [
            {
                "node_id": n["node_id"],
                "title": n["title"],
                "summary": n["summary"],
                "page_range": n["page_range"],
                "content": n["content"],
            }
            for n in selected_nodes
        ],
        "reasoning_trace": reasoning_trace,
        "skeleton_nodes_evaluated": len(skeleton),
        "context_tokens": estimated_context_tokens,
        "tokens_saved": 0,
        "latency_breakdown": {
            "total_ms": total_latency_ms,
            "tree_reasoning_ms": reasoning_latency_ms,
            "llm_ms": generation_latency_ms,
        }
    }
