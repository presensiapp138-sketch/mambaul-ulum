import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  StudentAttendance,
  ToiletPermit,
  SchoolSettings,
  FaceTemplate,
  Student,
  SchoolClass,
} from '../types/index.ts';
import { apiRequest, syncOfflineQueue, getStoredToken, getRealtimeClientId } from '../lib/api.ts';
import { getOfflineQueue } from '../lib/indexedDb.ts';
import { useAuth } from './AuthContext.tsx';

export type SyncStatus = 'synced' | 'syncing' | 'offline';

export interface ActiveUserPresence {
  clientId: string;
  userId: string;
  username: string;
  name: string;
  role: string;
  activeTab: string;
  deviceLabel: string;
  connectedAt: string;
  lastSeenAt: string;
}

export interface RealtimeEventItem {
  id: string;
  tableName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC' | 'INIT';
  recordId: string;
  updatedBy: string;
  summary: string;
  timestamp: string;
  version: number;
}

interface SyncContextType {
  syncStatus: SyncStatus;
  realtimeConnected: boolean;
  serverVersion: number;
  tableVersions: Record<string, number>;
  activeUsers: ActiveUserPresence[];
  recentEvents: RealtimeEventItem[];
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
  reportActiveView: (activeTab: string) => void;
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

function detectDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Web Browser';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Web Browser';
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const [serverVersion, setServerVersion] = useState<number>(0);
  const [tableVersions, setTableVersions] = useState<Record<string, number>>({});
  const [activeUsers, setActiveUsers] = useState<ActiveUserPresence[]>([]);
  const [recentEvents, setRecentEvents] = useState<RealtimeEventItem[]>([]);

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
  const lastServerVersionRef = useRef<number>(0);
  const isPollingRef = useRef<boolean>(false);
  const pendingForceSyncRef = useRef<boolean>(false);
  const isTabActiveRef = useRef<boolean>(true);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const activeTabRef = useRef<string>('portal');
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<number | null>(null);

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

  // Main smart sync/reconciliation function
  const triggerSync = useCallback(async (forceRefresh: boolean = false) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    if (isPollingRef.current) {
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
        serverVersion?: number;
        activeUsers?: ActiveUserPresence[];
        recentEvents?: RealtimeEventItem[];
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
        if (typeof res.serverVersion === 'number') {
          lastServerVersionRef.current = Math.max(lastServerVersionRef.current, res.serverVersion);
          setServerVersion(lastServerVersionRef.current);
        }
        if (Array.isArray(res.activeUsers)) {
          setActiveUsers(res.activeUsers);
        }
        if (Array.isArray(res.recentEvents)) {
          setRecentEvents(res.recentEvents);
        }
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
      console.warn('Sync reconciliation error:', err);
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

  // Push session presence metadata over WebSocket whenever user logs in/out or changes tab
  const sendSessionUpdate = useCallback((type: 'session:join' | 'session:update' = 'session:update') => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(
        JSON.stringify({
          type,
          clientId: getRealtimeClientId(),
          token: getStoredToken(),
          activeTab: activeTabRef.current,
          deviceLabel: detectDeviceLabel(),
        })
      );
    } catch {
      // Ignore send errors if socket closing
    }
  }, []);

  const reportActiveView = useCallback(
    (activeTab: string) => {
      activeTabRef.current = activeTab;
      sendSessionUpdate('session:update');
    },
    [sendSessionUpdate]
  );

  // Automatically update server presence when auth user changes
  useEffect(() => {
    sendSessionUpdate('session:update');
  }, [user, isAuthenticated, sendSessionUpdate]);

  // Real-time WebSocket connection (/ws) with automatic exponential backoff reconnect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let unmounted = false;
    let pingInterval: number | null = null;

    const connectWebSocket = () => {
      if (unmounted) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptRef.current = 0;
          setRealtimeConnected(true);
          sendSessionUpdate('session:join');
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'sync:welcome') {
              if (Array.isArray(msg.activeUsers)) {
                setActiveUsers(msg.activeUsers);
              }
              if (Array.isArray(msg.recentEvents)) {
                setRecentEvents(msg.recentEvents);
              }
              if (typeof msg.serverVersion === 'number') {
                const prev = lastServerVersionRef.current;
                lastServerVersionRef.current = Math.max(prev, msg.serverVersion);
                setServerVersion(lastServerVersionRef.current);
                if (msg.serverVersion > prev) {
                  void triggerSync(true);
                }
              }
              return;
            }

            if (msg.type === 'presence:update') {
              if (Array.isArray(msg.activeUsers)) {
                setActiveUsers(msg.activeUsers);
              }
              return;
            }

            if (msg.type === 'db:changed') {
              if (typeof msg.tableName === 'string' && typeof msg.version === 'number') {
                setTableVersions((prev) => ({
                  ...prev,
                  [msg.tableName]: msg.version,
                }));

                if (msg.tableName !== 'AuditLog' && msg.tableName !== 'ChangeLog') {
                  setRecentEvents((prev) => {
                    if (prev.some((e) => e.id === `evt-${msg.version}` || e.version === msg.version)) {
                      return prev;
                    }
                    const nextItem: RealtimeEventItem = {
                      id: `evt-${msg.version}`,
                      tableName: msg.tableName,
                      action: msg.action || 'UPDATE',
                      recordId: msg.recordId || '',
                      updatedBy: msg.updatedBy || 'system',
                      summary: msg.summary || `${msg.tableName} diperbarui`,
                      timestamp: msg.timestamp || new Date().toISOString(),
                      version: msg.version,
                    };
                    return [nextItem, ...prev].slice(0, 30);
                  });
                }

                if (msg.version > lastServerVersionRef.current) {
                  lastServerVersionRef.current = msg.version;
                  setServerVersion(msg.version);
                  const forceTables = new Set(['FaceTemplates', 'Students', 'Classes', 'Settings']);
                  void triggerSync(forceTables.has(msg.tableName));
                }
              }
            }
          } catch {
            // Ignore malformed message
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          setRealtimeConnected(false);
          if (!unmounted) {
            const delay = Math.min(10_000, 1000 * Math.pow(2, reconnectAttemptRef.current));
            reconnectAttemptRef.current += 1;
            reconnectTimerRef.current = window.setTimeout(connectWebSocket, delay);
          }
        };

        ws.onerror = () => {
          // Close triggers clean reconnect
        };
      } catch {
        setRealtimeConnected(false);
      }
    };

    connectWebSocket();

    pingInterval = window.setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping', clientId: getRealtimeClientId() }));
        } catch {
          // Ignore ping failure
        }
      }
    }, 25_000);

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (pingInterval) window.clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sendSessionUpdate, triggerSync]);

  // Broadcast across same-browser tabs + force-sync local state immediately
  const notifyFaceDatabaseChanged = useCallback(async () => {
    try {
      channelRef.current?.postMessage({ type: 'FACE_DB_UPDATED', at: Date.now() });
    } catch {
      // Ignore BroadcastChannel errors
    }
    try {
      localStorage.setItem(SYNC_STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage quota errors
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

  // Safety fallback interval polling: 15s when WebSocket is connected, 3s if fallback mode
  useEffect(() => {
    void triggerSync(true);

    const pollMs = realtimeConnected ? 15_000 : 3_000;
    const interval = setInterval(() => {
      if (isTabActiveRef.current) {
        void triggerSync(false);
      }
    }, pollMs);

    return () => clearInterval(interval);
  }, [triggerSync, realtimeConnected]);

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
        realtimeConnected,
        serverVersion,
        tableVersions,
        activeUsers,
        recentEvents,
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
        reportActiveView,
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
