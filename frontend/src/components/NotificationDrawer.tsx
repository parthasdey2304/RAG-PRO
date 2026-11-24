import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight,
  Trash2
} from 'lucide-react';
import type { StudioNotification } from '../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: StudioNotification[];
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNavigateTab: (tab: 'arena' | 'docs' | 'eval' | 'traces' | 'settings') => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onClearAll,
  onNavigateTab,
}) => {
  const [desktopAlerts, setDesktopAlerts] = useState(true);
  const [audioChime, setAudioChime] = useState(false);
  const [autoPrune, setAutoPrune] = useState(true);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
    } else if (isRendered && !isClosing) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendered, isClosing]);

  const handleClose = (callback?: () => void) => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsRendered(false);
      onClose();
      if (callback) callback();
    }, 220);
  };

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (isRendered) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isRendered]);

  // Handle escape key to close notification drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRendered && !isClosing) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRendered, isClosing]);

  if (!isRendered && !isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const drawerPortal = (
    <div
      className="fixed inset-0 z-50 overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Notification Center"
    >
      {/* Backdrop with Fade In / Fade Out */}
      <div
        onClick={() => handleClose()}
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity ${
          isClosing ? 'animate-fade-out' : 'animate-fade-in'
        }`}
      />

      {/* Outer placement container: top-anchored on mobile, right-anchored sidebar on desktop */}
      <div className="fixed inset-x-0 top-0 sm:inset-y-0 sm:right-0 sm:left-auto max-w-full flex justify-end pointer-events-none">
        {/* Drawer Panel: Slide down on mobile, slide in from right on desktop */}
        <div
          className={`pointer-events-auto w-full sm:w-screen sm:max-w-md max-h-[88vh] sm:max-h-full bg-white dark:bg-[#0b1120] border-b-4 sm:border-b-0 sm:border-l-2 border-slate-900 dark:border-slate-800 shadow-2xl flex flex-col font-mono text-xs text-slate-700 dark:text-slate-300 rounded-b-xl sm:rounded-none overflow-hidden ${
            isClosing
              ? 'animate-slide-up sm:animate-sidebar-out'
              : 'animate-slide-down sm:animate-sidebar-in'
          }`}
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#090d16]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-yellow-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Notification Center
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400 text-slate-950 font-bold border border-slate-900">
                  {unreadCount} Unread
                </span>
              )}
            </div>

            <button
              onClick={() => handleClose()}
              aria-label="Close Notification Center"
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Subheader Controls */}
          <div className="px-4 py-2 bg-slate-100/60 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
            <button
              onClick={onMarkAllAsRead}
              className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Mark all as read
            </button>
            <button
              onClick={onClearAll}
              className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length > 0 ? (
              notifications.map((n) => {
                const isSuccess = n.type === 'success';
                const isWarning = n.type === 'warning';
                const isInfo = n.type === 'info';

                return (
                  <div
                    key={n.id}
                    className={`studio-card-elevated p-3 border-l-2 text-xs space-y-1.5 transition-colors ${
                      isSuccess
                        ? 'border-l-emerald-500'
                        : isWarning
                        ? 'border-l-amber-500'
                        : 'border-l-blue-500'
                    } ${!n.read ? 'bg-blue-50/40 dark:bg-slate-900/90' : 'opacity-85'}`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        {isWarning && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                        {isInfo && <Info className="w-3.5 h-3.5 text-blue-500" />}
                        <span className="font-semibold text-slate-900 dark:text-slate-200">{n.title}</span>
                      </div>
                      <span className="text-slate-400 dark:text-slate-500">{n.timestamp}</span>
                    </div>

                    <p className="text-slate-700 dark:text-slate-300 font-sans text-[11px] leading-relaxed">
                      {n.message}
                    </p>

                    {n.actionLabel && n.targetTab && (
                      <button
                        onClick={() => {
                          handleClose(() => onNavigateTab(n.targetTab!));
                        }}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-0.5 pt-1"
                      >
                        <span>{n.actionLabel}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                No active notifications or telemetry alerts.
              </div>
            )}
          </div>

          {/* Drawer Bottom Preferences */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090d16] space-y-2 text-[11px]">
            <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
              NOTIFICATION PREFERENCES
            </span>

            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span>Desktop system notifications</span>
              <button
                onClick={() => setDesktopAlerts(!desktopAlerts)}
                className={`w-8 h-4 rounded-full transition-colors relative ${
                  desktopAlerts ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white transition-transform ${
                    desktopAlerts ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span>Audio latency chime</span>
              <button
                onClick={() => setAudioChime(!audioChime)}
                className={`w-8 h-4 rounded-full transition-colors relative ${
                  audioChime ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white transition-transform ${
                    audioChime ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span>Auto-prune read alerts (24h)</span>
              <button
                onClick={() => setAutoPrune(!autoPrune)}
                className={`w-8 h-4 rounded-full transition-colors relative ${
                  autoPrune ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white transition-transform ${
                    autoPrune ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(drawerPortal, document.body) : drawerPortal;
};
