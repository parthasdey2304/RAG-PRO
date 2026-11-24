# RAG-PRO: Local-First RAG & Reranking Studio

A local-first dual-engine RAG studio featuring standard vector retrieval with FlashRank cross-encoder reranking vs. vectorless tree-reasoning retrieval, integrated with a deterministic Information Retrieval (IR) and RAGAS evaluation harness.

---

## Architecture Overview

```
                                      ┌─────────────────────────────────────────────────────────────┐
                                      │                      RAG-PRO Studio UI                      │
                                      │  (Vite + React + TypeScript + Tailwind CSS + Stitch System) │
                                      └──────────────┬───────────────────────────────▲──────────────┘
                                                     │ Query / Upload / Benchmarks   │ SSE Stream / JSON
                                                     ▼                               │
                                      ┌──────────────────────────────────────────────┴──────────────┐
                                      │                    FastAPI Backend Engine                   │
                                      │                  (Python + uv + aiosqlite)                  │
                                      └───────┬──────────────────────────────┬──────────────────────┘
                                              │                              │
                     ┌────────────────────────┴────────┐            ┌────────┴────────────────────────┐
                     ▼                                 ▼            ▼                                 ▼
         ┌────────────────────────┐       ┌───────────────────────┐ ┌───────────────────┐    ┌────────────────────┐
         │ Mode A: Vector RAG     │       │ Mode B: Vectorless    │ │ Deterministic IR  │    │ RAGAS Eval Harness │
         │ - LanceDB Vector Store │       │ - Hierarchical AST    │ │ - MRR, nDCG@4     │    │ - ContextPrecision │
         │ - nomic-embed-text     │       │ - SQLite WAL Trees    │ │ - HitRate@1 & 4   │    │ - ContextRecall    │
         │ - FlashRank Reranker   │       │ - qwen2.5:3b Skeleton │ │ - Rank Deltas     │    │ - NoiseSensitivity │
         │   (ms-marco-MiniLM)    │       │ - Zero-noise Content  │ │ - Recall Drop-off │    │ - Faithfulness     │
         └────────────────────────┘       └───────────────────────┘ └───────────────────┘    └────────────────────┘
```

---

## Features

- **Dual Retrieval Engines:**
  - **Vector + Rerank (`vector_rerank`):** Retrieves Top-15 semantic candidates via LanceDB vector search, passing them through CPU-based `FlashRank` (`ms-marco-MiniLM-L-12-v2`) to compress down to Top-4 with before/after rank delta attribution.
  - **Vectorless Tree-Reasoning (`vectorless`):** Indexes documents into a structural AST JSON tree. Passes the lightweight skeleton to `qwen2.5:3b` with structured output to select relevant sections before fetching exact text from SQLite.
- **Deterministic IR & Local RAGAS Evaluation:**
  - Zero-LLM math: MRR, nDCG@4, HitRate@1, HitRate@4, Average Rank Delta, Recall Drop-off Rate.
  - Semantic RAGAS metrics: Context Precision (LLM and ID-based), Context Recall, Noise Sensitivity, Faithfulness, and Answer Relevancy via Ollama `llm_factory(max_workers=2)`.
  - Offline fallback caching for instantaneous local testing without GPU/Ollama stalls.
- **Bespoke Stitch UI (Anti-"AI Slop"):**
  - High-craftsmanship Neo-Brutalist & industrial aesthetic with Inter and JetBrains Mono typography.
  - 5 integrated views: Split-Screen Retrieval Arena, Document & Tree Inspector, RAGAS Eval Lab & Benchmarking, Execution Flamegraphs, and Toast/Ingestion Dialogs.

---

## Getting Started

### Prerequisites

- Python 3.11+ with [`uv`](https://docs.astral.sh/uv/)
- [`bun`](https://bun.sh/) or Node.js (Bun recommended)
- Optional: [Ollama](https://ollama.ai/) with `qwen2.5:3b` and `nomic-embed-text`

### Backend Setup

```bash
cd backend
uv run uvicorn main:app --reload --port 8000
```

Verify backend health and smoke tests:
```bash
uv run python test_smoke.py
uv run python test_integration.py
```

### Frontend Setup

```bash
cd frontend
bun install
bun run dev
```

Visit `http://localhost:5173` to explore the studio.
