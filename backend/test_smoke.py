from __future__ import annotations
import asyncio
import os
import sqlite3
from pathlib import Path
from flashrank import Ranker, RerankRequest

from db import DB_PATH, LANCEDB_DIR, get_db_connection, get_lancedb_table, init_sqlite_sync
from ollama_client import deterministic_text_embedding, ollama_client
from engines.vector_engine import chunk_text, get_ranker, query_vector_pipeline
from engines.vectorless_engine import extract_hierarchical_tree
from eval_harness import (
    calculate_avg_rank_delta,
    calculate_hit_rate_at_1,
    calculate_hit_rate_at_k,
    calculate_mrr,
    calculate_ndcg_at_k,
    calculate_noise_sensitivity,
)


def test_sqlite_wal_creation():
    """Verify SQLite database exists and operates in WAL mode with all required tables."""
    init_sqlite_sync(DB_PATH)
    assert DB_PATH.exists(), f"Database file {DB_PATH} was not created."
    
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA journal_mode;")
        mode = cursor.fetchone()[0]
        assert mode.lower() == "wal", f"Expected WAL mode, got {mode}"

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        assert "documents" in tables, "Table 'documents' is missing."
        assert "chunks" in tables, "Table 'chunks' is missing."
        assert "eval_runs" in tables, "Table 'eval_runs' is missing."
        print("[PASS] SQLite WAL mode and tables verified successfully.")
    finally:
        conn.close()


def test_flashrank_reranking():
    """Verify FlashRank local CPU cross-encoder runs and re-orders passages."""
    ranker = get_ranker()
    passages = [
        {"id": "c1", "text": "Apples and oranges are rich in natural vitamins."},
        {"id": "c2", "text": "SQLite WAL mode enables multiple concurrent readers without locking writers."},
        {"id": "c3", "text": "The Eiffel Tower is located in Paris, France."},
    ]
    query = "How does WAL mode in SQLite handle concurrent read operations?"
    req = RerankRequest(query=query, passages=passages)
    results = ranker.rerank(req)

    assert len(results) == 3
    # Top passage should be c2
    assert results[0]["id"] == "c2", f"Expected c2 at rank 1, got {results[0]['id']}"
    print(f"[PASS] FlashRank reranking verified successfully. Top match score: {results[0]['score']}")


def test_ollama_client_connectivity():
    """Verify Ollama client health check and fallback handling."""
    health = asyncio.run(ollama_client.check_health())
    assert "status" in health
    assert "target_gen_model" in health
    assert "target_embed_model" in health
    print(f"[PASS] Ollama connectivity checked. Current status: {health['status']}")

    # Verify deterministic embedding generator fallback
    emb = deterministic_text_embedding("test embedding query text")
    assert len(emb) == 768
    norm = sum(x * x for x in emb) ** 0.5
    assert abs(norm - 1.0) < 1e-4, "Embedding is not properly unit normalized"
    print("[PASS] Deterministic embedding fallback verified.")


def test_hierarchical_tree_extraction():
    """Verify Vectorless RAG section/heading parser generates valid tree nodes."""
    sample_doc = """# Introduction to Vectorless RAG
Vectorless RAG is a deterministic paradigm for navigating structured documents without chunking noise.

## 1.0 Table of Contents Navigation
By maintaining a hierarchical tree of sections, queries can be routed to exact sections using LLM reasoning.

## 2.0 Auditability Benefits
Every retrieved answer can be mapped to a human-readable heading instead of an anonymous chunk ID.
"""
    tree = extract_hierarchical_tree(sample_doc, filename="sample.md")
    assert len(tree) >= 3, f"Expected at least 3 nodes, got {len(tree)}"
    assert tree[0]["node_id"] == "node_01"
    assert "Vectorless" in tree[0]["title"]
    assert len(tree[0]["summary"]) > 0
    print(f"[PASS] Hierarchical tree parser generated {len(tree)} structured nodes.")


def test_deterministic_ir_metrics():
    """Verify zero-LLM IR metric calculations."""
    retrieved = ["c2", "c1", "c3", "c4"]
    expected = ["c2"]
    
    mrr = calculate_mrr(retrieved, expected)
    assert mrr == 1.0, f"Expected MRR 1.0, got {mrr}"

    hit1 = calculate_hit_rate_at_1(retrieved, expected)
    assert hit1 == 1.0

    hit4 = calculate_hit_rate_at_k(retrieved, expected, k=4)
    assert hit4 == 1.0

    ndcg = calculate_ndcg_at_k(retrieved, expected, k=4)
    assert ndcg == 1.0

    # Test buried item
    retrieved_buried = ["c1", "c3", "c2", "c4"]
    mrr_buried = calculate_mrr(retrieved_buried, expected)
    assert mrr_buried == round(1.0 / 3.0, 4)
    print("[PASS] Deterministic IR metrics math verified.")


def test_ragas_compatibility():
    """Verify Ragas compatibility shim, NonLLMContextPrecision, and local LLM factory."""
    from ragas_compat import (
        create_local_ragas_llm,
        NonLLMContextPrecisionWithReference,
        SingleTurnSample,
    )
    llm = create_local_ragas_llm()
    assert llm is not None
    
    metric = NonLLMContextPrecisionWithReference()
    sample = SingleTurnSample(
        user_input="What is WAL mode?",
        reference_contexts=["SQLite WAL mode allows concurrent readers."],
        retrieved_contexts=["SQLite WAL mode allows concurrent readers.", "Other text"]
    )
    score = asyncio.run(metric.single_turn_ascore(sample))
    assert score is not None
    assert score > 0.0
    print(f"[PASS] Ragas compatibility verified cleanly. NonLLM score: {score}")


if __name__ == "__main__":
    print("Running Smoke Tests for Local-First RAG & Reranking Studio...")
    test_sqlite_wal_creation()
    test_flashrank_reranking()
    test_ollama_client_connectivity()
    test_hierarchical_tree_extraction()
    test_deterministic_ir_metrics()
    test_ragas_compatibility()
    print("\nALL SMOKE TESTS PASSED CLEANLY! [OK]")
