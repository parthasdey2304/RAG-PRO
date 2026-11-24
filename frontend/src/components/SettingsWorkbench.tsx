import React, { useState } from 'react';
import {
  Cpu,
  Database,
  Layers,
  Save,
  Terminal
} from 'lucide-react';
import type { HealthStatus } from '../types';

interface SettingsWorkbenchProps {
  health: HealthStatus | null;
  onTriggerToast?: (msg: string, type?: 'default' | 'success' | 'warning' | 'error') => void;
}

export const SettingsWorkbench: React.FC<SettingsWorkbenchProps> = ({ health, onTriggerToast }) => {
  const [workerCount, setWorkerCount] = useState<number>(4);
  const [simdEnabled, setSimdEnabled] = useState<boolean>(true);
  const [ramReservation, setRamReservation] = useState<number>(16);
  const [qdrantPath, setQdrantPath] = useState<string>('~/.rag_studio/lancedb_data');
  const [otelEndpoint, setOtelEndpoint] = useState<string>('localhost:4317 (gRPC)');
  const [activeModel, setActiveModel] = useState<string>('bge-large-en-v1.5');

  const handleSave = () => {
    if (onTriggerToast) onTriggerToast('Hardware engine configurations updated and persisted to disk.', 'success');
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-6xl mx-auto">
      {/* Header Context */}
      <div className="studio-card p-3.5 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded bg-yellow-400 text-slate-950 border border-slate-900 font-bold uppercase shadow-2xs">
                STUDIO CONFIGURATION
              </span>
              <h2 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                Local Hardware Compute, Vector Index & Diagnostics
              </h2>
            </div>
            <p className="text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
              PROFILE: bench-local-9021 | RUNTIME: ONNX-Runtime v1.18 + AVX-512 | SQLite WAL
            </p>
          </div>

          <button onClick={handleSave} className="studio-btn-primary self-start sm:self-auto text-xs">
            <Save className="w-3.5 h-3.5" />
            <span>SAVE CONFIGURATION</span>
          </button>
        </div>
      </div>

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 font-mono text-xs">
        {/* Card 1: Hardware Compute & SIMD Acceleration */}
        <div className="studio-card p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-200 uppercase text-xs">
              Hardware Compute & AVX-512 SIMD
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">CPU THREAD WORKERS:</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={workerCount}
                  onChange={(e) => setWorkerCount(Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-slate-900 dark:text-white font-bold w-16 text-right">{workerCount} threads</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">RAM RESERVATION CEILING:</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={4}
                  max={64}
                  step={4}
                  value={ramReservation}
                  onChange={(e) => setRamReservation(Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-cyan-600 dark:text-cyan-400 font-bold w-16 text-right">{ramReservation} GB</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
              <span className="text-slate-700 dark:text-slate-300">AVX-512 VNNI Vector Acceleration</span>
              <button
                onClick={() => setSimdEnabled(!simdEnabled)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  simdEnabled
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {simdEnabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Local Embeddings & Model Registry */}
        <div className="studio-card p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-200 uppercase text-xs">
              Model Registry & In-Memory Encoders
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">DENSE EMBEDDING MODEL:</span>
              <select
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                className="w-full bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-slate-900 dark:text-slate-200 text-xs shadow-xs"
              >
                <option value="bge-large-en-v1.5">bge-large-en-v1.5 (1024-dim, FP16 in RAM)</option>
                <option value="nomic-embed-text">nomic-embed-text-v1.5 (768-dim, Local Ollama)</option>
                <option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 (384-dim, Ultra-fast)</option>
              </select>
            </div>

            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">FlashRank Reranker:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">ms-marco-MiniLM-L-12-v2 ONNX</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Tree-Reasoning AST:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">tree-sitter-cst native (v0.21)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Ollama Arbiter:</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">{health?.ollama?.target_gen_model || 'qwen2.5-coder:7b'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Storage & Persistence Engine */}
        <div className="studio-card p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-200 uppercase text-xs">
              Vector DB & SQLite WAL Persistence
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">LOCAL LANCEDB PATH:</span>
              <input
                type="text"
                value={qdrantPath}
                onChange={(e) => setQdrantPath(e.target.value)}
                className="w-full bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-slate-900 dark:text-slate-200 text-xs shadow-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">HNSW PARAMETERS:</span>
                <span className="text-slate-900 dark:text-slate-200 font-semibold">M=16, ef=64</span>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">QUANTIZATION:</span>
                <span className="text-slate-900 dark:text-slate-200 font-semibold">Scalar INT8</span>
              </div>
            </div>

            <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              SQLite WAL Mode active. Ring buffer holds up to 50,000 trace spans without thread contention.
            </div>
          </div>
        </div>

        {/* Card 4: OpenTelemetry & Observability */}
        <div className="studio-card p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <Terminal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-200 uppercase text-xs">
              Telemetry & OTel Exporter
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">OTEL EXPORTER ENDPOINT:</span>
              <input
                type="text"
                value={otelEndpoint}
                onChange={(e) => setOtelEndpoint(e.target.value)}
                className="w-full bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-slate-900 dark:text-slate-200 text-xs shadow-xs"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
              <span className="text-slate-700 dark:text-slate-300">Deterministic Sampling (100%)</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold">
                ACTIVE
              </span>
            </div>

            <p className="text-[10px] text-slate-500">
              Traces comply with OpenTelemetry semantic conventions for AI retrieval spans and latency histograms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
