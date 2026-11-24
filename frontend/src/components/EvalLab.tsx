import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  History,
  FileCode,
  RefreshCw,
  Download,
  BarChart3
} from 'lucide-react';
import type { DocumentItem, EvalRunRecord, GoldenQuestion, ModeMetrics } from '../types';

interface EvalLabProps {
  documents: DocumentItem[];
  selectedDocId: string | null;
  onTriggerToast?: (msg: string, type?: 'default' | 'success' | 'warning' | 'error') => void;
}

export const EvalLab: React.FC<EvalLabProps> = ({
  selectedDocId,
  onTriggerToast,
}) => {
  const [goldenDatasetJson, setGoldenDatasetJson] = useState<string>('');
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [currentStatusMsg, setCurrentStatusMsg] = useState<string>('');
  const [activeResults, setActiveResults] = useState<Record<string, ModeMetrics> | null>(null);
  const [historyRuns, setHistoryRuns] = useState<EvalRunRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'matrix' | 'editor' | 'history'>('matrix');

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/eval/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryRuns(data.history || []);
      }
    } catch {}
  }, []);

  // Load default golden dataset and history on mount
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const [datasetRes, historyRes] = await Promise.all([
          fetch('/api/eval/golden_dataset'),
          fetch('/api/eval/history'),
        ]);
        if (!active) return;
        if (datasetRes.ok) {
          const data = await datasetRes.json();
          setGoldenDatasetJson(JSON.stringify(data.dataset, null, 2));
        }
        if (historyRes.ok) {
          const histData = await historyRes.json();
          setHistoryRuns(histData.history || []);
        }
      } catch {}
    };
    init();
    return () => {
      active = false;
    };
  }, []);

  const parsedDataset: GoldenQuestion[] = useMemo(() => {
    try {
      const parsed = JSON.parse(goldenDatasetJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [goldenDatasetJson]);

  const handleStartBenchmark = useCallback(async () => {
    if (isRunning) return;
    let questions: GoldenQuestion[];
    try {
      questions = JSON.parse(goldenDatasetJson);
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Dataset must be a non-empty JSON array of questions.');
      }
      setDatasetError(null);
    } catch (err: any) {
      setDatasetError(err.message || 'Invalid JSON format in Golden Dataset editor.');
      return;
    }

    setIsRunning(true);
    setProgressPct(5);
    setCurrentStatusMsg(`Initializing benchmark across ${questions.length} questions...`);
    setActiveResults(null);

    try {
      const runRes = await fetch('/api/eval/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: selectedDocId,
          dataset: questions,
          modes: ['vector_raw', 'vector_rerank', 'vectorless'],
        }),
      });

      if (!runRes.ok) {
        throw new Error('Failed to start evaluation run.');
      }

      const runData = await runRes.json();
      const runId = runData.run_id;

      // Subscribe to Server-Sent Events
      const eventSource = new EventSource(`/api/eval/stream/${runId}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.progress_pct !== undefined) {
            setProgressPct(data.progress_pct);
          }

          if (data.status === 'started') {
            setCurrentStatusMsg(`Benchmarking ${data.total_questions} questions across ${data.modes.join(', ')}...`);
          } else if (data.status === 'progress') {
            setCurrentStatusMsg(`Question ${data.current_question}/${data.total_questions} [Pipeline: ${data.mode}]`);
          } else if (data.status === 'completed') {
            const results = data.results as Record<string, ModeMetrics>;
            setActiveResults(results);
            setCurrentStatusMsg('Evaluation benchmark complete! Persisted to SQLite.');
            setIsRunning(false);
            eventSource.close();
            loadHistory();

            // Real calculated faithfulness delta
            if (onTriggerToast && results?.vectorless && (results?.vector_rerank || results?.vector_raw)) {
              const vecFaith = (results.vector_rerank || results.vector_raw).faithfulness;
              const treeFaith = results.vectorless.faithfulness;
              const deltaPct = ((treeFaith - vecFaith) * 100).toFixed(1);
              const sign = Number(deltaPct) >= 0 ? '+' : '';
              onTriggerToast(
                `Benchmark complete! Tree faithfulness: ${(treeFaith * 100).toFixed(1)}% (${sign}${deltaPct}% vs Vector).`,
                'success'
              );
            }
          }
        } catch {}
      };

      eventSource.onerror = () => {
        eventSource.close();
        setIsRunning(false);
        setCurrentStatusMsg('SSE Stream closed.');
      };
    } catch (err: any) {
      setIsRunning(false);
      setCurrentStatusMsg(`Error: ${err.message}`);
    }
  }, [goldenDatasetJson, isRunning, loadHistory, onTriggerToast, selectedDocId]);

  // Keyboard shortcut: (Cmd/Ctrl + R) to run benchmark
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleStartBenchmark();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleStartBenchmark]);

  const handleExportJsonl = () => {
    const exportData = {
      benchmark_suite: 'rag_studio_golden_eval.jsonl',
      timestamp: new Date().toISOString(),
      question_count: parsedDataset.length,
      active_results: activeResults,
      history_runs: historyRuns,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rag_studio_eval_${Date.now()}.jsonl`;
    a.click();
    if (onTriggerToast) onTriggerToast('Benchmark results exported cleanly to JSONL', 'success');
  };

  // Derive active metrics from current active run, or latest history run, or null
  const currentMetrics = useMemo(() => {
    if (activeResults) {
      return {
        source: 'Live Evaluation Run',
        vector_raw: activeResults['vector_raw'] ?? null,
        vector_rerank: activeResults['vector_rerank'] ?? null,
        vectorless: activeResults['vectorless'] ?? null,
      };
    }

    if (historyRuns.length > 0) {
      const vRaw = historyRuns.find((r) => r.mode === 'vector_raw')?.metrics ?? null;
      const vRerank = historyRuns.find((r) => r.mode === 'vector_rerank')?.metrics ?? null;
      const vLess = historyRuns.find((r) => r.mode === 'vectorless')?.metrics ?? null;
      if (vRaw || vRerank || vLess) {
        return {
          source: 'Persisted SQLite WAL History',
          vector_raw: vRaw,
          vector_rerank: vRerank,
          vectorless: vLess,
        };
      }
    }

    return null;
  }, [activeResults, historyRuns]);

  // Format metric value helper
  const fmt = (val: number | undefined | null, isPct = false, decimals = 3): string => {
    if (val === undefined || val === null) return '--';
    if (isPct) return `${(val * 100).toFixed(1)}%`;
    return val.toFixed(decimals);
  };

  const fmtInt = (val: number | undefined | null): string => {
    if (val === undefined || val === null) return '--';
    return Math.round(val).toLocaleString();
  };

  const getDeltaBadge = (treeVal?: number, vecVal?: number, isHigherBetter = true) => {
    if (treeVal === undefined || vecVal === undefined || treeVal === null || vecVal === null) {
      return <span className="text-slate-400 font-mono text-[10px]">--</span>;
    }
    const diff = treeVal - vecVal;
    if (Math.abs(diff) < 0.0001) {
      return (
        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-[10px] border border-slate-300 dark:border-slate-700">
          PARITY
        </span>
      );
    }
    const isGood = isHigherBetter ? diff > 0 : diff < 0;
    const sign = diff > 0 ? '+' : '';
    const pct = (diff * 100).toFixed(1);
    return (
      <span
        className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] border ${
          isGood
            ? 'bg-yellow-400 text-slate-950 border-slate-900 shadow-2xs'
            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
        }`}
      >
        {sign}{pct}%
      </span>
    );
  };

  const vRaw = currentMetrics?.vector_raw;
  const vRerank = currentMetrics?.vector_rerank;
  const vLess = currentMetrics?.vectorless;
  const primaryVec = vRerank || vRaw;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5">
      {/* Top Benchmark Control Ribbon */}
      <div className="studio-card p-3.5 sm:p-5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded bg-yellow-400 text-slate-950 border border-slate-900 font-bold uppercase shadow-2xs">
                RAGAS EVAL LAB
              </span>
              <h2 className="font-black text-sm sm:text-base text-slate-950 dark:text-white">
                Comparative Benchmarking & Retrieval Matrix
              </h2>
            </div>
            <p className="text-[10px] sm:text-[11px] font-mono text-slate-600 dark:text-slate-400 mt-1">
              DATA SOURCE: <span className="font-bold text-slate-950 dark:text-white">{currentMetrics?.source ?? 'Unexecuted'}</span> | QUESTIONS: <span className="font-bold text-slate-950 dark:text-white">{parsedDataset.length}</span> | MODES: <span className="font-mono">vector_raw, vector_rerank, vectorless</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="flex rounded border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 shadow-xs">
              <button
                onClick={() => setActiveTab('matrix')}
                className={`px-3 py-1 rounded text-xs transition-colors font-bold ${
                  activeTab === 'matrix'
                    ? 'bg-[#facc15] text-slate-950 border border-slate-900 shadow-2xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                Benchmark Matrix
              </button>
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 rounded text-xs transition-colors font-bold ${
                  activeTab === 'editor'
                    ? 'bg-[#facc15] text-slate-950 border border-slate-900 shadow-2xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                Dataset Editor ({parsedDataset.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded text-xs transition-colors font-bold ${
                  activeTab === 'history'
                    ? 'bg-[#facc15] text-slate-950 border border-slate-900 shadow-2xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                History ({historyRuns.length})
              </button>
            </div>

            <button
              onClick={handleExportJsonl}
              className="studio-btn-ghost text-xs"
              title="Export results to JSONL"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSONL</span>
            </button>

            {/* Run Benchmark Button with Sibling <kbd> */}
            <button
              onClick={handleStartBenchmark}
              disabled={isRunning}
              className="studio-btn-primary disabled:opacity-50 text-xs"
              title="Execute full benchmark suite (Cmd+R / Ctrl+R)"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunning ? 'RUNNING SUITE...' : 'RUN BENCHMARK'}</span>
              <kbd className="ml-1 px-1 py-0.2 rounded bg-slate-950 text-yellow-400 border border-slate-900 text-[10px] font-mono font-bold">
                ⌘R
              </kbd>
            </button>
          </div>
        </div>

        {/* Progress Bar if Running */}
        {isRunning && (
          <div className="pt-2 space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-950 dark:text-slate-200 font-bold">
              <span className="truncate pr-2">{currentStatusMsg}</span>
              <span className="text-yellow-600 dark:text-yellow-400 font-black shrink-0">{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded border border-slate-900 dark:border-slate-700 overflow-hidden">
              <div
                className="h-full bg-yellow-400 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {activeTab === 'matrix' && (
        <>
          {/* Top 4 Core Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
            {/* Card 1: Faithfulness */}
            <div className="studio-card p-3.5 sm:p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">
                  Faithfulness (Groundedness)
                </span>
                {getDeltaBadge(vLess?.faithfulness, primaryVec?.faithfulness)}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-950 dark:text-white">
                  {fmt(vLess?.faithfulness, false, 3)}
                </span>
                <span className="text-xs text-slate-500">
                  vs {fmt(primaryVec?.faithfulness, false, 3)} (Vec)
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                Tree: <span className="font-bold text-slate-950 dark:text-white">{fmt(vLess?.faithfulness, true)}</span> | Vec: <span className="font-bold text-slate-950 dark:text-white">{fmt(primaryVec?.faithfulness, true)}</span>
              </div>
            </div>

            {/* Card 2: Answer Relevancy */}
            <div className="studio-card p-3.5 sm:p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">
                  Answer Relevancy
                </span>
                {getDeltaBadge(vLess?.answer_relevancy, primaryVec?.answer_relevancy)}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-950 dark:text-white">
                  {fmt(vLess?.answer_relevancy, false, 3)}
                </span>
                <span className="text-xs text-slate-500">
                  vs {fmt(primaryVec?.answer_relevancy, false, 3)} (Vec)
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                Tree: <span className="font-bold text-slate-950 dark:text-white">{fmt(vLess?.answer_relevancy, true)}</span> | Vec: <span className="font-bold text-slate-950 dark:text-white">{fmt(primaryVec?.answer_relevancy, true)}</span>
              </div>
            </div>

            {/* Card 3: Context Precision */}
            <div className="studio-card p-3.5 sm:p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">
                  Context Precision (SNR)
                </span>
                {getDeltaBadge(vLess?.context_precision, primaryVec?.context_precision)}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-950 dark:text-white">
                  {fmt(vLess?.context_precision, false, 3)}
                </span>
                <span className="text-xs text-slate-500">
                  vs {fmt(primaryVec?.context_precision, false, 3)} (Vec)
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                Tree: <span className="font-bold text-slate-950 dark:text-white">{fmt(vLess?.context_precision, true)}</span> | Vec: <span className="font-bold text-slate-950 dark:text-white">{fmt(primaryVec?.context_precision, true)}</span>
              </div>
            </div>

            {/* Card 4: Noise Sensitivity */}
            <div className="studio-card p-3.5 sm:p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">
                  Noise Sensitivity (Distractors)
                </span>
                {getDeltaBadge(vLess?.noise_sensitivity, primaryVec?.noise_sensitivity, false)}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-950 dark:text-white">
                  {fmt(vLess?.noise_sensitivity, false, 3)}
                </span>
                <span className="text-xs text-slate-500">
                  vs {fmt(primaryVec?.noise_sensitivity, false, 3)} (Vec)
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                Lower is better. Tree: <span className="font-bold text-slate-950 dark:text-white">{fmt(vLess?.noise_sensitivity, false, 3)}</span> | Vec: <span className="font-bold text-slate-950 dark:text-white">{fmt(primaryVec?.noise_sensitivity, false, 3)}</span>
              </div>
            </div>
          </div>

          {/* Full Head-to-Head Comparison Table Across ALL ModeMetrics */}
          <div className="studio-card overflow-hidden font-mono text-xs">
            <div className="bg-slate-100 dark:bg-[#0b1120] border-b-2 border-slate-900 dark:border-slate-800 p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-950 dark:text-yellow-400" />
                <h3 className="font-black text-xs uppercase tracking-wide text-slate-950 dark:text-white">
                  Complete Tri-Engine Head-to-Head Benchmark Table
                </h3>
              </div>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                {currentMetrics ? `${parsedDataset.length} Questions Evaluated` : 'Unexecuted (Press Run Suite)'}
              </span>
            </div>

            {!currentMetrics ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-lg bg-yellow-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 font-black shadow-xs">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h4 className="font-black text-sm text-slate-950 dark:text-white">
                  No benchmark results yet — run the suite above.
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Click the <strong>RUN BENCHMARK (⌘R)</strong> button to execute the evaluation across Vector Raw, Vector + FlashRank, and Tree Reasoning.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b-2 border-slate-900 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                      <th className="py-2.5 px-4">Metric Group & Name</th>
                      <th className="py-2.5 px-4">Vector Raw (Top-4)</th>
                      <th className="py-2.5 px-4">Vector + FlashRank</th>
                      <th className="py-2.5 px-4 bg-yellow-400/10 dark:bg-yellow-400/5">Vectorless Tree AST</th>
                      <th className="py-2.5 px-4">Delta (Tree vs Rerank)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-[11px]">
                    {/* SECTION 1: RAGAS QUALITY METRICS */}
                    <tr className="bg-slate-100/60 dark:bg-slate-900/60 font-bold text-[10px] text-slate-500 uppercase">
                      <td colSpan={5} className="py-1 px-4 tracking-wider">
                        RAGAS Generation & Quality Metrics (LLM-as-a-Judge)
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">Faithfulness (Groundedness)</td>
                      <td className="py-2.5 px-4">{fmt(vRaw?.faithfulness)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmt(vRerank?.faithfulness)}</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">{fmt(vLess?.faithfulness)}</td>
                      <td className="py-2.5 px-4">{getDeltaBadge(vLess?.faithfulness, vRerank?.faithfulness)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">Answer Relevancy</td>
                      <td className="py-2.5 px-4">{fmt(vRaw?.answer_relevancy)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmt(vRerank?.answer_relevancy)}</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">{fmt(vLess?.answer_relevancy)}</td>
                      <td className="py-2.5 px-4">{getDeltaBadge(vLess?.answer_relevancy, vRerank?.answer_relevancy)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">Context Precision (SNR)</td>
                      <td className="py-2.5 px-4">{fmt(vRaw?.context_precision)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmt(vRerank?.context_precision)}</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">{fmt(vLess?.context_precision)}</td>
                      <td className="py-2.5 px-4">{getDeltaBadge(vLess?.context_precision, vRerank?.context_precision)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">Context Recall (Coverage)</td>
                      <td className="py-2.5 px-4">{fmt(vRaw?.context_recall)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmt(vRerank?.context_recall)}</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">{fmt(vLess?.context_recall)}</td>
                      <td className="py-2.5 px-4">{getDeltaBadge(vLess?.context_recall, vRerank?.context_recall)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">Noise Sensitivity</td>
                      <td className="py-2.5 px-4">{fmt(vRaw?.noise_sensitivity)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmt(vRerank?.noise_sensitivity)}</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">{fmt(vLess?.noise_sensitivity)}</td>
                      <td className="py-2.5 px-4">{getDeltaBadge(vLess?.noise_sensitivity, vRerank?.noise_sensitivity, false)}</td>
                    </tr>

                    {/* SECTION 2: RERANKER & RETRIEVAL IR METRICS */}
                    <tr className="bg-slate-100/60 dark:bg-slate-900/60 font-bold text-[10px] text-slate-500 uppercase">
                      <td colSpan={5} className="py-1 px-4 tracking-wider">
                        Reranker & Information Retrieval (Zero-LLM Deterministic Math)
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">MRR (Mean Reciprocal Rank)</td>
                      <td className="py-2.5 px-4">{fmt(vRaw?.mrr)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmt(vRerank?.mrr)}</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">{fmt(vLess?.mrr)}</td>
                      <td className="py-2.5 px-4">{getDeltaBadge(vLess?.mrr, vRerank?.mrr)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">nDCG@4 (Discounted Cumulative Gain)</td>
                      <td className="py-2.5 px-4">{fmt(vRaw?.ndcg_4)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmt(vRerank?.ndcg_4)}</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">{fmt(vLess?.ndcg_4)}</td>
                      <td className="py-2.5 px-4">{getDeltaBadge(vLess?.ndcg_4, vRerank?.ndcg_4)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">HitRate@1</td>
                      <td className="py-2.5 px-4">{fmt(vRaw?.hit_rate_1, true)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmt(vRerank?.hit_rate_1, true)}</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">{fmt(vLess?.hit_rate_1, true)}</td>
                      <td className="py-2.5 px-4">{getDeltaBadge(vLess?.hit_rate_1, vRerank?.hit_rate_1)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">HitRate@4</td>
                      <td className="py-2.5 px-4">{fmt(vRaw?.hit_rate_4, true)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmt(vRerank?.hit_rate_4, true)}</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">{fmt(vLess?.hit_rate_4, true)}</td>
                      <td className="py-2.5 px-4">{getDeltaBadge(vLess?.hit_rate_4, vRerank?.hit_rate_4)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">AvgRankDelta (Rerank Shift)</td>
                      <td className="py-2.5 px-4">0.0</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">+{fmt(vRerank?.avg_rank_delta, false, 1)} pos</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">N/A (AST)</td>
                      <td className="py-2.5 px-4"><span className="text-slate-400">--</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">RecallDropOffRate</td>
                      <td className="py-2.5 px-4">0.0%</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmt(vRerank?.recall_dropoff, true)}</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">0.0%</td>
                      <td className="py-2.5 px-4">{getDeltaBadge(0, vRerank?.recall_dropoff, false)}</td>
                    </tr>

                    {/* SECTION 3: SYSTEM COST & TOKEN FOOTPRINT */}
                    <tr className="bg-slate-100/60 dark:bg-slate-900/60 font-bold text-[10px] text-slate-500 uppercase">
                      <td colSpan={5} className="py-1 px-4 tracking-wider">
                        Operational Latency & Compute Token Cost
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">Average Total Latency</td>
                      <td className="py-2.5 px-4">{fmt(vRaw?.avg_latency_ms, false, 1)}ms</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmt(vRerank?.avg_latency_ms, false, 1)}ms</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">{fmt(vLess?.avg_latency_ms, false, 1)}ms</td>
                      <td className="py-2.5 px-4">
                        {vLess?.avg_latency_ms && vRerank?.avg_latency_ms ? (
                          <span className="font-mono font-bold text-[10px]">
                            {(vLess.avg_latency_ms - vRerank.avg_latency_ms) > 0 ? '+' : ''}{(vLess.avg_latency_ms - vRerank.avg_latency_ms).toFixed(1)}ms
                          </span>
                        ) : '--'}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">Context Tokens Used</td>
                      <td className="py-2.5 px-4">{fmtInt(vRaw?.context_tokens)} tk</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmtInt(vRerank?.context_tokens)} tk</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">{fmtInt(vLess?.context_tokens)} tk</td>
                      <td className="py-2.5 px-4">
                        {vLess?.context_tokens && vRerank?.context_tokens ? (
                          <span className="font-mono font-bold text-[10px] text-emerald-600 dark:text-emerald-400">
                            {Math.round(vLess.context_tokens - vRerank.context_tokens)} tk
                          </span>
                        ) : '--'}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">Prompt Tokens Saved</td>
                      <td className="py-2.5 px-4">0 tk</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">{fmtInt(vRerank?.tokens_saved)} tk</td>
                      <td className="py-2.5 px-4 font-black bg-yellow-400/10 dark:bg-yellow-400/5 text-slate-950 dark:text-yellow-400">Pruned Subtrees</td>
                      <td className="py-2.5 px-4"><span className="text-slate-400">--</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Golden Dataset JSON Editor Tab */}
      {activeTab === 'editor' && (
        <div className="studio-card p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b-2 border-slate-900 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-slate-950 dark:text-yellow-400" />
              <h3 className="font-black text-slate-950 dark:text-white uppercase text-xs">
                Golden Benchmark Dataset Editor (JSON Array)
              </h3>
            </div>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">
              {parsedDataset.length} Questions Loaded
            </span>
          </div>

          <textarea
            value={goldenDatasetJson}
            onChange={(e) => setGoldenDatasetJson(e.target.value)}
            rows={18}
            className="w-full bg-white dark:bg-[#090d16] border-2 border-slate-900 dark:border-slate-700 rounded p-3 text-slate-950 dark:text-slate-200 text-xs font-mono focus:outline-none focus:border-yellow-400 leading-relaxed shadow-xs"
          />

          {datasetError && (
            <p className="text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/40 p-2 rounded border-2 border-red-900 text-xs font-bold">
              {datasetError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                fetch('/api/eval/golden_dataset')
                  .then((res) => res.json())
                  .then((data) => {
                    setGoldenDatasetJson(JSON.stringify(data.dataset, null, 2));
                    if (onTriggerToast) onTriggerToast('Reset dataset to default 5-question golden benchmark');
                  });
              }}
              className="studio-btn-ghost"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset to Default</span>
            </button>
          </div>
        </div>
      )}

      {/* Historical Evaluation Runs Tab */}
      {activeTab === 'history' && (
        <div className="studio-card p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b-2 border-slate-900 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-950 dark:text-yellow-400" />
              <h3 className="font-black text-slate-950 dark:text-white uppercase text-xs">
                Historical Benchmark Runs (Persisted in SQLite WAL)
              </h3>
            </div>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">{historyRuns.length} recorded runs</span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800/80 max-h-[480px] overflow-y-auto">
            {historyRuns.length > 0 ? (
              historyRuns.map((run) => (
                <div key={run.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-950 dark:text-slate-100">{run.run_name}</span>
                      <span className="px-1.5 py-0.5 rounded bg-yellow-400 text-slate-950 font-bold border border-slate-900 text-[10px]">
                        {run.mode}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      {new Date(run.created_at).toLocaleString()} | Latency: {run.latency_ms}ms
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Faithfulness</span>
                      <span className="text-slate-950 dark:text-white font-black">{run.metrics?.faithfulness?.toFixed(3) ?? '--'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">MRR</span>
                      <span className="text-slate-950 dark:text-white font-black">{run.metrics?.mrr?.toFixed(3) ?? '--'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">nDCG@4</span>
                      <span className="text-slate-950 dark:text-white font-black">{run.metrics?.ndcg_4?.toFixed(3) ?? '--'}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">
                No historical evaluation runs recorded yet. Click "RUN BENCHMARK" to execute the test suite.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
