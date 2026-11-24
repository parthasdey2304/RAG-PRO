# RAG Studio: Local-First Dual Retrieval & Reranking Workbench

A high-density, 100% local-first retrieval engineering studio comparing **Standard Vector + Rerank RAG** (LanceDB + FlashRank) against **Vectorless Tree-Reasoning RAG** (Hierarchical AST + Structured Output) side-by-side. Built with integrated deterministic Information Retrieval (IR) scoring, full RAGAS evaluation, live latency flamegraphs, and a Neo-Brutalist interface.

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Bun + Vite 8)                                   │
│            React 19 • TypeScript 7 • Tailwind CSS v4 • Lucide • Inter / JetBrains Mono │
│                                                                                        │
│  ┌───────────────────────┐ ┌──────────────────────┐ ┌────────────────────────────────┐ │
│  │ Retrieval Arena (Dual)│ │ Document & AST Tree  │ │ RAGAS Eval Lab (14 Metrics)    │ │
│  └───────────┬───────────┘ └──────────┬───────────┘ └───────────────┬────────────────┘ │
└──────────────┼────────────────────────┼─────────────────────────────┼──────────────────┘
               │ Query POST /api/query   │ Upload / Inspect            │ Eval Run & SSE
               ▼                        ▼                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Python 3.14 + uv)                                │
│                   FastAPI • Uvicorn • Pydantic v2 • Asyncio Stream Manager             │
└───────┬────────────────────────────────┬────────────────────────────┬──────────────────┘
        │                                │                            │
        ▼                                ▼                            ▼
┌───────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────────┐
│ Pipeline A: Vector    │  │ Pipeline B: Vectorless  │  │ Evaluation & Metrics Engine    │
│ - LanceDB Table Store │  │ - PyMuPDF Section AST   │  │ - 5 RAGAS Dimensions           │
│ - nomic-embed-text    │  │ - SQLite Hierarchical   │  │   (Faithfulness, Relevancy,    │
│ - Top-15 Candidate Pull│ │   Node Schema           │  │    Precision, Recall, Noise)   │
│ - FlashRank CPU       │  │ - qwen2.5:3b JSON       │  │ - 6 IR Metrics (MRR, nDCG@4,   │
│   Reranker            │  │   Structured Node Traversal│ Hit@1/4, RankShift, DropOff) │
│ - Top-4 Rank Shifts   │  │ - Zero-Embedding Exact  │  │ - System Cost Tracking         │
│   (before_rank-after) │  │   Text Resolution       │  │   (Latency, Tokens Used/Saved) │
└───────┬───────────────┘  └─────────────┬───────────┘  └────────────────┬───────────────┘
        │                                │                               │
        └────────────────────────┬───────┴───────────────────────────────┘
                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                            LOCAL STORAGE & INFERENCE                                   │
│            SQLite (WAL Mode: documents, chunks, eval_runs) • LanceDB Vector Store      │
│                     Ollama Local Daemon (qwen2.5:3b, nomic-embed-text)                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Features (Post-Audit Upgrades)

### Split-Screen Retrieval Arena
- **Simultaneous Dual Pipeline Execution**: A single query bar fires `POST /api/query` in parallel across Vector+Rerank (Left Pane) and Vectorless Tree-Reasoning (Right Pane).
- **FlashRank CPU Cross-Encoder Reranking**: Pulls Top-15 candidates from LanceDB and scores them locally with `ms-marco-MiniLM-L-12-v2`, returning Top-4 results.
- **Live Rank Shift Calculation**: Computes exact rank changes per chunk (`before_rank - after_rank`) and displays real-time delta badges (`Δ Up`, `Δ Down`, `Held`) and average precision shift without fabricated heuristics.
- **Hierarchical Traversal Step Trace**: Displays exact structural tree reasoning paths traversed by the LLM during vectorless node extraction.

### Document Inspector & Telemetry Traces
- **Hierarchical Document AST Visualizer**: Renders document structure (H1/H2/H3/paragraphs/page boundaries) parsed via PyMuPDF into an interactive expandable tree.
- **Zero-Fixture Empty State UX**: Eliminates placeholder static data. If a document has no parsed nodes, clean feedback states are rendered.
- **Live Flamegraph Latency Attribution**: Sub-millisecond stage attribution (Embedding ms, Vector Search ms, FlashRank Rerank ms, LLM Node Selection ms, Text Resolution ms). Initialized cleanly from incoming session traces without duplicate fixtures.

