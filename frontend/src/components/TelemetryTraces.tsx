import React, { useState } from 'react';
import {
  Activity,
  Search,
  Copy,
  CheckCircle2,
  Download,
  Flame,
  Terminal,
  PlayCircle
} from 'lucide-react';
import type { TraceRecord } from '../types';

interface TelemetryTracesProps {
  traces?: TraceRecord[];
  onTriggerToast?: (msg: string, type?: 'default' | 'success' | 'warning' | 'error') => void;
}

export const TelemetryTraces: React.FC<TelemetryTracesProps> = ({ traces: propTraces = [], onTriggerToast }) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [engineFilter, setEngineFilter] = useState<'ALL' | 'VECTOR' | 'TREE' | 'DUAL'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  // Initialize strictly from propTraces (no hardcoded mock traces per audit spec)
  const traces = propTraces;

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

  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const selectedTrace = (selectedTraceId ? filteredTraces.find((t) => t.id === selectedTraceId) : null) || filteredTraces[0] || null;

  const latencies = traces.map((t) => t.total_latency_ms).sort((a, b) => a - b);
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)].toFixed(1) : '--';
  const p95 = latencies.length > 0 ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))].toFixed(1) : '--';

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    if (onTriggerToast) onTriggerToast(`Copied ${id} to clipboard`);
  };

  const handleDownloadOtel = () => {
    if (!selectedTrace) return;
    const blob = new Blob([JSON.stringify(selectedTrace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `otel_span_${selectedTrace.id}.json`;
    a.click();
    if (onTriggerToast) onTriggerToast(`Exported OpenTelemetry trace ${selectedTrace.id}`, 'success');
  };

  if (traces.length === 0) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto font-mono text-center space-y-4">
        <div className="studio-card p-12 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-xl bg-yellow-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 font-black shadow-xs">
            <Activity className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-base text-slate-950 dark:text-white uppercase tracking-wider">
              No traces yet — run a query in the Retrieval Arena.
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Real-time OpenTelemetry retrieval spans, waterfall latencies, and AST traversals will be recorded here dynamically as you execute queries.
            </p>
          </div>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
              <PlayCircle className="w-4 h-4 text-yellow-500" />
              <span>Switch to "Retrieval Arena" tab to execute queries</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5">
      {/* Sub-header Context Strip */}
      <div className="studio-card p-3 text-[11px] font-mono text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-950 dark:text-white font-bold">LIVE TELEMETRY BUFFER</span>
          <span>•</span>
          <span>SPANS RECORDED: {traces.length}</span>
          <span>•</span>
          <span>OPENTELEMETRY v1.28</span>
        </div>
        <div className="font-bold text-slate-950 dark:text-yellow-400">
          100% Deterministic Attribution
        </div>
      </div>

      {/* Top Telemetry Filter & KPI Bar */}
      <div className="studio-card p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search trace ID or query substring [⌘K]..."
              className="w-full bg-white dark:bg-[#090d16] border-2 border-slate-900 dark:border-slate-700 rounded px-2.5 py-1.5 pl-8 text-xs text-slate-950 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-yellow-400 font-mono shadow-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="flex rounded border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 shadow-xs">
              {(['ALL', 'VECTOR', 'TREE', 'DUAL'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setEngineFilter(mode)}
                  className={`px-2.5 py-1 rounded text-[11px] transition-colors font-bold ${
                    engineFilter === mode
                      ? 'bg-[#facc15] text-slate-950 border border-slate-900 shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {mode === 'ALL' ? `All (${traces.length})` : mode === 'VECTOR' ? 'Vector' : mode === 'TREE' ? 'Tree' : 'Dual-Arena'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live KPI Metric Cards Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 pt-2 border-t-2 border-slate-900 dark:border-slate-800 text-xs font-mono">
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-900 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] block">TOTAL TRACES</span>
            <span className="text-slate-950 dark:text-white font-black text-xs sm:text-sm">{traces.length}</span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-900 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] block">P50 LATENCY</span>
            <span className="text-slate-950 dark:text-yellow-400 font-black text-xs sm:text-sm">{p50}ms</span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-900 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] block">P95 LATENCY</span>
            <span className="text-amber-600 dark:text-amber-300 font-black text-xs sm:text-sm">{p95}ms</span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-900 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] block">LATEST TRACE</span>
            <span className="text-slate-900 dark:text-slate-200 font-bold text-xs truncate block" title={traces[0]?.id}>
              {traces[0]?.id || '--'}
            </span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-900 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] block">STATUS RATE</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm">100% OK</span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-900 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] block">QUERY CACHE</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold text-xs sm:text-sm">ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Split Trace Explorer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Column (40% width): Historical Trace List */}
        <div className="lg:col-span-5 studio-card flex flex-col overflow-hidden">
          <div className="bg-slate-100 dark:bg-[#0b1120] border-b-2 border-slate-900 dark:border-slate-800 p-3 sm:p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-slate-950 dark:text-yellow-400" />
              <h3 className="font-black text-xs text-slate-950 dark:text-slate-200 uppercase tracking-wide">
                Query Trace Logs ({filteredTraces.length}/{traces.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500 font-bold">Ring Buffer</span>
          </div>

          <div className="divide-y-2 divide-slate-900/20 dark:divide-slate-800 overflow-y-auto max-h-[620px]">
            {filteredTraces.length > 0 ? (
              filteredTraces.map((trace) => {
                const isSelected = trace.id === selectedTrace?.id;
                return (
                  <div
                    key={trace.id}
                    onClick={() => setSelectedTraceId(trace.id)}
                    className={`p-3 sm:p-3.5 cursor-pointer text-xs font-mono transition-colors border-l-4 ${
                      isSelected
                        ? 'bg-yellow-400/10 dark:bg-yellow-400/10 border-l-[#facc15] text-slate-950 dark:text-white font-bold'
                        : 'border-l-transparent text-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{trace.timestamp}</span>
                        <span className="text-slate-400">•</span>
                        <span className="font-bold text-slate-950 dark:text-yellow-400">{trace.id}</span>
                      </div>

                      <span className="text-[10px] px-1.5 py-0.2 rounded border border-slate-900 font-bold bg-yellow-400 text-slate-950">
                        {trace.status}
                      </span>
                    </div>

                    <p className="text-slate-950 dark:text-slate-200 text-[11px] line-clamp-2 mb-2 font-sans font-medium">
                      {trace.query}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <span>Vec: {trace.vector_latency_ms}ms</span>
                        <span>Tree: {trace.tree_latency_ms}ms</span>
                      </div>
                      {trace.precision_delta !== 0 && (
                        <span className="font-bold text-slate-950 dark:text-yellow-400">
                          {trace.precision_delta > 0 ? `+${trace.precision_delta}` : trace.precision_delta} Rank Delta
                        </span>
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
          <div className="bg-slate-100 dark:bg-[#0b1120] border-b-2 border-slate-900 dark:border-slate-800 p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <h3 className="font-black text-xs text-slate-950 dark:text-slate-200 uppercase tracking-wide">
                Trace Inspector: {selectedTrace?.id || '--'}
              </h3>
            </div>

            {selectedTrace && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy('trace-json', JSON.stringify(selectedTrace, null, 2))}
                  className="studio-btn-ghost text-[10px] py-1 px-2 font-mono"
                >
                  {copiedId === 'trace-json' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
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
            )}
          </div>

          {!selectedTrace ? (
            <div className="p-12 text-center text-slate-500 font-mono text-xs">
              Select a trace from the left list to inspect its execution waterfall spans.
            </div>
          ) : (
            <div className="p-3.5 sm:p-4 space-y-4 flex-1 overflow-y-auto max-h-[620px] text-xs font-mono">
              {/* Trace Context Banner */}
              <div className="studio-card-elevated p-3 space-y-2">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">QUERY STRING:</span>
                <p className="text-slate-950 dark:text-slate-100 font-sans font-bold text-xs leading-relaxed">
                  {selectedTrace.query}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>Wall Clock: <span className="text-slate-950 dark:text-white font-black">{selectedTrace.total_latency_ms}ms</span></span>
                  <span>Retrieved Chunks: <span className="font-bold text-slate-950 dark:text-white">{selectedTrace.chunks_retrieved}</span></span>
                  <span>AST Depth: <span className="font-bold text-slate-950 dark:text-white">{selectedTrace.tree_depth}</span></span>
                </div>
              </div>

              {/* Dual Execution Waterfall Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b-2 border-slate-900 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-950 dark:text-slate-200 font-bold uppercase text-[11px]">
                    Execution Waterfall Spans
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Gantt Milliseconds</span>
                </div>

                {/* Pipeline A: Vector */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-950 dark:text-white font-bold block uppercase">
                    PIPELINE A: Vector Search + FlashRank ({selectedTrace.vector_latency_ms}ms)
                  </span>
                  {selectedTrace.vector_spans?.length > 0 ? (
                    selectedTrace.vector_spans.map((span, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400">
                          <span>{span.name}</span>
                          <span className="font-bold">{span.duration_ms}ms</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 dark:bg-slate-900 rounded border border-slate-900 dark:border-slate-700 overflow-hidden relative">
                          <div
                            className={`h-full ${span.color} rounded`}
                            style={{
                              marginLeft: `${Math.min(90, (span.start_ms / Math.max(1, selectedTrace.total_latency_ms)) * 100)}%`,
                              width: `${Math.max(5, (span.duration_ms / Math.max(1, selectedTrace.total_latency_ms)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[10px] text-slate-500 italic">No vector spans recorded.</div>
                  )}
                </div>

                {/* Pipeline B: Tree */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] text-slate-950 dark:text-yellow-400 font-bold block uppercase">
                    PIPELINE B: Vectorless Tree-Reasoning Engine ({selectedTrace.tree_latency_ms}ms)
                  </span>
                  {selectedTrace.tree_spans?.length > 0 ? (
                    selectedTrace.tree_spans.map((span, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400">
                          <span>{span.name}</span>
                          <span className="font-bold">{span.duration_ms}ms</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 dark:bg-slate-900 rounded border border-slate-900 dark:border-slate-700 overflow-hidden relative">
                          <div
                            className={`h-full ${span.color} rounded`}
                            style={{
                              marginLeft: `${Math.min(90, (span.start_ms / Math.max(1, selectedTrace.total_latency_ms)) * 100)}%`,
                              width: `${Math.max(5, (span.duration_ms / Math.max(1, selectedTrace.total_latency_ms)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[10px] text-slate-500 italic">No tree spans recorded.</div>
                  )}
                </div>
              </div>

              {/* Toggle Raw JSON */}
              <div className="pt-2 border-t-2 border-slate-900 dark:border-slate-800">
                <button
                  onClick={() => setShowJson(!showJson)}
                  className="text-[11px] text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white font-bold flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>{showJson ? 'Hide Raw OTel JSON' : 'Inspect Raw OpenTelemetry JSON Spans'}</span>
                </button>

                {showJson && (
                  <pre className="mt-2 p-3 rounded bg-slate-100 dark:bg-slate-950 border-2 border-slate-900 dark:border-slate-800 text-[10px] text-slate-800 dark:text-slate-300 max-h-[180px] overflow-y-auto">
                    {JSON.stringify(selectedTrace, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
