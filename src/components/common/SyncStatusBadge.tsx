import React from 'react';
import { useSync } from '../../context/SyncContext.tsx';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

export const SyncStatusBadge: React.FC = () => {
  const { syncStatus, lastSyncedAt, offlineQueueCount, triggerSync } = useSync();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => triggerSync()}
        title={
          lastSyncedAt
            ? `Terakhir disinkronkan: ${lastSyncedAt.toLocaleTimeString('id-ID')}. Klik untuk sinkron manual.`
            : 'Klik untuk sinkron data sekarang'
        }
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
          syncStatus === 'synced'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
            : syncStatus === 'syncing'
            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
        }`}
      >
        {syncStatus === 'synced' && (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Tersinkron</span>
          </>
        )}

        {syncStatus === 'syncing' && (
          <>
            <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">Menyinkronkan...</span>
          </>
        )}

        {syncStatus === 'offline' && (
          <>
            <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Offline {offlineQueueCount > 0 ? `(${offlineQueueCount} antrian)` : ''}</span>
          </>
        )}
      </button>
    </div>
  );
};
