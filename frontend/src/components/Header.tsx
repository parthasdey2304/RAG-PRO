import React from 'react';
import {
  Layers,
  Cpu,
  Database,
  PlayCircle,
  FileText,
  BarChart3,
  Activity,
  Settings,
  Bell,
  Upload,
  HardDrive
} from 'lucide-react';
import type { HealthStatus } from '../types';

interface HeaderProps {
  activeTab: 'arena' | 'docs' | 'eval' | 'traces' | 'settings';
  setActiveTab: (tab: 'arena' | 'docs' | 'eval' | 'traces' | 'settings') => void;
  health: HealthStatus | null;
  docsCount: number;
  unreadNotificationsCount: number;
  onOpenNotifications: () => void;
  onOpenIngestModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  health,
  docsCount,
  unreadNotificationsCount,
  onOpenNotifications,
  onOpenIngestModal,
}) => {
  const isOllamaOnline = health?.ollama?.status === 'connected';

  const navItems = [
    { id: 'arena' as const, label: 'Retrieval Arena', icon: PlayCircle },
    { id: 'docs' as const, label: 'Docs & Tree', icon: FileText },
    { id: 'eval' as const, label: 'RAGAS Eval Lab', icon: BarChart3 },
    { id: 'traces' as const, label: 'Telemetry & Traces', icon: Activity },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <header className="border-b border-slate-800 bg-[#0b1120] px-4 sm:px-6 py-2.5 sticky top-0 z-30 select-none">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left: Brand & Engine Architecture */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-mono font-bold text-xs shadow-sm">
              RAG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-white">
                  RAG Studio
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  v2.4 LOCAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Vector + FlashRank vs. Hierarchical Tree-Reasoning
              </p>
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-1.5 pl-3 border-l border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
              <HardDrive className="w-3 h-3 text-emerald-400" />
              RAM: 1.42 GB / 16 GB
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
              <Cpu className="w-3 h-3 text-cyan-400" />
              AVX-512 ON
            </span>
          </div>
        </div>

        {/* Center: Main Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Quick Actions & Notification Bell */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {/* Engine Status Indicators */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] ${
                isOllamaOnline
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
                  : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              }`}
              title={isOllamaOnline ? 'Ollama running locally' : 'Using heuristic fallback response'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOllamaOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>OLLAMA</span>
            </div>

            <div className="flex items-center gap-1 px-2 py-1 rounded border border-slate-800 bg-slate-900 text-slate-300 text-[11px]">
              <Database className="w-3 h-3 text-cyan-400" />
              <span>SQLITE WAL</span>
            </div>

            <div className="flex items-center gap-1 px-2 py-1 rounded border border-slate-800 bg-slate-900 text-slate-300 text-[11px]">
              <Layers className="w-3 h-3 text-blue-400" />
              <span>LANCE</span>
            </div>

            <div className="flex items-center gap-1 px-2 py-1 rounded border border-slate-800 bg-slate-900 text-slate-300 text-[11px]">
              <FileText className="w-3 h-3 text-slate-400" />
              <span>{docsCount} DOCS</span>
            </div>
          </div>

          {/* Quick Ingest Button */}
          <button
            onClick={onOpenIngestModal}
            className="studio-btn-primary"
            title="Ingest new document AST (Cmd+I)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ingest</span>
          </button>

          {/* Notification Bell with Badge */}
          <button
            onClick={onOpenNotifications}
            className="relative p-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="System Telemetry & Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#0b1120]">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