### Evaluation Lab (`EvalLab`)
- **Complete RAGAS Semantic Metrics**:
  - *Faithfulness*
  - *Answer Relevancy*
  - *Context Precision*
  - *Context Recall*
  - *Noise Sensitivity* (distractor resistance)
- **Deterministic Reranker IR Metrics**:
  - *Mean Reciprocal Rank (MRR)*
  - *nDCG@4* (Discounted Cumulative Gain)
  - *HitRate@1* and *HitRate@4*
  - *Average Rank Delta (`AvgRankDelta`)*
  - *Recall Drop-Off Rate*
- **System Cost & Efficiency Tracking**:
  - *End-to-End Execution Latency (ms)*
  - *Context Tokens Used*
  - *Prompt Tokens Saved* (via surgical tree-node extraction vs. raw chunk stuffing)
- **In-Browser Golden Dataset Editor**: Pre-populated via `GET /api/eval/golden_dataset`, allowing live editing and export of benchmark questions.
- **Keyboard Shortcut**: `⌘R` / `Ctrl+R` shortcut triggers the full benchmark suite with dynamic progress toasts derived from live delta calculations.
- **Historical Runs**: Pulls and visualizes previous benchmark executions from `GET /api/eval/history`.

### Neo-Brutalist Design & Responsive Mobile UX
- **Design Tokens**: High-contrast `#FACC15` yellow accents (`studio-btn-primary`, `studio-badge-yellow`), dark slate canvas (`#090d16`), and crisp directional borders (`border-b-4 border-r-4`).
- **Anti-FOUC Theme Switcher**: Head-level script in `index.html` preventing theme flashing on load across Light and Dark themes.
- **Hardware-Accelerated Mobile Drawer**: Responsive layout (`390px+` viewport) with a top-down sliding hamburger drawer (`animate-slide-down` and `animate-slide-up` keyframes) mounted via React `createPortal`.

---

## 3. Tech Stack & Directory Structure

### Stack
- **Backend**: Python 3.14, FastAPI 0.110+, `uv`, SQLite (WAL mode, `aiosqlite`), LanceDB 0.41+, FlashRank 0.2.10+, PyMuPDF, RAGAS, Ollama (`qwen2.5:3b`, `nomic-embed-text`).
- **Frontend**: Bun, React 19, TypeScript 7, Vite 8, Tailwind CSS v4, Lucide Icons.

### Directory Structure
```
RAG-PRO/
├── README.md
├── LICENSE
├── .gitignore
├── backend/
│   ├── pyproject.toml               # Python dependencies and uv build config
│   ├── uv.lock                      # Deterministic lockfile
│   ├── .python-version              # Python version pin (3.14)
│   ├── main.py                      # FastAPI routes, schemas, CORS, and lifecycle
│   ├── db.py                        # SQLite WAL database connection and schema initialization
│   ├── ollama_client.py             # Local Ollama client with fallback mocks
│   ├── eval_harness.py              # IR metrics, RAGAS execution, and SSE stream manager
│   ├── ragas_compat.py              # RAGAS metrics compatibility wrappers
│   ├── test_smoke.py                # Smoke test suite
│   ├── test_integration.py          # End-to-end integration test suite
│   ├── engines/
│   │   ├── __init__.py
│   │   ├── vector_engine.py         # LanceDB ingestion, nomic embeddings, FlashRank reranker
│   │   └── vectorless_engine.py     # PyMuPDF AST parsing, tree traversal, text resolution
│   └── src/
│       └── backend/
│           └── __init__.py
└── frontend/
    ├── package.json                 # Node/Bun dependencies & scripts
    ├── bun.lock                     # Bun lockfile
    ├── tsconfig.json                # TypeScript project configuration
    ├── tsconfig.app.json            # Application TS compiler options
    ├── tsconfig.node.json           # Node/Vite TS options
    ├── vite.config.ts               # Vite configuration with Tailwind CSS v4 plugin
    ├── index.html                   # HTML entry point with anti-FOUC theme script
    ├── public/
    │   ├── favicon.svg
    │   └── icons.svg
    └── src/
        ├── main.tsx                 # React application root
        ├── App.tsx                  # Root state orchestration and tab management
        ├── App.css                  # Component-level layout styles
        ├── index.css                # Tailwind v4 imports, Neo-Brutalist utilities, animations
        ├── types.ts                 # TypeScript interfaces (metrics, traces, documents)
        └── components/
            ├── Header.tsx           # Brand header, model status, theme toggle, mobile drawer
            ├── SplitScreenArena.tsx # Side-by-side retrieval arena with rank-shift badges
            ├── DocumentInspector.tsx# Hierarchical AST explorer and chunk inspector
            ├── EvalLab.tsx          # 14-metric benchmark matrix, golden editor, ⌘R listener
            ├── TelemetryTraces.tsx  # Flamegraph latency viewer and trace filter
            ├── SettingsWorkbench.tsx# Compute thread ceiling and hardware sliders
            ├── IngestModal.tsx      # File drag-and-drop ingestion modal
            ├── NotificationDrawer.tsx# Studio alerts and system notification drawer
            └── ToastStack.tsx       # Neo-Brutalist toast notifications
```

