import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  StudentAttendance,
  ToiletPermit,
  SchoolSettings,
  FaceTemplate,
  Student,
  SchoolClass,
} from '../types/index.ts';
import { apiRequest, syncOfflineQueue } from '../lib/api.ts';
import { getOfflineQueue } from '../lib/indexedDb.ts';

export type SyncStatus = 'synced' | 'syncing' | 'offline';

interface SyncContextType {
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  faceTemplatesSyncedAt: Date | null;
  todayAttendance: StudentAttendance[];
  activePermits: ToiletPermit[];
  settings: SchoolSettings | null;
  faceTemplates: FaceTemplate[];
  students: Student[];
  classes: SchoolClass[];
  offlineQueueCount: number;
  triggerSync: (forceRefresh?: boolean) => Promise<void>;
  notifyFaceDatabaseChanged: () => Promise<void>;
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

const SYNC_CHANNEL_NAME = 'presensi_mambaul_ulum_sync';
const SYNC_STORAGE_KEY = 'presensi_sync_signal';

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [faceTemplatesSyncedAt, setFaceTemplatesSyncedAt] = useState<Date | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<StudentAttendance[]>([]);
  const [activePermits, setActivePermits] = useState<ToiletPermit[]>([]);
  const [settings, setSettings] = useState<SchoolSettings | null>(defaultSettings);
  const [faceTemplates, setFaceTemplates] = useState<FaceTemplate[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const lastTimestampRef = useRef<string>('');
  const faceSigRef = useRef<string>('__init__');
  const studentSigRef = useRef<string>('__init__');
  const classSigRef = useRef<string>('__init__');
  const isPollingRef = useRef<boolean>(false);
  const pendingForceSyncRef = useRef<boolean>(false);
  const isTabActiveRef = useRef<boolean>(true);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Monitor network status
  const updateOnlineStatus = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      const queue = await getOfflineQueue();
      setOfflineQueueCount(queue.length);
    } else {
      const { synced } = await syncOfflineQueue();
      if (synced > 0) {
        console.info(`Synced ${synced} offline records to server.`);
      }
      const queue = await getOfflineQueue();
      setOfflineQueueCount(queue.length);
    }
  }, []);

  // Main smart polling function with signature diff & queued force refresh
  const triggerSync = useCallback(async (forceRefresh: boolean = false) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    if (isPollingRef.current) {
      // Never drop an explicit mutation sync while a background poll is in flight
      if (forceRefresh) {
        pendingForceSyncRef.current = true;
      }
      return;
    }

    isPollingRef.current = true;
    setSyncStatus('syncing');

    try {
      const queue = await getOfflineQueue();
      setOfflineQueueCount(queue.length);
      if (queue.length > 0) {
        await syncOfflineQueue();
        const updatedQueue = await getOfflineQueue();
        setOfflineQueueCount(updatedQueue.length);
      }

      const params = new URLSearchParams({
        since: lastTimestampRef.current,
        faceSig: forceRefresh ? '__force__' : faceSigRef.current,
        studentSig: forceRefresh ? '__force__' : studentSigRef.current,
        classSig: forceRefresh ? '__force__' : classSigRef.current,
      });
      if (forceRefresh) {
        params.set('force', '1');
      }

      const res = await apiRequest<{
        serverTime: string;
        todayAttendance: StudentAttendance[];
        activePermits: ToiletPermit[];
        settings: SchoolSettings;
        faceSignature?: string;
        studentSignature?: string;
        classSignature?: string;
        faceTemplates?: FaceTemplate[];
        students?: Student[];
        classes?: SchoolClass[];
        hasChanges: boolean;
      }>(`/api/sync?${params.toString()}`);

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
        if (Array.isArray(res.faceTemplates)) {
          setFaceTemplates(res.faceTemplates);
          setFaceTemplatesSyncedAt(new Date());
        }
        if (Array.isArray(res.students)) {
          setStudents(res.students);
        }
        if (Array.isArray(res.classes)) {
          setClasses(res.classes);
        }
        if (typeof res.faceSignature === 'string') {
          faceSigRef.current = res.faceSignature;
        }
        if (typeof res.studentSignature === 'string') {
          studentSigRef.current = res.studentSignature;
        }
        if (typeof res.classSignature === 'string') {
          classSigRef.current = res.classSignature;
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
        setSyncStatus('synced');
      }
    } finally {
      isPollingRef.current = false;
      if (pendingForceSyncRef.current) {
        pendingForceSyncRef.current = false;
        void triggerSync(true);
      }
    }
  }, []);

  // Broadcast across all open tabs/windows on this device + force-sync local state immediately
  const notifyFaceDatabaseChanged = useCallback(async () => {
    try {
      channelRef.current?.postMessage({ type: 'FACE_DB_UPDATED', at: Date.now() });
    } catch {
      // Ignore BroadcastChannel errors
    }
    try {
      localStorage.setItem(SYNC_STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage quota / private mode errors
    }
    await triggerSync(true);
  }, [triggerSync]);

  useEffect(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      isTabActiveRef.current = visible;
      if (visible) {
        // Immediately sync when returning to the kiosk/app tab
        void triggerSync(false);
      }
    };
    const handleFocus = () => {
      void triggerSync(false);
    };
    const handleStorageSignal = (e: StorageEvent) => {
      if (e.key === SYNC_STORAGE_KEY) {
        void triggerSync(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageSignal);

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
        channelRef.current = ch;
        ch.onmessage = (event) => {
          if (event?.data?.type === 'FACE_DB_UPDATED') {
            void triggerSync(true);
          }
        };
      } catch {
        // Ignore if blocked
      }
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageSignal);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [updateOnlineStatus, triggerSync]);

  // Interval polling: 3 seconds when tab active, immediate on mount
  useEffect(() => {
    void triggerSync(true);

    const interval = setInterval(() => {
      if (isTabActiveRef.current) {
        void triggerSync(false);
      }
    }, 3000);

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
        await notifyFaceDatabaseChanged();
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
        faceTemplatesSyncedAt,
        todayAttendance,
        activePermits,
        settings,
        faceTemplates,
        students,
        classes,
        offlineQueueCount,
        triggerSync,
        notifyFaceDatabaseChanged,
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
