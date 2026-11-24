import React, { useState } from 'react';
import {
  Activity,
  Search,
  Copy,
  CheckCircle2,
  Download,
  Flame,
  Terminal
} from 'lucide-react';
import type { TraceRecord } from '../types';

interface TelemetryTracesProps {
  traces?: TraceRecord[];
  onTriggerToast?: (msg: string, type?: 'default' | 'success' | 'warning' | 'error') => void;
}

export const TelemetryTraces: React.FC<TelemetryTracesProps> = ({ traces: propTraces, onTriggerToast }) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [engineFilter, setEngineFilter] = useState<'ALL' | 'VECTOR' | 'TREE' | 'DUAL'>('DUAL');
  const [selectedTraceId, setSelectedTraceId] = useState<string>('tr_8f92a10b');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  // High-fidelity baseline traces matching Stitch Screen 4
  const defaultTraces: TraceRecord[] = [
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
  ];

  const traces = propTraces && propTraces.length > 0 ? propTraces : defaultTraces;

  const filteredTraces = traces.filter((t) => {
    const matchesSearch =
      !searchFilter.trim() ||
      t.query.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.id.toLowerCase().includes(searchFilter.toLowerCase());
    if (!matchesSearch) return false;
    if (engineFilter === 'ALL') return true;
    if (engineFilter === 'DUAL') return t.engine === 'DUAL_ARENA';
    if (engineFilter === 'VECTOR') return t.engine === 'VECTOR_FLASHRANK';
    if (engineFilter === 'TREE') return t.engine === 'TREE_REASONING';
    return true;
  });

  const selectedTrace = filteredTraces.find((t) => t.id === selectedTraceId) || filteredTraces[0] || traces[0];

  const latencies = traces.map((t) => t.total_latency_ms).sort((a, b) => a - b);
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)].toFixed(1) : '14.6';
  const p95 = latencies.length > 0 ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))].toFixed(1) : '24.1';

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    if (onTriggerToast) onTriggerToast(`Copied ${id} to clipboard`);
  };

  const handleDownloadOtel = () => {
    const blob = new Blob([JSON.stringify(selectedTrace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `otel_span_${selectedTrace.id}.json`;
    a.click();
    if (onTriggerToast) onTriggerToast(`Exported OpenTelemetry trace ${selectedTrace.id}`, 'success');
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Sub-header Context Strip */}
      <div className="studio-card p-3 bg-[#0b1120] text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-200 font-semibold">SESSION: bench-local-9021</span>
          <span>•</span>
          <span>COLLECTION: sec-edgar-10k-q4</span>
          <span>•</span>
          <span>CHUNKER: semantic-recursive (512 tk)</span>
        </div>
        <div>
          <span>RING BUFFER: 1,248 spans / 16MB</span>
          <span className="ml-2 text-cyan-400">100% Deterministic</span>
        </div>
      </div>

      {/* Top Telemetry Filter & KPI Bar */}
      <div className="studio-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search trace ID (e.g. tr_8f92a10b) or query substring [⌘K]..."
              className="w-full bg-[#090d16] border border-slate-800 rounded px-2.5 py-1.5 pl-8 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="flex rounded bg-slate-900 border border-slate-800 p-0.5">
              {(['ALL', 'VECTOR', 'TREE', 'DUAL'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setEngineFilter(mode)}
                  className={`px-2.5 py-1 rounded text-[11px] ${
                    engineFilter === mode
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode === 'ALL' ? 'All (1,248)' : mode === 'VECTOR' ? 'Vector' : mode === 'TREE' ? 'Tree' : 'Dual-Arena (96)'}
                </button>
              ))}
            </div>

            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[11px]">
              Last 24h
            </span>
          </div>
        </div>

        {/* Live KPI Metric Cards Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-800/80 text-xs font-mono">
          <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block">TOTAL TRACES</span>
            <span className="text-white font-bold text-sm">{traces.length} recorded</span>
          </div>
          <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block">P50 LATENCY</span>
            <span className="text-cyan-400 font-bold text-sm">{p50}ms</span>
          </div>
          <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block">P95 LATENCY</span>
            <span className="text-amber-300 font-bold text-sm">{p95}ms</span>
          </div>
          <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block">VRAM FOOTPRINT</span>
            <span className="text-slate-200 font-bold text-sm">1.42 GB / 16 GB</span>
          </div>
          <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block">FAILURE RATE</span>
            <span className="text-emerald-400 font-bold text-sm">0.00%</span>
          </div>
          <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block">CACHE HIT RATIO</span>
            <span className="text-blue-400 font-bold text-sm">98.6%</span>
          </div>
        </div>
      </div>

      {/* Split Trace Explorer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (40% width): Historical Trace List */}
        <div className="lg:col-span-5 studio-card flex flex-col overflow-hidden">
          <div className="bg-[#0b1120] border-b border-slate-800 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wide">
                Query Trace Logs ({filteredTraces.length}/{traces.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Live Ring Buffer</span>
          </div>

          <div className="divide-y divide-slate-800/80 overflow-y-auto max-h-[620px]">
            {filteredTraces.length > 0 ? (
              filteredTraces.map((trace) => {
                const isSelected = trace.id === selectedTrace.id;
                return (
                  <div
                    key={trace.id}
                    onClick={() => setSelectedTraceId(trace.id)}
                    className={`p-3.5 cursor-pointer text-xs font-mono transition-colors border-l-2 ${
                      isSelected
                        ? 'bg-blue-950/40 border-l-cyan-400 text-white'
                        : 'border-l-transparent text-slate-300 hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">{trace.timestamp}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-cyan-400 font-semibold">{trace.id}</span>
                      </div>

                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${
                          trace.status === '200_OK'
                            ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
                            : 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                        }`}
                      >
                        {trace.status}
                      </span>
                    </div>

                    <p className="text-slate-200 text-[11px] line-clamp-2 mb-2 font-sans font-medium">
                      {trace.query}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span>Vector: {trace.vector_latency_ms}ms</span>
                        <span>Tree: {trace.tree_latency_ms}ms</span>
                      </div>
                      {trace.precision_delta > 0 && (
                        <span className="text-emerald-400">+{trace.precision_delta}% Prec</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                No traces match filter "{searchFilter}".
              </div>
            )}
          </div>
        </div>

        {/* Right Column (60% width): Detailed Trace Waterfall & Flamegraph */}
        <div className="lg:col-span-7 studio-card flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#0b1120] border-b border-slate-800 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wide">
                Trace Inspector: {selectedTrace.id}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy('trace-json', JSON.stringify(selectedTrace, null, 2))}
                className="studio-btn-ghost text-[10px] py-1 px-2 font-mono"
              >
                {copiedId === 'trace-json' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy</span>
              </button>
              <button
                onClick={handleDownloadOtel}
                className="studio-btn-ghost text-[10px] py-1 px-2 font-mono"
              >
                <Download className="w-3 h-3" />
                <span>OTel Spans</span>
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[620px] text-xs font-mono">
            {/* Trace Context Banner */}
            <div className="studio-card-elevated p-3 space-y-2">
              <span className="text-[10px] text-slate-500 font-bold block uppercase">QUERY STRING:</span>
              <p className="text-slate-100 font-sans font-medium text-xs">
                {selectedTrace.query}
              </p>
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Wall Clock: <span className="text-white font-bold">{selectedTrace.total_latency_ms}ms</span></span>
                <span>VRAM Peak: <span className="text-cyan-400 font-bold">{selectedTrace.vram_allocated_mb} MB</span></span>
                <span>AST Nodes Evaluated: <span className="text-emerald-400 font-bold">{selectedTrace.tree_nodes_scanned}</span></span>
              </div>
            </div>

            {/* Dual Execution Waterfall Timeline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-300 font-semibold uppercase text-[11px]">
                  Execution Waterfall Spans (0ms - 20ms Timeline)
                </span>
                <span className="text-[10px] text-slate-500">Millisecond Gantt Bar</span>
              </div>

              {/* Pipeline A: Vector */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-blue-400 font-semibold block">
                  PIPELINE A: Vector Search + FlashRank (14.2ms)
                </span>
                {selectedTrace.vector_spans.map((span, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{span.name}</span>
                      <span>{span.duration_ms}ms</span>
                    </div>
                    <div className="w-full h-3 bg-slate-900 rounded overflow-hidden relative">
                      <div
                        className={`h-full ${span.color} rounded`}
                        style={{
                          marginLeft: `${(span.start_ms / 20) * 100}%`,
                          width: `${(span.duration_ms / 20) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pipeline B: Tree */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] text-cyan-400 font-semibold block">
                  PIPELINE B: Vectorless Tree-Reasoning Engine (18.5ms)
                </span>
                {selectedTrace.tree_spans.map((span, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{span.name}</span>
                      <span>{span.duration_ms}ms</span>
                    </div>
                    <div className="w-full h-3 bg-slate-900 rounded overflow-hidden relative">
                      <div
                        className={`h-full ${span.color} rounded`}
                        style={{
                          marginLeft: `${(span.start_ms / 20) * 100}%`,
                          width: `${(span.duration_ms / 20) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stage Diagnostics & Hardware Profile Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 space-y-1.5 text-[11px]">
                <span className="text-blue-400 font-semibold block text-[10px] uppercase">
                  Vector Engine Hardware Profile
                </span>
                <div className="flex justify-between text-slate-400">
                  <span>HNSW Candidates Scored:</span>
                  <span className="text-slate-200">25 → 4 top-k</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cross-Entropy Loss:</span>
                  <span className="text-slate-200">0.041</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Inference Cost:</span>
                  <span className="text-slate-200">$0.0014 / query</span>
                </div>
              </div>

              <div className="p-3 rounded bg-slate-900/60 border border-slate-800 space-y-1.5 text-[11px]">
                <span className="text-cyan-400 font-semibold block text-[10px] uppercase">
                  Tree Engine AST Traversal Profile
                </span>
                <div className="flex justify-between text-slate-400">
                  <span>Total Nodes In AST:</span>
                  <span className="text-slate-200">142 nodes</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Visited / Pruned:</span>
                  <span className="text-slate-200">12 visited (5 pruned)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Hardware Cost:</span>
                  <span className="text-emerald-400 font-semibold">$0.0000 / Local CPU</span>
                </div>
              </div>
            </div>

            {/* Toggle Raw JSON */}
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowJson(!showJson)}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1.5"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>{showJson ? 'Hide Raw OTel JSON' : 'Inspect Raw OpenTelemetry JSON Spans'}</span>
              </button>

              {showJson && (
                <pre className="mt-2 p-3 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300 max-h-[180px] overflow-y-auto">
                  {JSON.stringify(selectedTrace, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
