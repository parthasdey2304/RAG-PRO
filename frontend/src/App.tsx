import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DocumentInspector } from './components/DocumentInspector';
import { SplitScreenArena } from './components/SplitScreenArena';
import { EvalLab } from './components/EvalLab';
import { TelemetryTraces } from './components/TelemetryTraces';
import { SettingsWorkbench } from './components/SettingsWorkbench';
import { IngestModal } from './components/IngestModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { ToastStack } from './components/ToastStack';
import type { DocumentItem, HealthStatus, StudioNotification, StudioToast, TraceRecord } from './types';
import { Sparkles, FileText, Upload } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'arena' | 'docs' | 'eval' | 'traces' | 'settings'>('arena');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Modals & Drawers
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  // Traces state - shared across Arena and Telemetry Views
  const [traces, setTraces] = useState<TraceRecord[]>([
    {
      id: 'tr_8f92a10b',
      timestamp: '14:28:02.814',
      engine: 'DUAL_ARENA',
      query: 'How does multi-head latent attention reduce KV-cache memory in DeepSeek-V3?',
      status: '200_OK',
      vector_latency_ms: 14.2,
      tree_latency_ms: 18.5,
      total_latency_ms: 18.5,
      chunks_retrieved: 4,
      tree_depth: 3,
      precision_delta: 14.2,
      vram_allocated_mb: 184,
      tree_nodes_scanned: 12,
      vector_spans: [
        { name: 'Embedding Generation (bge-large-en-v1.5)', start_ms: 0.0, end_ms: 4.1, duration_ms: 4.1, status: 'OK', color: 'bg-blue-500' },
        { name: 'LanceDB HNSW kNN Search (M=16, ef=64)', start_ms: 4.1, end_ms: 7.3, duration_ms: 3.2, status: 'OK', color: 'bg-cyan-500' },
        { name: 'FlashRank Cross-Encoder Re-scoring (ms-marco)', start_ms: 7.3, end_ms: 14.2, duration_ms: 6.9, status: 'OK', color: 'bg-indigo-500' },
      ],
      tree_spans: [
        { name: 'AST Root Semantic Classification', start_ms: 0.0, end_ms: 3.5, duration_ms: 3.5, status: 'OK', color: 'bg-emerald-500' },
        { name: 'L1 Architecture Branch Heuristic Pruning', start_ms: 3.5, end_ms: 9.3, duration_ms: 5.8, status: 'OK', color: 'bg-teal-500' },
        { name: 'L2-L3 Subtree Leaf Extraction & LaTeX Parsing', start_ms: 9.3, end_ms: 18.5, duration_ms: 9.2, status: 'OK', color: 'bg-amber-500' },
      ],
    },
    {
      id: 'tr_7a14e92c',
      timestamp: '14:26:45.109',
      engine: 'VECTOR_FLASHRANK',
      query: 'FlashAttention-3 warp-specialization barrier vs FA-2 ping-pong scheduling',
      status: '200_OK',
      vector_latency_ms: 12.8,
      tree_latency_ms: 0,
      total_latency_ms: 12.8,
      chunks_retrieved: 4,
      tree_depth: 0,
      precision_delta: 0,
      vram_allocated_mb: 184,
      tree_nodes_scanned: 0,
      vector_spans: [
        { name: 'Embedding Generation', start_ms: 0.0, end_ms: 3.8, duration_ms: 3.8, status: 'OK', color: 'bg-blue-500' },
        { name: 'LanceDB Search', start_ms: 3.8, end_ms: 6.9, duration_ms: 3.1, status: 'OK', color: 'bg-cyan-500' },
        { name: 'FlashRank Rerank', start_ms: 6.9, end_ms: 12.8, duration_ms: 5.9, status: 'OK', color: 'bg-indigo-500' },
      ],
      tree_spans: [],
    },
    {
      id: 'tr_6b30f881',
      timestamp: '14:22:11.450',
      engine: 'TREE_REASONING',
      query: 'Write down the asynchronous TMA load barrier formula in Hopper FP8',
      status: '200_OK',
      vector_latency_ms: 0,
      tree_latency_ms: 16.4,
      total_latency_ms: 16.4,
      chunks_retrieved: 2,
      tree_depth: 3,
      precision_delta: 12.5,
      vram_allocated_mb: 0,
      tree_nodes_scanned: 9,
      vector_spans: [],
      tree_spans: [
        { name: 'Root Navigation', start_ms: 0.0, end_ms: 3.1, duration_ms: 3.1, status: 'OK', color: 'bg-emerald-500' },
        { name: 'Branch Evaluation', start_ms: 3.1, end_ms: 8.4, duration_ms: 5.3, status: 'OK', color: 'bg-teal-500' },
        { name: 'Leaf Extraction', start_ms: 8.4, end_ms: 16.4, duration_ms: 8.0, status: 'OK', color: 'bg-amber-500' },
      ],
    },
    {
      id: 'tr_5c829aa3',
      timestamp: '14:18:59.002',
      engine: 'DUAL_ARENA',
      query: 'Compare multi-token prediction speculative decoding verification latency',
      status: 'FALLBACK',
      vector_latency_ms: 15.1,
      tree_latency_ms: 29.4,
      total_latency_ms: 29.4,
      chunks_retrieved: 3,
      tree_depth: 4,
      precision_delta: 8.1,
      vram_allocated_mb: 184,
      tree_nodes_scanned: 18,
      vector_spans: [
        { name: 'Embedding Gen', start_ms: 0.0, end_ms: 4.2, duration_ms: 4.2, status: 'OK', color: 'bg-blue-500' },
        { name: 'kNN Query', start_ms: 4.2, end_ms: 7.9, duration_ms: 3.7, status: 'OK', color: 'bg-cyan-500' },
        { name: 'FlashRank Cross-Encoder', start_ms: 7.9, end_ms: 15.1, duration_ms: 7.2, status: 'OK', color: 'bg-indigo-500' },
      ],
      tree_spans: [
        { name: 'AST Traversal', start_ms: 0.0, end_ms: 8.5, duration_ms: 8.5, status: 'OK', color: 'bg-emerald-500' },
        { name: 'Subtree Retry & Verification', start_ms: 8.5, end_ms: 29.4, duration_ms: 20.9, status: 'WARN', color: 'bg-amber-500' },
      ],
    },
  ]);

  const addTrace = (trace: TraceRecord) => {
    setTraces((prev) => [trace, ...prev]);
  };

  // Notifications state matching Stitch Screen 5
  const [notifications, setNotifications] = useState<StudioNotification[]>([
    {
      id: 'notif-1',
      type: 'success',
      title: 'Tree Index Built Successfully',
      message: 'Ingested deepseek_v3_arch.pdf (142 nodes, 38.4k tokens in 184ms) into SQLite WAL.',
      timestamp: '2m ago',
      read: false,
      actionLabel: 'Inspect AST →',
      targetTab: 'docs',
    },
    {
      id: 'notif-2',
      type: 'warning',
      title: 'High Rerank Latency Warning',
      message: 'Query tr_5c829aa3 FlashRank cross-encoder exceeded 25ms threshold (took 29.4ms, +17.6% delta).',
      timestamp: '14m ago',
      read: false,
      actionLabel: 'View Span Trace →',
      targetTab: 'traces',
    },
    {
      id: 'notif-3',
      type: 'info',
      title: 'RAGAS Benchmark Completed',
      message: '50 questions evaluated. Tree-Reasoning outperformed Vector by +5.8% faithfulness and +7.5% SNR context precision.',
      timestamp: '42m ago',
      read: true,
      actionLabel: 'View Evaluation Matrix →',
      targetTab: 'eval',
    },
  ]);

  const addNotification = (notif: StudioNotification) => {
    setNotifications((prev) => [notif, ...prev]);
  };

  // Toasts state
  const [toasts, setToasts] = useState<StudioToast[]>([]);

  const addToast = (message: string, type: 'default' | 'success' | 'warning' | 'error' = 'default', undoAction?: () => void) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type, undoAction, durationSeconds: 5 }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Keyboard shortcut listener: Cmd/Ctrl+I opens Ingest Modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        setIsIngestModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Fetch health and documents
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {}
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        const docs: DocumentItem[] = data.documents || [];
        setDocuments(docs);
        if (docs.length > 0) {
          setSelectedDocId((prev) => prev || docs[0].id);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (mounted) {
        await fetchHealth();
        await fetchDocuments();
      }
    };
    run();
    const interval = setInterval(fetchHealth, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchHealth, fetchDocuments]);

  // Quick Seed Demo Document
  const handleSeedDemoDoc = async () => {
    setIsSeeding(true);
    const sampleText = `# RAG Architecture Blueprint: Vector vs. Vectorless Navigation

## 1.0 Executive Summary
Local-first retrieval-augmented generation architectures require strict determinism. When running on consumer hardware (16GB RAM laptop), standard vector retrieval paired with cross-encoder reranking provides rapid candidate filtering, while Vectorless RAG eliminates chunking noise through hierarchical reasoning.

## 2.0 Standard Vector RAG & FlashRank Cross-Encoder
In standard vector pipelines, documents are parsed into uniform chunks (512 characters with 64 overlap). Embeddings generated via local nomic-embed-text are indexed in LanceDB. FlashRank (ms-marco-MiniLM-L-12-v2) runs on CPU using lightweight ONNX models to re-order the top-15 vector matches into the top-4 highest signal chunks.

## 3.0 Vectorless RAG (PageIndex Tree Reasoning)
Vectorless RAG treats documents like structured human manuals. Documents are indexed by headings into a hierarchical JSON tree stored in SQLite WAL mode. When a query arrives, only the lightweight skeleton (node_id, title, summary) is sent to the LLM. The LLM selects the exact node_ids needed, achieving near-zero chunk boundary hallucinations and full auditability.

## 4.0 Reranker Evaluation & RAGAS Benchmarking
Evaluating rerankers requires both Classic Information Retrieval (IR) metrics and RAGAS LLM-as-a-judge scores.
- Mean Reciprocal Rank (MRR): 1 / rank of first relevant chunk.
- nDCG@4: Rewards placing multiple relevant items in descending order.
- Hit Rate@1: Checks whether the true answer is promoted to Rank #1.
- Avg Rank Delta: Measures the upward movement of relevant chunks (e.g., +6 spots).
- Recall Drop-off Rate: Tracks instances where the initial top-15 retrieved the chunk, but the reranker pruned it from the final top-4.
- Context Precision & Recall: Validates grounding and signals whether the LLM hallucinated outside retrieved nodes.

## 5.0 Local Hardware Constraints & SQLite WAL Mode
Running multi-turn evaluation synchronously on 3B-7B models saturates VRAM. To solve this, an async background queue runs with RunConfig(max_workers=2). SQLite in WAL mode permits concurrent query logging and historical eval persistence without database table locks.
`;

    const blob = new Blob([sampleText], { type: 'text/markdown' });
    const formData = new FormData();
    formData.append('file', blob, 'RAG_Architecture_Blueprint.md');

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        await fetchDocuments();
        setSelectedDocId(data.doc_id);
        addToast('Architecture Blueprint seeded into LanceDB & SQLite WAL!', 'success');
        addNotification({
          id: `notif-${Date.now()}`,
          type: 'success',
          title: 'Reference Blueprint Loaded',
          message: 'Seeded RAG_Architecture_Blueprint.md into LanceDB and SQLite WAL.',
          timestamp: 'Just now',
          read: false,
          actionLabel: 'Inspect Tree →',
          targetTab: 'docs',
        });
      }
    } catch {
      addToast('Error seeding demo document', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast('Marked all notifications as read', 'default');
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    addToast('Cleared all notifications', 'default');
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        docsCount={documents.length}
        unreadNotificationsCount={unreadCount}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
        onOpenIngestModal={() => setIsIngestModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto">
        {/* Onboarding Callout if no documents exist */}
        {documents.length === 0 && (
          <div className="m-4 sm:m-6 p-4 rounded-lg bg-[#0f172a] border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Sparkles className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-slate-100">
                  Welcome to RAG Studio Workbench
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  No documents indexed yet. Load the reference architecture blueprint to initialize LanceDB & SQLite WAL.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsIngestModalOpen(true)}
                className="studio-btn-ghost"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom</span>
              </button>
              <button
                onClick={handleSeedDemoDoc}
                disabled={isSeeding}
                className="studio-btn-primary"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isSeeding ? 'SEEDING...' : 'LOAD BLUEPRINT'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'arena' && (
          <SplitScreenArena
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectDoc={setSelectedDocId}
            onAddTrace={addTrace}
            onAddNotification={addNotification}
            onTriggerToast={addToast}
          />
        )}

        {activeTab === 'docs' && (
          <DocumentInspector
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectDoc={setSelectedDocId}
            onUploadSuccess={fetchDocuments}
            onTriggerToast={addToast}
          />
        )}

        {activeTab === 'eval' && (
          <EvalLab
            documents={documents}
            selectedDocId={selectedDocId}
            onTriggerToast={addToast}
          />
        )}

        {activeTab === 'traces' && (
          <TelemetryTraces
            traces={traces}
            onTriggerToast={addToast}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsWorkbench
            health={health}
            onTriggerToast={addToast}
          />
        )}
      </main>

      {/* Engineering Workbench Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0b1120] px-4 sm:px-6 py-2.5 text-[11px] font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">RAG STUDIO WORKBENCH</span>
          <span>•</span>
          <span>FLASHRANK CPU ONNX</span>
          <span>•</span>
          <span>PAGEINDEX AST TREE REASONING</span>
          <span>•</span>
          <span>RAGAS EVALUATION LAB</span>
        </div>
        <div className="flex items-center gap-3">
          <span>100% LOCAL-FIRST // DETERMINISTIC RETRIEVAL</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Shortcut: [⌘+I Ingest] [↵ Run]</span>
        </div>
      </footer>

      {/* Modals & Slide-out Drawers */}
      <IngestModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        onUploadSuccess={fetchDocuments}
        onTriggerToast={addToast}
      />

      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
        onClearAll={handleClearAllNotifications}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      {/* Non-blocking Floating Toast Stack */}
      <ToastStack
        toasts={toasts}
        onDismiss={removeToast}
      />
    </div>
  );
}

export default App;
