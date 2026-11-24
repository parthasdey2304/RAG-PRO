import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Zap
} from 'lucide-react';

export interface TourStep {
  targetSelector: string;
  tab?: 'arena' | 'docs' | 'eval' | 'traces' | 'settings';
  moduleTag: string;
  title: string;
  description: string;
  proTip?: string;
  preferredPlacement?: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="header-telemetry"]',
    tab: 'arena',
    moduleTag: 'SYSTEM & TELEMETRY',
    title: '1. Local Inference & System Telemetry',
    description:
      'Monitors real-time connectivity with your local Ollama daemon (target model: qwen2.5:3b), SQLite WAL storage, and LanceDB vector store. Features an instant zero-FOUC Light and Dark theme toggle.',
    proTip: 'RAG Studio runs 100% locally with zero cloud dependencies, API credit costs, or rate limits.',
    preferredPlacement: 'bottom',
  },
  {
    targetSelector: '[data-tour="doc-ingest-controls"]',
    tab: 'arena',
    moduleTag: 'CORPUS MANAGEMENT',
    title: '2. Dual-Pipeline Document Ingestion',
    description:
      'Upload local PDF, Markdown, or text documents via [⌘+I] or load the pre-built Architecture Blueprint. Each document is simultaneously ingested into LanceDB as 512-character vector chunks and parsed into a hierarchical AST tree in SQLite.',
    proTip: 'Click "LOAD BLUEPRINT" anytime to seed an engineering blueprint without uploading files.',
    preferredPlacement: 'bottom',
  },
  {
    targetSelector: '[data-tour="arena-query-bar"]',
    tab: 'arena',
    moduleTag: 'RETRIEVAL ARENA',
    title: '3. Simultaneous Dual-Engine Query Bar',
    description:
      'Type any query or choose an engineering preset. Hitting Enter fires POST /api/query in parallel against both Standard Vector + FlashRank (Left) and Vectorless Tree-Reasoning (Right) for true side-by-side benchmarking.',
    proTip: 'Press Enter in the query input to execute simultaneous dual retrieval.',
    preferredPlacement: 'bottom',
  },
  {
    targetSelector: '[data-tour="arena-vector-pane"]',
    tab: 'arena',
    moduleTag: 'VECTOR + RERANK',
    title: '4. Vector Retrieval & FlashRank Reranker',
    description:
      'Queries LanceDB for Top-15 semantic candidates, then passes them to FlashRank (ms-marco-MiniLM-L-12-v2) on CPU. Live rank shift badges display before_rank → after_rank delta shifts to prove reranking impact.',
    proTip: 'FlashRank runs on CPU ONNX with zero GPU VRAM consumption, eliminating vector false positives.',
    preferredPlacement: 'right',
  },
  {
    targetSelector: '[data-tour="arena-vectorless-pane"]',
    tab: 'arena',
    moduleTag: 'VECTORLESS RAG',
    title: '5. Vectorless Tree-Reasoning RAG',
    description:
      'Completely bypasses dense vector embeddings. Passes the lightweight structural JSON document skeleton to qwen2.5:3b with structured output, then resolves exact text sections directly from SQLite.',
    proTip: 'Inspect the "HIERARCHICAL TRAVERSAL STEP TRACE" to see the structural path traversed by the LLM.',
    preferredPlacement: 'left',
  },
  {
    targetSelector: '[data-tour="arena-metrics-summary"]',
    tab: 'arena',
    moduleTag: 'LATENCY & COST',
    title: '6. Side-by-Side Latency & Token Efficiency',
    description:
      'Compares end-to-end execution latency (embedding, vector search, rerank, tree reasoning) and Jaccard token overlap between both engines for every single prompt.',
    proTip: 'Vectorless RAG often saves 40-70% prompt tokens by extracting only exact relevant sections.',
    preferredPlacement: 'top',
  },
  {
    targetSelector: '[data-tour="docs-tree-viewer"]',
    tab: 'docs',
    moduleTag: 'DOCUMENT INSPECTOR',
    title: '7. Hierarchical Section Tree vs. Chunks',
    description:
      'Inspect your document outline tree (H1/H2/H3/sections/pages) parsed by PyMuPDF alongside raw vector chunks. Examine individual node metadata, copy AST JSON schemas, and test chunking strategies.',
    proTip: 'Hierarchical AST indexing preserves nested document context that standard sliding-window chunking breaks.',
    preferredPlacement: 'left',
  },
  {
    targetSelector: '[data-tour="traces-flamegraph"]',
    tab: 'traces',
    moduleTag: 'TELEMETRY & TRACES',
    title: '8. Sub-Millisecond Flamegraph Attribution',
    description:
      'Inspect millisecond execution flamegraphs for every query. Trace spans isolate Embedding, Vector Search, FlashRank Rerank, Tree Reasoning, and Text Resolution with zero hardcoded mock fixtures.',
    proTip: 'Filter by engine mode (Vector, Tree, or Dual-Arena) and analyze P50/P95 latency percentiles.',
    preferredPlacement: 'bottom',
  },
  {
    targetSelector: '[data-tour="eval-golden-editor"]',
    tab: 'eval',
    moduleTag: 'EVALUATION LAB',
    title: '9. In-Browser Golden Dataset Editor',
    description:
      'Backed by GET /api/eval/golden_dataset. View, customize, or upload your golden reference QA dataset containing questions, ground truths, and target section attributions.',
    proTip: 'Customize test questions directly in-browser to evaluate retrieval accuracy on your own domain data.',
    preferredPlacement: 'bottom',
  },
  {
    targetSelector: '[data-tour="eval-run-btn"]',
    tab: 'eval',
    moduleTag: 'BENCHMARK ENGINE',
    title: '10. Running Head-to-Head Benchmarks',
    description:
      'Triggers asynchronous background evaluation across Vector Raw, Vector + FlashRank, and Vectorless Tree-Reasoning. Live execution progress streams in real time via Server-Sent Events (SSE).',
    proTip: 'Press [⌘R] or [Ctrl+R] anywhere in the Eval Lab to instantly run the full evaluation suite.',
    preferredPlacement: 'bottom',
  },
  {
    targetSelector: '[data-tour="eval-metrics-matrix"]',
    tab: 'eval',
    moduleTag: 'METRICS MATRIX',
    title: '11. RAGAS & Deterministic IR Metrics',
    description:
      'Evaluates all 5 RAGAS semantic scores (Faithfulness, Answer Relevancy, Context Precision, Context Recall, Noise Sensitivity) alongside 6 deterministic IR metrics (MRR, nDCG@4, HitRate@1, HitRate@4, AvgRankDelta, RecallDropOffRate).',
    proTip: 'Deterministic IR metrics require zero LLM calls, providing mathematical proof of reranker quality.',
    preferredPlacement: 'top',
  },
  {
    targetSelector: '[data-tour="eval-cost-history"]',
    tab: 'eval',
    moduleTag: 'SYSTEM COST & HISTORY',
    title: '12. System Cost & Regression Tracking',
    description:
      'Compare Context Tokens Used and Prompt Tokens Saved across all modes. The History tab pulls previous runs from GET /api/eval/history to ensure new retrieval prompts never cause silent regressions.',
    proTip: 'Export benchmark results to JSONL anytime for external CI/CD regression verification.',
    preferredPlacement: 'top',
  },
];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'arena' | 'docs' | 'eval' | 'traces' | 'settings';
  setActiveTab: (tab: 'arena' | 'docs' | 'eval' | 'traces' | 'settings') => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = TOUR_STEPS[currentStepIndex];

  // Sync tab and update spotlight target rect
  const updateTargetRect = useCallback(() => {
    if (!isOpen || !currentStep) return;

    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentStep]);

  // Navigate to target tab and measure element
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    if (currentStep.tab && currentStep.tab !== activeTab) {
      setActiveTab(currentStep.tab);
    }

    // Allow DOM to mount/render on tab switch
    const timer = setTimeout(() => {
      const el = document.querySelector(currentStep.targetSelector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }

      // Re-measure after scroll settling
      setTimeout(() => {
        updateTargetRect();
      }, 150);
    }, 120);

    return () => clearTimeout(timer);
  }, [isOpen, currentStepIndex, currentStep, activeTab, setActiveTab, updateTargetRect]);

  // Handle window resize and scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateTargetRect]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (currentStepIndex < TOUR_STEPS.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, onClose]);

  if (!isOpen || !currentStep) return null;

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Compute smart tooltip coordinates
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const isMobile = vw < 640;

  let tooltipStyle: React.CSSProperties = {};

  if (isMobile) {
    // On mobile devices, dock comfortably at bottom with clean margin to prevent any overflow
    const mobileWidth = Math.min(vw - 24, 360);
    tooltipStyle = {
      position: 'fixed',
      bottom: '16px',
      left: `${Math.max(12, (vw - mobileWidth) / 2)}px`,
      width: `${mobileWidth}px`,
      zIndex: 9999,
    };
  } else if (targetRect) {
    const tooltipWidth = 420;
    const tooltipEstimatedHeight = 290;
    const padding = 20;

    let top = 0;
    let left = targetRect.left + (targetRect.width - tooltipWidth) / 2;

    const spaceBelow = vh - targetRect.bottom;
    const spaceAbove = targetRect.top;

    if (currentStep.preferredPlacement === 'top' && spaceAbove >= tooltipEstimatedHeight + padding) {
      top = targetRect.top - tooltipEstimatedHeight - 16;
    } else if (spaceBelow >= tooltipEstimatedHeight + padding) {
      top = targetRect.bottom + 16;
    } else if (spaceAbove >= tooltipEstimatedHeight + padding) {
      top = targetRect.top - tooltipEstimatedHeight - 16;
    } else {
      top = Math.max(padding, targetRect.bottom + 12);
    }

    // Clamp horizontally and vertically
    left = Math.max(padding, Math.min(left, vw - tooltipWidth - padding));
    top = Math.max(padding, Math.min(top, vh - tooltipEstimatedHeight - padding));

    tooltipStyle = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 9999,
    };
  } else {
    // Centered fallback
    const tooltipWidth = Math.min(vw - 32, 420);
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${tooltipWidth}px`,
      zIndex: 9999,
    };
  }

  const spotlightStyle: React.CSSProperties = targetRect
    ? {
        position: 'fixed',
        top: `${targetRect.top - 6}px`,
        left: `${targetRect.left - 6}px`,
        width: `${targetRect.width + 12}px`,
        height: `${targetRect.height + 12}px`,
        boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.72), 0 0 20px rgba(250, 204, 21, 0.5)',
        border: '3px solid #facc15',
        borderRadius: '8px',
        pointerEvents: 'none',
        zIndex: 9998,
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }
    : {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.72)',
        zIndex: 9998,
        pointerEvents: 'none',
      };

  return createPortal(
    <div className="fixed inset-0 z-[9990] overflow-hidden select-none animate-in fade-in duration-200">
      {/* Background Dimmer & Spotlight Box */}
      <div style={spotlightStyle} aria-hidden="true" />

      {/* Floating Neo-Brutalist Tour Tooltip Card */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        className="bg-white dark:bg-[#0f172a] border-2 border-slate-900 dark:border-slate-700 border-b-4 border-r-4 rounded-lg shadow-2xl p-4 sm:p-5 flex flex-col space-y-3.5 animate-in fade-in zoom-in-95 duration-150 transition-all"
      >
        {/* Card Header: Step Counter Badge + Module Tag + Close Button */}
        <div className="flex items-center justify-between gap-2 border-b-2 border-slate-900/20 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#facc15] text-slate-950 border border-slate-900 font-black tracking-wide shadow-2xs">
              STEP {String(currentStepIndex + 1).padStart(2, '0')} / {String(TOUR_STEPS.length).padStart(2, '0')}
            </span>
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              {currentStep.moduleTag}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded border border-slate-900 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Skip Tour (Esc)"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card Body: Title & Technical Explanation */}
        <div className="space-y-2">
          <h3 id="tour-step-title" className="font-black text-sm sm:text-base text-slate-950 dark:text-white tracking-tight">
            {currentStep.title}
          </h3>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
            {currentStep.description}
          </p>
        </div>

        {/* Optional Pro-Tip Callout Box */}
        {currentStep.proTip && (
          <div className="p-2.5 rounded bg-yellow-400/10 dark:bg-yellow-400/10 border-l-4 border-l-[#facc15] border border-slate-900/10 dark:border-slate-800 text-[11px] font-mono flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5 fill-current" />
            <div className="text-slate-800 dark:text-slate-200 leading-snug">
              <span className="font-bold text-slate-950 dark:text-yellow-400 mr-1">PRO TIP:</span>
              {currentStep.proTip}
            </div>
          </div>
        )}

        {/* Interactive Step Indicator Dots (Clickable) */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {TOUR_STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStepIndex(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentStepIndex
                  ? 'w-6 bg-[#facc15] border border-slate-900'
                  : 'w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-500'
              }`}
              title={`Go to step ${idx + 1}`}
              aria-label={`Step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Card Footer: Navigation Controls */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs font-mono">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="studio-btn-ghost text-xs px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <span className="hidden sm:inline text-[10px] text-slate-500">
            [← / → Navigate] [Esc Exit]
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 px-2 py-1 font-bold cursor-pointer"
            >
              Skip
            </button>

            <button
              onClick={handleNext}
              className="studio-btn-primary text-xs px-3 py-1 cursor-pointer"
            >
              <span>{currentStepIndex === TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
