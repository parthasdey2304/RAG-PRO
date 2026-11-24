import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  X,
  Play
} from 'lucide-react';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  onTriggerToast?: (msg: string, type?: 'default' | 'success' | 'warning' | 'error') => void;
}

export const IngestModal: React.FC<IngestModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  onTriggerToast,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [strategy, setStrategy] = useState('Markdown Header AST + Semantic Boundary');
  const [maxTokens, setMaxTokens] = useState(512);
  const [overlap, setOverlap] = useState(64);
  const [genVectors, setGenVectors] = useState(true);
  const [genTree, setGenTree] = useState(true);
  const [pinRam, setPinRam] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!file) {
      setErrorMsg('Please select or drag a document file to ingest.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Upload failed');
      }

      onUploadSuccess();
      if (onTriggerToast) {
        onTriggerToast(`Document "${file.name}" ingested and indexed into tree AST!`, 'success');
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error uploading and indexing document');
    } finally {
      setIsUploading(false);
    }
  }, [file, onClose, onUploadSuccess, onTriggerToast]);

  // Keyboard navigation: ESC to close, Cmd/Ctrl+Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleSubmit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="w-full max-w-xl studio-card bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="bg-slate-50 dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-yellow-400 text-slate-950 border border-slate-900 shadow-2xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Ingest New Document AST
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400 text-slate-950 border border-slate-900 font-bold">
                  AST-PIPELINE v2
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                Build dual indices: LanceDB HNSW vectors + SQLite WAL tree reasoning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-[10px] text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              ESC
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Form */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* File Dropzone */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
              }
            }}
            accept=".pdf,.txt,.md,.jsonl,.tex"
            className="hidden"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                setFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed p-4 rounded-lg text-center cursor-pointer transition-colors ${
              isDragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                : 'border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-900/50'
            }`}
          >
            <Upload className="w-5 h-5 mx-auto mb-1.5 text-blue-600 dark:text-blue-400" />
            <p className="text-slate-800 dark:text-slate-200 text-xs font-sans font-medium">
              {file ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              ) : (
                'Drop research papers, PDF, markdown, or code tree here'
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">.pdf</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">.md</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">.txt</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">.jsonl</span>
              <span className="ml-1 text-slate-400">Max 100MB</span>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">CHUNKING STRATEGY:</span>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-slate-200 text-xs shadow-xs"
              >
                <option>Markdown Header AST + Semantic Boundary</option>
                <option>Recursive Character (512 tk)</option>
                <option>Token-Fixed Window (256 tk)</option>
              </select>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">AST PARSER ENGINE:</span>
              <select className="w-full bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-slate-200 text-xs shadow-xs">
                <option>tree-sitter-cst native (v0.21)</option>
                <option>Regex Section Boundary</option>
              </select>
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-600 dark:text-slate-400">Max Token Window:</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{maxTokens} tk</span>
              </div>
              <input
                type="range"
                min={128}
                max={2048}
                step={64}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-600 dark:text-slate-400">Chunk Overlap:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">{overlap} tk (12.5%)</span>
              </div>
              <input
                type="range"
                min={0}
                max={256}
                step={16}
                value={overlap}
                onChange={(e) => setOverlap(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>

          {/* Engine Checkboxes */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
              <input
                type="checkbox"
                checked={genVectors}
                onChange={(e) => setGenVectors(e.target.checked)}
                className="rounded accent-blue-500"
              />
              <span>Generate Dense Vector Embeddings (1024-dim, LanceDB)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
              <input
                type="checkbox"
                checked={genTree}
                onChange={(e) => setGenTree(e.target.checked)}
                className="rounded accent-blue-500"
              />
              <span>Build Hierarchical Tree-Reasoning Index (SQLite WAL)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
              <input
                type="checkbox"
                checked={pinRam}
                onChange={(e) => setPinRam(e.target.checked)}
                className="rounded accent-blue-500"
              />
              <span>Pin & Cache in Local RAM (AVX-512 unified memory)</span>
            </label>
          </div>

          {errorMsg && (
            <p className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-200 dark:border-red-800 text-[11px]">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Action Footer */}
        <div className="bg-slate-50 dark:bg-[#0b1120] border-t border-slate-200 dark:border-slate-800 px-4 sm:px-5 py-3 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            Estimated Parse: ~180ms
          </span>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="studio-btn-ghost text-xs">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isUploading}
              className="studio-btn-primary disabled:opacity-50 text-xs"
            >
              {isUploading ? (
                <span>INDEXING...</span>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Build & Index Tree</span>
                  <span className="hidden sm:inline-block text-[10px] px-1 rounded bg-slate-950 text-yellow-400 border border-slate-900 font-bold">⌘↵</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
