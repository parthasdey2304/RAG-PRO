from __future__ import annotations
import asyncio
import io
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pymupdf
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from db import get_db_connection, init_sqlite_sync
from ollama_client import ollama_client
from engines.vector_engine import ingest_document_chunks, query_vector_pipeline
from engines.vectorless_engine import extract_hierarchical_tree, query_vectorless_pipeline
from eval_harness import (
    DEFAULT_GOLDEN_DATASET,
    eval_stream_manager,
    run_evaluation_suite,
)

app = FastAPI(
    title="Local-First RAG & Reranking Studio",
    description="Dual retrieval engines (Standard Vector + FlashRank vs. Vectorless Tree Reasoning) with deterministic IR and RAGAS evaluation",
    version="1.0.0",
)

# Explaino Structura Security Gatekeeper & Origin Lockdown Configuration
RAG_STUDIO_TOKEN = os.getenv("RAG_STUDIO_TOKEN", "rag_sec_7f9b2d8e4c1a5b6f3e0d8c2a9e1b4f7a")
raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "https://rag-pro-delta.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
)
ALLOWED_ORIGINS = [o.strip() for o in raw_origins.split(",") if o.strip()]

# Strict CORS configuration (no wildcard allow_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def gatekeeper_security_middleware(request: Request, call_next):
    # Allow CORS preflight requests
    if request.method == "OPTIONS":
        return await call_next(request)

    # Allow local health checks on loopback
    client_ip = request.client.host if request.client else ""
    if client_ip in ("127.0.0.1", "localhost", "::1") and request.url.path in ("/api/health", "/docs", "/openapi.json"):
        return await call_next(request)

    # Check origin header if present
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if origin:
        if not any(origin.startswith(allowed) for allowed in ALLOWED_ORIGINS):
            return JSONResponse(
                status_code=403,
                content={"detail": "Forbidden: Unauthorized Origin. Access is restricted to https://rag-pro-delta.vercel.app"},
            )

    # Check token gatekeeper
    token = request.headers.get("x-studio-token") or request.query_params.get("token")
    forwarded_host = request.headers.get("x-forwarded-host", "")

    # Accept if request has valid token OR arrives forwarded from our official Vercel domain
    is_valid_token = (token == RAG_STUDIO_TOKEN) if RAG_STUDIO_TOKEN else True
    is_valid_forwarded = (forwarded_host == "rag-pro-delta.vercel.app")

    if not (is_valid_token or is_valid_forwarded):
        return JSONResponse(
            status_code=403,
            content={"detail": "Forbidden: Missing or invalid security token. Direct access is blocked."},
        )

    return await call_next(request)


@app.on_event("startup")
async def startup_event():
    init_sqlite_sync()


# ==========================================
# Pydantic Schemas
# ==========================================

class QueryRequest(BaseModel):
    query: str
    doc_id: Optional[str] = None
    mode: str = Field(
        default="vector_rerank",
        description="Retrieval mode: 'vector_raw' | 'vector_rerank' | 'vectorless'"
    )


class EvalRunRequest(BaseModel):
    run_name: Optional[str] = None
    doc_id: Optional[str] = None
    dataset: Optional[List[Dict[str, Any]]] = None
    modes: Optional[List[str]] = Field(
        default=["vector_raw", "vector_rerank", "vectorless"]
    )


# ==========================================
# Health & Status Endpoints
# ==========================================

@app.get("/api/health")
async def health_check():
    ollama_info = await ollama_client.check_health()
    return {
        "status": "healthy",
        "database": "sqlite_wal_active",
        "lancedb": "active",
        "ollama": ollama_info,
    }


# ==========================================
# Document Endpoints
# ==========================================