---

## 4. Quickstart Setup

### Prerequisites
- [uv](https://docs.astral.sh/uv/) (Python package & project manager)
- [bun](https://bun.sh/) (JavaScript runtime & package manager)
- [Ollama](https://ollama.ai/) running locally:
  ```bash
  ollama serve
  ollama pull qwen2.5:3b
  ollama pull nomic-embed-text
  ```
  *(Note: If Ollama is offline, the backend gracefully falls back to deterministic local heuristic responses for offline development.)*

### 1. Start Backend

```bash
cd backend
uv sync
uv run uvicorn main:app --reload --port 8000
```
Backend API will be accessible at `http://127.0.0.1:8000`.

To run backend verification tests:
```bash
uv run python test_smoke.py
uv run python test_integration.py
```

### 2. Start Frontend

```bash
cd frontend
bun install
bun run dev
```
Frontend development server will be accessible at `http://localhost:5173`.

To verify frontend build:
```bash
bun run build
```

---

## 5. API Endpoints Reference

| Method | Endpoint | Description | Request Body / Query Params | Response |
|---|---|---|---|---|
| `GET` | `/api/health` | Health check verifying SQLite, LanceDB, and Ollama connection status | None | `{"status", "database", "lancedb", "ollama"}` |
| `POST` | `/api/documents/upload` | Ingests PDF, Markdown, or text file into AST tree and chunk embeddings | `multipart/form-data` (`file`) | `{"status", "doc_id", "filename", "num_chunks", "num_tree_nodes", "tree_skeleton"}` |
| `GET` | `/api/documents` | Lists all indexed documents with chunk count and tree node counts | None | `{"documents": [...]}` |
| `GET` | `/api/documents/{doc_id}` | Retrieves full document details, hierarchical tree JSON, and raw chunks | `doc_id` (path) | `{"id", "filename", "tree", "chunks"}` |
| `POST` | `/api/query` | Executes retrieval across `vector_raw`, `vector_rerank`, or `vectorless` | `{"query": str, "doc_id"?: str, "mode": str}` | Retrieved chunks/nodes, answer, rank deltas, and latency breakdown |
| `POST` | `/api/eval/run` | Triggers asynchronous benchmark evaluation suite in the background | `{"run_name"?: str, "doc_id"?: str, "dataset"?: [...], "modes"?: [...]}` | `{"status": "started", "run_id", "stream_url"}` |
| `GET` | `/api/eval/stream/{run_id}` | Server-Sent Events (SSE) stream broadcasting live progress and metrics | `run_id` (path) | SSE events (`event: update`, `event: ping`) |
| `GET` | `/api/eval/history` | Fetches historical benchmark runs from SQLite `eval_runs` table | None | `{"history": [...]}` |
| `GET` | `/api/eval/golden_dataset` | Returns default pre-populated 5-question golden benchmark dataset | None | `{"dataset": [...]}` |

---

## License

MIT License. See [LICENSE](LICENSE) for details.
