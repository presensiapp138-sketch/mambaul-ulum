import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { StudentAttendance, ToiletPermit, SchoolSettings } from '../types/index.ts';
import { apiRequest, syncOfflineQueue } from '../lib/api.ts';
import { getOfflineQueue } from '../lib/indexedDb.ts';

export type SyncStatus = 'synced' | 'syncing' | 'offline';

interface SyncContextType {
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  todayAttendance: StudentAttendance[];
  activePermits: ToiletPermit[];
  settings: SchoolSettings | null;
  offlineQueueCount: number;
  triggerSync: () => Promise<void>;
  updateSettings: (newSettings: Partial<SchoolSettings>) => Promise<boolean>;
}

const defaultSettings: SchoolSettings = {
  schoolName: 'Yayasan Mambaul Ulum',
  schoolLogo: '',
  academicYear: '2026/2027',
  checkInTime: '07:00',
  lateCutoffTime: '07:15',
  checkOutTime: '15:00',
  toiletMaxMinutes: 10,
  warningThresholdAbsent: 3,
  warningThresholdLate: 3,
  warningThresholdToilet: 4,
  teacherPhotoProofEnabled: false,
  parentNotificationEnabled: true,
  holidays: [],
  foundationAddress: 'Jl. Pesantren Mambaul Ulum No. 45, Diwek, Jombang, Jawa Timur 61471',
  foundationWebsite: 'https://mambaululum.sch.id',
};

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<StudentAttendance[]>([]);
  const [activePermits, setActivePermits] = useState<ToiletPermit[]>([]);
  const [settings, setSettings] = useState<SchoolSettings | null>(defaultSettings);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const lastTimestampRef = useRef<string>('');
  const isPollingRef = useRef<boolean>(false);
  const isTabActiveRef = useRef<boolean>(true);

  // Monitor network status
  const updateOnlineStatus = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      const queue = await getOfflineQueue();
      setOfflineQueueCount(queue.length);
    } else {
      // Reconnected! Flush offline queue immediately
      const { synced } = await syncOfflineQueue();
      if (synced > 0) {
        console.info(`Synced ${synced} offline records to server.`);
      }
      const queue = await getOfflineQueue();
      setOfflineQueueCount(queue.length);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    const handleVisibilityChange = () => {
      isTabActiveRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateOnlineStatus]);

  // Main smart polling function
  const triggerSync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    if (isPollingRef.current) return;
    isPollingRef.current = true;
    setSyncStatus('syncing');

    try {
      // Replay any pending offline items
      const queue = await getOfflineQueue();
      setOfflineQueueCount(queue.length);
      if (queue.length > 0) {
        await syncOfflineQueue();
        const updatedQueue = await getOfflineQueue();
        setOfflineQueueCount(updatedQueue.length);
      }

      const res = await apiRequest<{
        serverTime: string;
        todayAttendance: StudentAttendance[];
        activePermits: ToiletPermit[];
        settings: SchoolSettings;
        hasChanges: boolean;
      }>(`/api/sync?since=${encodeURIComponent(lastTimestampRef.current)}`);

      if (res.success) {
        if (res.todayAttendance) {
          setTodayAttendance(res.todayAttendance);
        }
        if (res.activePermits) {
          setActivePermits(res.activePermits);
        }
        if (res.settings) {
          setSettings(res.settings);
        }
        lastTimestampRef.current = res.serverTime;
        setLastSyncedAt(new Date());
        setSyncStatus('synced');
      }
    } catch (err) {
      console.warn('Sync polling error:', err);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline');
      } else {
        setSyncStatus('synced'); // Recover gracefully
      }
    } finally {
      isPollingRef.current = false;
    }
  }, []);

  // Interval polling: 4 seconds, pauses when tab is inactive
  useEffect(() => {
    triggerSync();

    const interval = setInterval(() => {
      if (isTabActiveRef.current) {
        triggerSync();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [triggerSync]);

  const updateSettings = async (newSettings: Partial<SchoolSettings>): Promise<boolean> => {
    try {
      const res = await apiRequest<SchoolSettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(newSettings),
      });
      if (res.success && res.data) {
        setSettings(res.data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <SyncContext.Provider
      value={{
        syncStatus,
        lastSyncedAt,
        todayAttendance,
        activePermits,
        settings,
        offlineQueueCount,
        triggerSync,
        updateSettings,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
