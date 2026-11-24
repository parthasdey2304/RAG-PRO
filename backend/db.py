from __future__ import annotations
import os
import json
import sqlite3
import aiosqlite
from pathlib import Path
from typing import Any, Dict, List, Optional
import lancedb
import pyarrow as pa

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "rag_studio.db"
LANCEDB_DIR = BASE_DIR / "lancedb_data"

LANCE_SCHEMA = pa.schema([
    pa.field("chunk_id", pa.string()),
    pa.field("doc_id", pa.string()),
    pa.field("chunk_index", pa.int32()),
    pa.field("page_num", pa.int32()),
    pa.field("text", pa.string()),
    pa.field("vector", pa.list_(pa.float32(), 768)),
])


def init_sqlite_sync(db_path: Path = DB_PATH) -> None:
    """Initialize SQLite database in WAL mode with required tables."""
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                tree_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                text TEXT NOT NULL,
                page_num INTEGER NOT NULL,
                FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS eval_runs (
                id TEXT PRIMARY KEY,
                run_name TEXT NOT NULL,
                mode TEXT NOT NULL,
                metrics_json TEXT NOT NULL,
                latency_ms REAL NOT NULL,
                created_at TEXT NOT NULL
            );
        """)
        conn.commit()
    finally:
        conn.close()


async def get_db_connection():
    """Async context manager connection to SQLite in WAL mode."""
    db = await aiosqlite.connect(DB_PATH)
    await db.execute("PRAGMA journal_mode=WAL;")
    await db.execute("PRAGMA foreign_keys=ON;")
    db.row_factory = aiosqlite.Row
    return db


def get_lancedb_table():
    """Get or create the LanceDB chunks table."""
    LANCEDB_DIR.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(LANCEDB_DIR))
    table_names = db.table_names()
    if "document_chunks" in table_names:
        return db.open_table("document_chunks")
    return db.create_table("document_chunks", schema=LANCE_SCHEMA)


# Initialize DB on module import
init_sqlite_sync()
