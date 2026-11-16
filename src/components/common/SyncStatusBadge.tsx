import React, { useState, useRef, useEffect } from 'react';
import { useSync } from '../../context/SyncContext.tsx';
import { getRealtimeClientId } from '../../lib/api.ts';
import { RefreshCw, Wifi, WifiOff, Users, Radio, Activity } from 'lucide-react';

const TAB_LABELS: Record<string, string> = {
  portal: 'Menu Pilihan',
  kiosk: 'Kiosk Siswa',
  teacher: 'Presensi Guru',
  homeroom: 'Wali Kelas',
  counseling: 'BK & Kesiswaan',
  admin: 'Admin Panel',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  guru: 'Guru',
  wali_kelas: 'Wali Kelas',
  bk: 'BK',
  kesiswaan: 'Kesiswaan',
  kiosk: 'Kiosk',
};

export const SyncStatusBadge: React.FC = () => {
  const {
    syncStatus,
    realtimeConnected,
    activeUsers,
    recentEvents,
    lastSyncedAt,
    offlineQueueCount,
    triggerSync,
  } = useSync();

  const [showPopover, setShowPopover] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const myClientId = getRealtimeClientId();

  useEffect(() => {
    if (!showPopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      {/* Live Multi-User Presence & Real-Time Toggle */}
      <button
        type="button"
        onClick={() => setShowPopover(prev => !prev)}
        title="Lihat pengguna aktif & aktivitas sinkronisasi real-time"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
          syncStatus === 'offline'
            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
            : realtimeConnected
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
            : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
        }`}
      >
        {syncStatus === 'offline' ? (
          <>
            <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Offline {offlineQueueCount > 0 ? `(${offlineQueueCount})` : ''}</span>
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              {realtimeConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  realtimeConnected ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
              />
            </span>
            {syncStatus === 'syncing' ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : realtimeConnected ? (
              <Radio className="w-3 h-3" />
            ) : (
              <Wifi className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">{realtimeConnected ? 'Real-Time' : 'Tersinkron'}</span>
            <span className="inline-flex items-center gap-0.5 pl-1 border-l border-current/25 text-[11px] font-bold">
              <Users className="w-3 h-3" />
              {Math.max(1, activeUsers.length)}
            </span>
          </>
        )}
      </button>

      {showPopover && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div>
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Pengguna Aktif ({Math.max(1, activeUsers.length)})</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {realtimeConnected ? 'Koneksi WebSocket Real-Time Aktif' : 'Mode Sinkronisasi Berkala'}
                {lastSyncedAt ? ` • ${lastSyncedAt.toLocaleTimeString('id-ID')}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void triggerSync(true)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
              title="Sinkronkan ulang sekarang"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Active Multi-User Sessions List */}
          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
            {activeUsers.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-2 text-center">
                Sesi ini aktif (menunggu pembaruan daftar perangkat)
              </div>
            ) : (
              activeUsers.map(u => {
                const isSelf = u.clientId === myClientId;
                return (
                  <div
                    key={u.clientId}
                    className={`p-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
                      isSelf
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="truncate">{u.name}</span>
                        {isSelf && (
                          <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">(Anda)</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {TAB_LABELS[u.activeTab] || u.activeTab} • {u.deviceLabel}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex-shrink-0">
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Live Recent Activity Feed across Users */}
          {recentEvents.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-500" />
                <span>Sinkronisasi Langsung Terbaru</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {recentEvents.slice(0, 6).map(evt => (
                  <div
                    key={evt.id}
                    className="text-[10px] px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 flex items-start justify-between gap-2"
                  >
                    <span className="line-clamp-2">{evt.summary}</span>
                    <span className="text-[9px] text-slate-400 font-mono flex-shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
