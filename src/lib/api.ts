import { queueOfflineItem, getOfflineQueue, removeOfflineItem } from './indexedDb.ts';

const TOKEN_KEY = 'presensi_auth_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  [key: string]: any;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Check if browser is offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    // If it's a POST attendance request, queue it to IndexedDB
    if (options.method === 'POST' && (endpoint.includes('/attendance') || endpoint.includes('/toilet'))) {
      const payload = options.body ? JSON.parse(options.body as string) : {};
      const queueId = `offline-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await queueOfflineItem({
        id: queueId,
        type: endpoint.includes('/toilet') ? 'TOILET_PERMIT' : 'STUDENT_ATTENDANCE',
        payload: { endpoint, ...payload },
        createdAt: new Date().toISOString(),
      });
      return {
        success: true,
        offline: true,
        message: 'Disimpan di antrian offline (akan dikirim otomatis saat online).',
      };
    }
    throw new Error('Anda sedang offline.');
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data.error || data.message || `HTTP ${res.status}: ${res.statusText}`;
      const err = new Error(errMsg);
      (err as any).statusCode = res.status;
      (err as any).response = data;
      throw err;
    }

    return data;
  } catch (err: any) {
    // If network failed suddenly, handle queueing
    if (
      options.method === 'POST' &&
      (endpoint.includes('/attendance') || endpoint.includes('/toilet')) &&
      !err.statusCode
    ) {
      const payload = options.body ? JSON.parse(options.body as string) : {};
      const queueId = `offline-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await queueOfflineItem({
        id: queueId,
        type: endpoint.includes('/toilet') ? 'TOILET_PERMIT' : 'STUDENT_ATTENDANCE',
        payload: { endpoint, ...payload },
        createdAt: new Date().toISOString(),
      });
      return {
        success: true,
        offline: true,
        message: 'Koneksi terputus: Disimpan di antrian offline.',
      };
    }
    throw err;
  }
}

// Flush and sync any pending offline items
export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const queue = await getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const { endpoint, ...bodyData } = item.payload as { endpoint: string; [key: string]: any };
      const res = await apiRequest(endpoint || '/api/attendance/student', {
        method: 'POST',
        body: JSON.stringify(bodyData),
      });

      if (res.success || res.attendance || res.permit) {
        await removeOfflineItem(item.id);
        synced++;
      } else {
        failed++;
      }
    } catch (e) {
      console.warn('Failed to replay offline item:', item.id, e);
      failed++;
    }
  }

  return { synced, failed };
}
