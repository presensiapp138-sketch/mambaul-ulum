export type TableChangeAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC' | 'INIT';

export interface ActiveClientPresence {
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

export interface RealtimeActivityEvent {
  id: string;
  tableName: string;
  action: TableChangeAction;
  recordId: string;
  updatedBy: string;
  summary: string;
  timestamp: string;
  version: number;
}

export type RealtimeBroadcastMessage =
  | {
      type: 'sync:welcome';
      serverVersion: number;
      serverTime: string;
      activeUsers: ActiveClientPresence[];
      recentEvents: RealtimeActivityEvent[];
    }
  | {
      type: 'db:changed';
      tableName: string;
      action: TableChangeAction;
      recordId: string;
      updatedBy: string;
      summary: string;
      timestamp: string;
      version: number;
    }
  | {
      type: 'presence:update';
      activeUsers: ActiveClientPresence[];
      serverVersion: number;
      timestamp: string;
    };

type RealtimeListener = (msg: RealtimeBroadcastMessage) => void;

// Global singleton state across Vite SSR module reloads in dev
const globalRealtimeKey = '__presensiRealtimeState__';
interface RealtimeInternalState {
  serverVersion: number;
  activeSessions: Map<string, ActiveClientPresence>;
  recentEvents: RealtimeActivityEvent[];
  listeners: Set<RealtimeListener>;
}

function getState(): RealtimeInternalState {
  const g = globalThis as Record<string, unknown>;
  if (!g[globalRealtimeKey]) {
    g[globalRealtimeKey] = {
      serverVersion: 1,
      activeSessions: new Map<string, ActiveClientPresence>(),
      recentEvents: [],
      listeners: new Set<RealtimeListener>(),
    } satisfies RealtimeInternalState;
  }
  return g[globalRealtimeKey] as RealtimeInternalState;
}

export function getServerVersion(): number {
  return getState().serverVersion;
}

export function getActiveUsersSnapshot(): ActiveClientPresence[] {
  return Array.from(getState().activeSessions.values()).sort((a, b) =>
    b.lastSeenAt.localeCompare(a.lastSeenAt)
  );
}

export function getRecentEvents(): RealtimeActivityEvent[] {
  return [...getState().recentEvents];
}

export function subscribeRealtime(listener: RealtimeListener): () => void {
  const state = getState();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

function emitToAll(msg: RealtimeBroadcastMessage): void {
  const state = getState();
  for (const listener of state.listeners) {
    try {
      listener(msg);
    } catch (err) {
      console.warn('Realtime listener error:', err);
    }
  }
}

export function broadcastPresence(): void {
  const state = getState();
  emitToAll({
    type: 'presence:update',
    activeUsers: getActiveUsersSnapshot(),
    serverVersion: state.serverVersion,
    timestamp: new Date().toISOString(),
  });
}

export function upsertSession(input: {
  clientId: string;
  userId?: string;
  username?: string;
  name?: string;
  role?: string;
  activeTab?: string;
  deviceLabel?: string;
}): ActiveClientPresence {
  const state = getState();
  const now = new Date().toISOString();
  const existing = state.activeSessions.get(input.clientId);

  const session: ActiveClientPresence = {
    clientId: input.clientId,
    userId: input.userId || existing?.userId || `guest-${input.clientId.slice(0, 6)}`,
    username: input.username || existing?.username || 'kiosk',
    name: input.name || existing?.name || 'Perangkat Kiosk / Tamu',
    role: input.role || existing?.role || 'kiosk',
    activeTab: input.activeTab || existing?.activeTab || 'portal',
    deviceLabel: input.deviceLabel || existing?.deviceLabel || 'Web Browser',
    connectedAt: existing?.connectedAt || now,
    lastSeenAt: now,
  };

  state.activeSessions.set(input.clientId, session);
  broadcastPresence();
  return session;
}

export function removeSession(clientId: string): boolean {
  const state = getState();
  const removed = state.activeSessions.delete(clientId);
  if (removed) {
    broadcastPresence();
  }
  return removed;
}

export function sweepStaleSessions(maxAgeMs: number = 90_000): void {
  const state = getState();
  const cutoff = Date.now() - maxAgeMs;
  let removedAny = false;
  for (const [id, session] of state.activeSessions.entries()) {
    if (new Date(session.lastSeenAt).getTime() < cutoff) {
      state.activeSessions.delete(id);
      removedAny = true;
    }
  }
  if (removedAny) {
    broadcastPresence();
  }
}

const TABLE_LABELS: Record<string, string> = {
  Settings: 'Pengaturan Sekolah',
  Users: 'Akun Pengguna',
  Teachers: 'Data Guru',
  Classes: 'Data Kelas',
  Students: 'Data Siswa',
  FaceTemplates: 'Database Wajah',
  StudentAttendance: 'Presensi Siswa',
  TeacherAttendance: 'Presensi Guru',
  ToiletPermits: 'Izin Toilet',
  Locations: 'Lokasi GPS',
  AuditLog: 'Audit Log',
  ChangeLog: 'Log Perubahan',
  FollowUpNotes: 'Catatan BK',
  System: 'Sistem',
};

export function broadcastTableChange(params: {
  tableName: string;
  action: TableChangeAction;
  recordId: string;
  updatedBy?: string;
  summary?: string;
}): number {
  const state = getState();
  state.serverVersion += 1;
  const now = new Date().toISOString();
  const tableLabel = TABLE_LABELS[params.tableName] || params.tableName;
  const actor = params.updatedBy || 'system';
  const defaultSummary =
    params.action === 'CREATE'
      ? `${tableLabel} ditambahkan oleh ${actor}`
      : params.action === 'UPDATE'
      ? `${tableLabel} diperbarui oleh ${actor}`
      : params.action === 'DELETE'
      ? `${tableLabel} dihapus oleh ${actor}`
      : `${tableLabel} disinkronkan oleh ${actor}`;

  const event: RealtimeActivityEvent = {
    id: `evt-${Date.now()}-${state.serverVersion}`,
    tableName: params.tableName,
    action: params.action,
    recordId: params.recordId,
    updatedBy: actor,
    summary: params.summary || defaultSummary,
    timestamp: now,
    version: state.serverVersion,
  };

  // Skip spamming activity feed with raw AuditLog/ChangeLog side effects
  if (params.tableName !== 'AuditLog' && params.tableName !== 'ChangeLog') {
    state.recentEvents.unshift(event);
    if (state.recentEvents.length > 30) {
      state.recentEvents.length = 30;
    }
  }

  emitToAll({
    type: 'db:changed',
    tableName: params.tableName,
    action: params.action,
    recordId: params.recordId,
    updatedBy: actor,
    summary: event.summary,
    timestamp: now,
    version: state.serverVersion,
  });

  return state.serverVersion;
}
