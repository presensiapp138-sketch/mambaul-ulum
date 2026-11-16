import http from 'http';
import path from 'path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { handleApiRoute, type ApiRequest } from './api/dispatcher.ts';
import { verifyToken } from './api/lib/auth.ts';
import { getTableRecords } from './api/lib/db.ts';
import type { User } from './api/lib/types.ts';
import {
  upsertSession,
  removeSession,
  sweepStaleSessions,
  getActiveUsersSnapshot,
  getRecentEvents,
  getServerVersion,
  subscribeRealtime,
} from './api/lib/realtime.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // All API endpoints handled via shared dispatcher
  app.use('/api', async (req, res) => {
    try {
      const parsedUrl = new URL(req.originalUrl, `http://${req.headers.host || 'localhost'}`);
      const query: Record<string, string | undefined> = {};
      parsedUrl.searchParams.forEach((val, key) => {
        query[key] = val;
      });

      const apiReq: ApiRequest = {
        method: req.method || 'GET',
        url: req.originalUrl,
        headers: req.headers,
        query,
        body: req.body,
      };

      const apiRes = await handleApiRoute(apiReq);
      res.status(apiRes.statusCode);
      for (const [k, v] of Object.entries(apiRes.headers)) {
        res.setHeader(k, v);
      }
      res.end(typeof apiRes.body === 'string' ? apiRes.body : JSON.stringify(apiRes.body));
    } catch (err: any) {
      console.error('Express /api error:', err);
      res.status(500).json({ success: false, error: err?.message || 'Internal Server Error' });
    }
  });

  // Mount Vite middleware in development, or serve static dist in production
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);

  // Real-time WebSocket server running on the same port 3000 (/ws)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  subscribeRealtime((msg) => {
    const payload = JSON.stringify(msg);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  wss.on('connection', (ws) => {
    let boundClientId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Send initial authoritative sync snapshot immediately upon connect
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'sync:welcome',
          serverVersion: getServerVersion(),
          serverTime: new Date().toISOString(),
          activeUsers: getActiveUsersSnapshot(),
          recentEvents: getRecentEvents(),
        })
      );
    }

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          clientId?: string;
          token?: string | null;
          activeTab?: string;
          deviceLabel?: string;
        };

        if (msg.type === 'ping') {
          if (msg.clientId) {
            boundClientId = msg.clientId;
            upsertSession({ clientId: boundClientId });
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'pong',
                serverTime: new Date().toISOString(),
                serverVersion: getServerVersion(),
              })
            );
          }
          return;
        }

        if (msg.type === 'session:join' || msg.type === 'session:update') {
          if (msg.clientId) {
            boundClientId = msg.clientId;
          }

          let verifiedUser: User | undefined;
          const tokenPayload = msg.token ? verifyToken(msg.token) : null;
          if (tokenPayload) {
            const users = await getTableRecords<User>('Users');
            verifiedUser = users.find((u) => u.id === tokenPayload.userId && u.isActive);
          }

          upsertSession({
            clientId: boundClientId,
            userId: verifiedUser?.id || `guest-${boundClientId.slice(0, 6)}`,
            username: verifiedUser?.username || 'kiosk',
            name: verifiedUser?.name || (msg.activeTab === 'kiosk' ? 'Terminal Kiosk Siswa' : 'Pengguna / Pengunjung'),
            role: verifiedUser?.role || 'kiosk',
            activeTab: msg.activeTab || 'portal',
            deviceLabel: msg.deviceLabel || 'Web Browser',
          });

          if (msg.type === 'session:join' && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'sync:welcome',
                serverVersion: getServerVersion(),
                serverTime: new Date().toISOString(),
                activeUsers: getActiveUsersSnapshot(),
                recentEvents: getRecentEvents(),
              })
            );
          }
        }
      } catch (err) {
        console.warn('WebSocket message parse error:', err);
      }
    });

    ws.on('close', () => {
      removeSession(boundClientId);
    });
  });

  // Periodic cleanup for stale disconnected clients
  const sweepTimer = setInterval(() => {
    sweepStaleSessions(90_000);
  }, 30_000);
  sweepTimer.unref?.();

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (HTTP + WebSocket /ws)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
