from __future__ import annotations
import asyncio
import io
import json
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_e2e_flow():
    print("\n--- 1. Testing GET /api/health ---")
    res_health = client.get("/api/health")
    assert res_health.status_code == 200, res_health.text
    health_data = res_health.json()
    assert health_data["status"] == "healthy"
    assert health_data["database"] == "sqlite_wal_active"
    print("[PASS] Health endpoint returned:", health_data)

    print("\n--- 2. Testing POST /api/documents/upload ---")
    sample_content = b"""# Distributed RAG Architecture
Local systems combine embedding vector stores with reasoning trees.

## Section 1: Vector Search
Vectors identify candidate passages using cosine similarity.

## Section 2: FlashRank Reranker
Lightweight cross-encoders re-score candidates without requiring GPU VRAM.

## Section 3: Vectorless Reasoning
Tree structures route queries directly using section titles and summaries.
"""
    files = {"file": ("test_doc.md", io.BytesIO(sample_content), "text/markdown")}
    res_upload = client.post("/api/documents/upload", files=files)
    assert res_upload.status_code == 200, res_upload.text
    upload_data = res_upload.json()
    assert "doc_id" in upload_data
    doc_id = upload_data["doc_id"]
    assert upload_data["num_chunks"] > 0
    assert upload_data["num_tree_nodes"] >= 3
    print(f"[PASS] Document uploaded successfully. ID: {doc_id}, Chunks: {upload_data['num_chunks']}, Nodes: {upload_data['num_tree_nodes']}")

    print("\n--- 3. Testing GET /api/documents ---")
    res_docs = client.get("/api/documents")
    assert res_docs.status_code == 200
    docs_list = res_docs.json()["documents"]
    assert len(docs_list) > 0
    print(f"[PASS] Documents list returned {len(docs_list)} documents.")

    print("\n--- 4. Testing POST /api/query (vector_raw) ---")
    res_raw = client.post("/api/query", json={
        "query": "What does vector search use for similarity?",
        "doc_id": doc_id,
        "mode": "vector_raw",
    })
    assert res_raw.status_code == 200, res_raw.text
    raw_data = res_raw.json()
    assert len(raw_data["retrieved_chunks"]) > 0
    print("[PASS] Vector Raw query succeeded. Latency:", raw_data["latency_breakdown"])

    print("\n--- 5. Testing POST /api/query (vector_rerank) ---")
    res_rerank = client.post("/api/query", json={
        "query": "Why use FlashRank instead of heavy cross-encoders?",
        "doc_id": doc_id,
        "mode": "vector_rerank",
    })
    assert res_rerank.status_code == 200, res_rerank.text
    rerank_data = res_rerank.json()
    assert len(rerank_data["retrieved_chunks"]) > 0
    top_chunk = rerank_data["retrieved_chunks"][0]
    assert "rank_delta" in top_chunk
    assert "rerank_score" in top_chunk
    print(f"[PASS] Vector Rerank query succeeded. Top chunk delta: {top_chunk['rank_delta']}, Rerank score: {top_chunk['rerank_score']}")

    print("\n--- 6. Testing POST /api/query (vectorless) ---")
    res_tree = client.post("/api/query", json={
        "query": "How does vectorless reasoning route queries?",
        "doc_id": doc_id,
        "mode": "vectorless",
    })
    assert res_tree.status_code == 200, res_tree.text
    tree_data = res_tree.json()
    assert len(tree_data["selected_nodes"]) > 0
    assert "reasoning_trace" in tree_data
    print(f"[PASS] Vectorless query succeeded. Selected nodes: {[n['node_id'] for n in tree_data['selected_nodes']]}")

    print("\n--- 7. Testing POST /api/eval/run & Direct Suite Execution ---")
    res_eval = client.post("/api/eval/run", json={
        "run_name": "Integration_Test_Run",
        "doc_id": doc_id,
        "dataset": [
            {"id": "q_fast", "question": "What is vector search?", "ground_truth": "Cosine similarity"}
        ],
    })
    assert res_eval.status_code == 200, res_eval.text
    eval_data = res_eval.json()
    assert "run_id" in eval_data
    run_id = eval_data["run_id"]
    print(f"[PASS] Evaluation endpoint accepted request. Run ID: {run_id}")

    # Run evaluation suite with 2 questions to verify end-to-end SQLite persistence
    from eval_harness import run_evaluation_suite, DEFAULT_GOLDEN_DATASET
    eval_suite_res = asyncio.run(
        run_evaluation_suite(
            run_id=f"integ_{run_id}",
            run_name="Integ_Completed_Suite",
            doc_id=doc_id,
            dataset=DEFAULT_GOLDEN_DATASET[:2],
            modes=["vector_raw", "vector_rerank", "vectorless"]
        )
    )
    assert eval_suite_res["status"] == "completed"
    assert "vector_rerank" in eval_suite_res["results"]
    print("[PASS] Evaluation suite executed and returned completed status.")

    print("\n--- 8. Testing GET /api/eval/history ---")
    res_hist = client.get("/api/eval/history")
    assert res_hist.status_code == 200, res_hist.text
    history_list = res_hist.json().get("history", [])
    assert len(history_list) > 0, "Expected historical eval records in SQLite, got 0"
    latest_record = history_list[0]
    assert "metrics" in latest_record
    assert "mrr" in latest_record["metrics"]
    print(f"[PASS] History endpoint returned {len(history_list)} records with valid metrics.")


if __name__ == "__main__":
    test_e2e_flow()
    print("\n==========================================")
    print("ALL INTEGRATION TESTS PASSED 100% CLEANLY!")
    print("==========================================")
