import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers,
  Database,
  PlayCircle,
  FileText,
  BarChart3,
  Activity,
  Settings,
  Bell,
  Upload,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  Cpu
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
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  health,
  docsCount,
  unreadNotificationsCount,
  onOpenNotifications,
  onOpenIngestModal,
  theme,
  toggleTheme,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const isOllamaOnline = health?.ollama?.status === 'connected';
  const targetModel = health?.ollama?.target_gen_model ?? 'offline';

  const closeMenu = (callback?: () => void) => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsMobileMenuOpen(false);
      setIsClosing(false);
      if (callback) callback();
    }, 220);
  };

  const openMenu = () => {
    setIsClosing(false);
    setIsMobileMenuOpen(true);
  };

  const navItems = [
    {
      id: 'arena' as const,
      label: 'Retrieval Arena',
      subtitle: 'Side-by-side Vector + FlashRank vs. Tree-Reasoning',
      icon: PlayCircle,
    },
    {
      id: 'docs' as const,
      label: 'Docs & Tree',
      subtitle: 'Hierarchical AST visualizer and document indexer',
      icon: FileText,
    },
    {
      id: 'eval' as const,
      label: 'RAGAS Eval Lab',
      subtitle: 'Benchmarking matrix with IR metrics & LLM-as-a-judge',
      icon: BarChart3,
    },
    {
      id: 'traces' as const,
      label: 'Telemetry & Traces',
      subtitle: 'Millisecond span latency flamegraph attribution',
      icon: Activity,
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      subtitle: 'Hardware compute ceiling, thread workers & telemetry',
      icon: Settings,
    },
  ];

  // Lock background scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobileMenuOpen]);

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen && !isClosing) {
        closeMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, isClosing]);

  const handleNavClick = (tab: 'arena' | 'docs' | 'eval' | 'traces' | 'settings') => {
    setActiveTab(tab);
    closeMenu();
  };

  // Top-down full-screen drawer content rendered via createPortal directly on body
  const mobileDrawerContent = isMobileMenuOpen ? (
    <div
      className={`fixed inset-0 z-50 md:hidden flex flex-col bg-slate-50 dark:bg-[#090d16] select-none ${
        isClosing ? 'animate-slide-up' : 'animate-slide-down'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Menu"
    >
      {/* Top Drawer Header with Brand, Theme Toggle, and Close Button */}
      <div className="flex items-center justify-between p-4 border-b-2 border-slate-900 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0b1120]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#facc15] border-2 border-slate-900 flex items-center justify-center text-slate-950 font-mono font-black text-sm shadow-xs">
            RAG
          </div>
          <div>
            <span className="font-black text-base tracking-tight text-slate-950 dark:text-white">
              RAG Studio
            </span>
            <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-400 text-slate-950 border border-slate-900 font-bold">
              STUDIO
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle inside Drawer */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-yellow-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-950" />
            )}
          </button>

          {/* Close Button */}
          <button
            onClick={() => closeMenu()}
            className="p-2 rounded border-2 border-slate-900 dark:border-slate-700 bg-[#facc15] text-slate-950 hover:bg-yellow-300 transition-colors cursor-pointer shadow-xs font-bold"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Navigation Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Navigation Section */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 px-1">
            WORKBENCH NAVIGATION
          </span>

          <div className="space-y-2.5 pt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full text-left p-3.5 rounded-lg border-2 border-slate-900 dark:border-slate-700 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isActive
                      ? 'bg-[#facc15] text-slate-950 border-b-4 border-r-4 border-slate-900 font-bold shadow-xs'
                      : 'bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 border-b-3 border-r-3 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded border border-slate-900 ${isActive ? 'bg-slate-950 text-[#facc15]' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'}`}>
                      <Icon className="w-5 h-5 shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate">
                          {item.label}
                        </span>
                        {isActive && (
                          <span className="text-[10px] px-1 rounded bg-slate-950 text-[#facc15] font-mono font-bold uppercase">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${isActive ? 'text-slate-800' : 'text-slate-500 dark:text-slate-400'}`}>
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-slate-950 translate-x-0.5' : 'text-slate-400'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="space-y-2 pt-2">
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 px-1">
            ACTIONS
          </span>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => {
                closeMenu(() => onOpenIngestModal());
              }}
              className="p-3 rounded-lg bg-[#facc15] text-slate-950 border-2 border-slate-900 border-b-4 border-r-4 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs active:translate-x-0.5 active:translate-y-0.5"
            >
              <Upload className="w-4 h-4" />
              <span>Ingest Document</span>
            </button>

            <button
              onClick={() => {
                closeMenu(() => onOpenNotifications());
              }}
              className="p-3 rounded-lg bg-white dark:bg-[#0f172a] border-2 border-slate-900 dark:border-slate-700 border-b-4 border-r-4 text-slate-950 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs active:translate-x-0.5 active:translate-y-0.5 relative"
            >
              <Bell className="w-4 h-4" />
              <span>System Alerts</span>
              {unreadNotificationsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-yellow-400 text-slate-950 border border-slate-900 text-[10px] font-bold">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Local Engine Live Status Info (Real Model and Status) */}
        <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 border-b-4 border-r-4 space-y-2.5 font-mono text-xs">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 text-[11px] font-bold border-b border-slate-200 dark:border-slate-800 pb-1.5">
            <span className="uppercase tracking-wider">LIVE TELEMETRY STACK</span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              100% LOCAL
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-slate-50 dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-500">Model:</span>
              <span className="font-bold text-slate-900 dark:text-white truncate max-w-[100px]" title={targetModel}>
                {targetModel}
              </span>
            </div>

            <div className="p-2 rounded bg-slate-50 dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-500">Ollama:</span>
              <span className={`font-bold ${isOllamaOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isOllamaOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="p-2 rounded bg-slate-50 dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-500">Store:</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">SQLite WAL</span>
            </div>

            <div className="p-2 rounded bg-slate-50 dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-500">Docs:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{docsCount} docs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t-2 border-slate-900 dark:border-slate-800 bg-white dark:bg-[#0b1120] text-center text-[10px] font-mono text-slate-500 shrink-0">
        Press <kbd className="px-1.5 py-0.5 rounded bg-[#facc15] text-slate-950 font-bold border border-slate-900">Esc</kbd> or tap any section to close
      </div>
    </div>
  ) : null;

  return (
    <>
      <header className="border-b-2 border-slate-900 dark:border-slate-800 bg-white dark:bg-[#0b1120] px-3 sm:px-6 py-2.5 sticky top-0 z-30 select-none transition-colors duration-200">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded bg-[#facc15] border-2 border-slate-900 flex items-center justify-center text-slate-950 font-mono font-black text-sm shrink-0 shadow-xs">
              RAG
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-black text-sm sm:text-base tracking-tight text-slate-950 dark:text-white truncate">
                  RAG Studio
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-yellow-400 text-slate-950 border border-slate-900 shrink-0 font-bold">
                  STUDIO
                </span>
              </div>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 hidden sm:block truncate font-mono">
                Dual Retrieval & Reranking Workbench
              </p>
            </div>
          </div>

          {/* Center: Main Navigation Tabs (Desktop only: md+) - Neo-Brutalist #FACC15 Active State */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border-2 border-slate-900 dark:border-slate-700 transition-colors">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-3 py-1.5 rounded text-xs transition-all flex items-center gap-1.5 cursor-pointer font-mono ${
                    isActive
                      ? 'bg-[#facc15] text-slate-950 font-bold border-2 border-slate-900 shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 font-medium'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Real Model Indicator, Theme Toggle, Notification Bell, and Mobile Hamburger */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono shrink-0">
            {/* Real Dynamic Model Status (No fabricated badges) */}
            <div className="hidden lg:flex items-center gap-1.5">
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded border-2 border-slate-900 text-[10px] font-bold ${
                  isOllamaOnline
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300'
                }`}
                title={`Ollama target model: ${targetModel}`}
              >
                <Cpu className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{targetModel}</span>
              </div>

              <div className="flex items-center gap-1 px-2 py-1 rounded border-2 border-slate-900 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 text-[10px] font-bold">
                <Database className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span>SQLITE WAL</span>
              </div>

              <div className="flex items-center gap-1 px-2 py-1 rounded border-2 border-slate-900 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 text-[10px] font-bold">
                <Layers className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span>LANCEDB</span>
              </div>

              <div className="flex items-center gap-1 px-2 py-1 rounded border-2 border-slate-900 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 text-[10px] font-bold">
                <FileText className="w-3 h-3 text-slate-500" />
                <span>{docsCount} DOCS</span>
              </div>
            </div>

            {/* Quick Ingest Button (Desktop) */}
            <button
              onClick={onOpenIngestModal}
              className="hidden sm:inline-flex studio-btn-primary"
              title="Ingest new document AST (Cmd+I)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Ingest</span>
            </button>

            {/* Notification Bell with Badge */}
            <button
              onClick={onOpenNotifications}
              className="relative p-1.5 sm:p-2 rounded border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 transition-colors cursor-pointer shadow-xs"
              title="System Alerts & Telemetry"
              aria-label="Open notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#facc15] text-slate-950 text-[9px] font-black flex items-center justify-center border border-slate-900">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Neo-Brutalist Sun/Moon Theme Toggle (Desktop & Mobile) */}
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all cursor-pointer flex items-center justify-center shadow-xs"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-yellow-400 transition-transform duration-200 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-slate-950 transition-transform duration-200 hover:-rotate-12" />
              )}
            </button>

            {/* Neo-Brutalist Mobile Hamburger Menu Button (Visible on < md) */}
            <button
              onClick={openMenu}
              className="md:hidden p-1.5 sm:p-2 rounded border-2 border-slate-900 dark:border-slate-700 bg-[#facc15] text-slate-950 hover:bg-yellow-300 transition-colors cursor-pointer shadow-xs font-bold"
              aria-label="Open full-screen navigation menu"
              title="Open navigation menu"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Render mobile drawer via createPortal directly into document.body */}
      {typeof document !== 'undefined' && mobileDrawerContent && createPortal(mobileDrawerContent, document.body)}
    </>
  );
};
