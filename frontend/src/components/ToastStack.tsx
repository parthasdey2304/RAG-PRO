import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, Undo2 } from 'lucide-react';
import type { StudioToast } from '../types';

interface ToastStackProps {
  toasts: StudioToast[];
  onDismiss: (id: string) => void;
}

export const ToastStack: React.FC<ToastStackProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full select-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: StudioToast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const [secondsLeft, setSecondsLeft] = useState(toast.durationSeconds || 5);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onDismiss();
      return;
    }
    const timer = setInterval(() => setSecondsLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, onDismiss]);

  const isSuccess = toast.type === 'success';
  const isWarning = toast.type === 'warning';
  const isError = toast.type === 'error';

  return (
    <div className="p-3 rounded-lg bg-[#0f172a] border border-slate-700 shadow-2xl text-xs font-mono text-slate-200 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center gap-2 min-w-0">
        {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
        {isError && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
        {!isSuccess && !isWarning && !isError && <Info className="w-4 h-4 text-blue-400 shrink-0" />}

        <span className="truncate text-slate-100 font-medium font-sans text-xs">
          {toast.message}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {toast.undoAction && (
          <button
            onClick={() => {
              toast.undoAction!();
              onDismiss();
            }}
            className="text-amber-400 hover:underline text-[11px] font-semibold flex items-center gap-1"
          >
            <Undo2 className="w-3 h-3" />
            <span>Undo ({secondsLeft}s)</span>
          </button>
        )}

        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-0.5 rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