@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Ingests PDF, Markdown, or Plain Text document into:
    1. Hierarchical JSON tree (Vectorless RAG) stored in SQLite.
    2. Chunks (512 chars, 64 overlap) embedded via nomic-embed-text in LanceDB & SQLite.
    """
    filename = file.filename or "uploaded_document"
    contents = await file.read()
    
    pages: List[tuple[int, str]] = []
    full_text = ""

    if filename.lower().endswith(".pdf"):
        # Parse PDF using PyMuPDF
        try:
            doc = pymupdf.open(stream=contents, filetype="pdf")
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text()
                if text.strip():
                    pages.append((page_num + 1, text))
            doc.close()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
        full_text = "\n\n".join([p[1] for p in pages])
    else:
        # Markdown or Plain Text
        try:
            full_text = contents.decode("utf-8")
        except UnicodeDecodeError:
            full_text = contents.decode("latin-1", errors="ignore")
        pages = [(1, full_text)]

    if not full_text.strip():
        raise HTTPException(status_code=400, detail="The uploaded document contains no readable text.")

    doc_id = str(uuid.uuid4())[:8]
    created_at = datetime.now(timezone.utc).isoformat()

    # 1. Build Hierarchical JSON Tree for Vectorless RAG
    tree = extract_hierarchical_tree(full_text, filename=filename, pages=pages)
    tree_json_str = json.dumps(tree)

    # Save to SQLite documents table
    db = await get_db_connection()
    try:
        await db.execute(
            "INSERT INTO documents (id, filename, tree_json, created_at) VALUES (?, ?, ?, ?)",
            (doc_id, filename, tree_json_str, created_at)
        )
        await db.commit()
    finally:
        await db.close()

    # 2. Chunk, embed and store in LanceDB and SQLite chunks table
    num_chunks = await ingest_document_chunks(doc_id=doc_id, pages=pages)

    return {
        "status": "success",
        "doc_id": doc_id,
        "filename": filename,
        "num_chunks": num_chunks,
        "num_tree_nodes": len(tree),
        "created_at": created_at,
        "tree_skeleton": [
            {
                "node_id": n["node_id"],
                "title": n["title"],
                "summary": n["summary"],
                "page_range": n["page_range"],
            }
            for n in tree
        ]
    }


@app.get("/api/documents")
async def list_documents():
    """Lists all uploaded documents with chunk count and tree structure."""
    db = await get_db_connection()
    try:
        cursor = await db.execute("""
            SELECT d.id, d.filename, d.tree_json, d.created_at, COUNT(c.id) as chunk_count
            FROM documents d
            LEFT JOIN chunks c ON d.id = c.doc_id
            GROUP BY d.id
            ORDER BY d.created_at DESC
        """)
        rows = await cursor.fetchall()
        docs = []
        for r in rows:
            tree = json.loads(r["tree_json"]) if r["tree_json"] else []
            docs.append({
                "id": r["id"],
                "filename": r["filename"],
                "created_at": r["created_at"],
                "chunk_count": r["chunk_count"],
                "num_nodes": len(tree),
                "tree": tree,
            })
        return {"documents": docs}
    finally:
        await db.close()


@app.get("/api/documents/{doc_id}")
async def get_document(doc_id: str):
    """Retrieves single document details including full JSON tree and chunks."""
    db = await get_db_connection()
    try:
        cursor = await db.execute("SELECT id, filename, tree_json, created_at FROM documents WHERE id = ?", (doc_id,))
        doc_row = await cursor.fetchone()
        if not doc_row:
            raise HTTPException(status_code=404, detail="Document not found")

        cursor_chunks = await db.execute(
            "SELECT id, chunk_index, text, page_num FROM chunks WHERE doc_id = ? ORDER BY chunk_index ASC",
            (doc_id,)
        )
        chunk_rows = await cursor_chunks.fetchall()

        return {
            "id": doc_row["id"],
            "filename": doc_row["filename"],
            "created_at": doc_row["created_at"],
            "tree": json.loads(doc_row["tree_json"]),
            "chunks": [
                {
                    "chunk_id": c["id"],
                    "chunk_index": c["chunk_index"],
                    "text": c["text"],
                    "page_num": c["page_num"],
                }
                for c in chunk_rows
            ]
        }
    finally:
        await db.close()


# ==========================================
# Dual Retrieval Query Endpoint
# ==========================================

@app.post("/api/query")
async def query_pipeline(req: QueryRequest):
    """
    Executes query across requested retrieval pipeline:
    - 'vector_raw': standard vector retrieval Top-4
    - 'vector_rerank': Top-15 candidates -> FlashRank reranker -> Top-4 with rank deltas
    - 'vectorless': hierarchical tree reasoning with structured output node selection
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    mode = req.mode.lower()
    if mode in ["vector_raw", "vector_rerank"]:
        res = await query_vector_pipeline(
            query=req.query,
            doc_id=req.doc_id,
            mode=mode,
        )
        return res
    elif mode == "vectorless":
        if not req.doc_id:
            # If doc_id not provided, find the most recently uploaded document
            db = await get_db_connection()
            try:
                cursor = await db.execute("SELECT id FROM documents ORDER BY created_at DESC LIMIT 1")
                first = await cursor.fetchone()
                if not first:
                    raise HTTPException(status_code=400, detail="No documents uploaded yet to run Vectorless RAG.")
                doc_id = first["id"]
            finally:
                await db.close()
        else:
            doc_id = req.doc_id

        res = await query_vectorless_pipeline(query=req.query, doc_id=doc_id)
        return res
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode '{req.mode}'. Choose from 'vector_raw', 'vector_rerank', 'vectorless'."
        )


