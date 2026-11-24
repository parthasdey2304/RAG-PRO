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
import { BarChart3, FileText, Upload } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'arena' | 'docs' | 'eval' | 'traces' | 'settings'>('arena');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Theme state: initialized from HTML class (set by no-FOUC script) or localStorage
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'dark';
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
      try {
        localStorage.setItem('theme', next);
        localStorage.setItem('rag_studio_theme', next);
      } catch {}
      return next;
    });
  }, []);

  // Modals & Drawers
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  // Traces state - shared across Arena and Telemetry Views (Initialized as empty array per spec)
  const [traces, setTraces] = useState<TraceRecord[]>([]);

  // Notifications State
  const [notifications, setNotifications] = useState<StudioNotification[]>([
    {
      id: 'notif_welcome',
      type: 'info',
      title: 'Studio Engine Ready',
      message: 'LanceDB vector store and SQLite WAL hierarchical tree indices initialized.',
      timestamp: 'Just now',
      read: false,
    },
  ]);

  // Toast Stack State
  const [toasts, setToasts] = useState<StudioToast[]>([]);

  const addToast = (message: string, type: 'default' | 'success' | 'warning' | 'error' = 'default') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type, durationSeconds: 4 }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addTrace = (trace: TraceRecord) => {
    setTraces((prev) => [trace, ...prev.slice(0, 99)]);
  };

  const addNotification = (notif: Omit<StudioNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: StudioNotification = {
      ...notif,
      id: `notif_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Initial Data Fetch
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        if (data.documents && data.documents.length > 0 && !selectedDocId) {
          setSelectedDocId(data.documents[0].id);
        }
      }
    } catch {
      // Backend offline or starting up
    }
  }, [selectedDocId]);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [fetchDocuments, fetchHealth]);

  const handleSeedDemoDoc = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/documents/seed_demo', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        addToast('Reference blueprint indexed into LanceDB and SQLite WAL', 'success');
        await fetchDocuments();
        if (data.doc_id) setSelectedDocId(data.doc_id);
        addNotification({
          type: 'success',
          title: 'Document Blueprint Ready',
          message: 'Indexed DeepSeek-V3 architecture blueprint into 45 chunks and 12 AST tree nodes.',
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-950 dark:text-slate-100 flex flex-col font-sans selection:bg-yellow-400 selection:text-slate-950 transition-colors duration-200">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        docsCount={documents.length}
        unreadNotificationsCount={unreadCount}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
        onOpenIngestModal={() => setIsIngestModalOpen(true)}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto">
        {/* Onboarding Callout if no documents exist */}
        {documents.length === 0 && (
          <div className="m-3 sm:m-6 p-4 rounded-xl bg-white dark:bg-[#0f172a] border-2 border-slate-900 dark:border-slate-700 border-b-4 border-r-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-400 text-slate-950 border border-slate-900">
                <BarChart3 className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-950 dark:text-slate-100">
                  Welcome to RAG Studio Workbench
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                  No documents indexed yet. Load the reference architecture blueprint to initialize LanceDB & SQLite WAL.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                onClick={() => setIsIngestModalOpen(true)}
                className="studio-btn-ghost flex-1 sm:flex-initial justify-center"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom</span>
              </button>
              <button
                onClick={handleSeedDemoDoc}
                disabled={isSeeding}
                className="studio-btn-primary flex-1 sm:flex-initial justify-center"
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
      <footer className="border-t-2 border-slate-900 dark:border-slate-800 bg-white dark:bg-[#0b1120] px-4 sm:px-6 py-2.5 text-[11px] font-mono text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 select-none transition-colors">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-center sm:text-left">
          <span className="font-bold text-slate-900 dark:text-slate-200">RAG STUDIO WORKBENCH</span>
          <span>•</span>
          <span>FLASHRANK CPU ONNX</span>
          <span>•</span>
          <span>TREE REASONING</span>
          <span>•</span>
          <span>RAGAS EVAL LAB</span>
        </div>
        <div className="flex items-center gap-3 text-center">
          <span className="font-semibold text-slate-800 dark:text-slate-300">100% LOCAL-FIRST</span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-slate-600 dark:text-slate-400">Shortcut: [⌘+I Ingest] [↵ Run]</span>
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