# ==========================================
# Evaluation & SSE Endpoints
# ==========================================

@app.post("/api/eval/run")
async def start_evaluation(req: EvalRunRequest):
    """Triggers an async evaluation suite run in the background."""
    run_id = f"eval_{str(uuid.uuid4())[:8]}"
    run_name = req.run_name or f"Benchmark_{datetime.now(timezone.utc).strftime('%b%d_%H%M')}"
    
    # If no doc_id is provided, try to find an available document
    target_doc_id = req.doc_id
    if not target_doc_id:
        db = await get_db_connection()
        try:
            cursor = await db.execute("SELECT id FROM documents ORDER BY created_at DESC LIMIT 1")
            first = await cursor.fetchone()
            if first:
                target_doc_id = first["id"]
        finally:
            await db.close()

    dataset = req.dataset or DEFAULT_GOLDEN_DATASET
    modes = req.modes or ["vector_raw", "vector_rerank", "vectorless"]

    # Launch background task
    asyncio.create_task(
        run_evaluation_suite(
            run_id=run_id,
            run_name=run_name,
            doc_id=target_doc_id,
            dataset=dataset,
            modes=modes,
        )
    )

    return {
        "status": "started",
        "run_id": run_id,
        "run_name": run_name,
        "modes": modes,
        "num_questions": len(dataset),
        "stream_url": f"/api/eval/stream/{run_id}",
    }


@app.get("/api/eval/stream/{run_id}")
async def stream_evaluation(run_id: str):
    """Server-Sent Events (SSE) endpoint providing live evaluation progress."""
    queue = eval_stream_manager.subscribe(run_id)

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Yield initial keep-alive ping
            yield f"event: ping\ndata: {json.dumps({'run_id': run_id, 'time': time.time()})}\n\n"
            
            while True:
                try:
                    data_str = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"event: update\ndata: {data_str}\n\n"
                    
                    parsed = json.loads(data_str)
                    if parsed.get("status") in ["completed", "failed"]:
                        break
                except asyncio.TimeoutError:
                    yield f"event: ping\ndata: {json.dumps({'keepalive': True})}\n\n"
        finally:
            eval_stream_manager.unsubscribe(run_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/api/eval/history")
async def get_eval_history():
    """Fetches historical benchmark runs from SQLite eval_runs."""
    db = await get_db_connection()
    try:
        cursor = await db.execute("""
            SELECT id, run_name, mode, metrics_json, latency_ms, created_at
            FROM eval_runs
            ORDER BY created_at DESC
            LIMIT 50
        """)
        rows = await cursor.fetchall()
        
        runs = []
        for r in rows:
            runs.append({
                "id": r["id"],
                "run_name": r["run_name"],
                "mode": r["mode"],
                "metrics": json.loads(r["metrics_json"]),
                "latency_ms": r["latency_ms"],
                "created_at": r["created_at"],
            })
        return {"history": runs}
    finally:
        await db.close()


@app.get("/api/eval/golden_dataset")
async def get_golden_dataset():
    """Returns the default pre-populated 5-question golden benchmark dataset."""
    return {"dataset": DEFAULT_GOLDEN_DATASET}
