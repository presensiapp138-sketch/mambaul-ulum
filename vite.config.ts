import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { handleApiRoute, ApiRequest } from './api/dispatcher.ts';

// Vite Dev Server middleware plugin to handle /api routes locally
function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api')) {
          return next();
        }

        try {
          let body: unknown = undefined;
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const raw = Buffer.concat(chunks).toString('utf-8');
            if (raw) {
              try {
                body = JSON.parse(raw);
              } catch {
                body = raw;
              }
            }
          }

          const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const query: Record<string, string | undefined> = {};
          parsedUrl.searchParams.forEach((val, key) => {
            query[key] = val;
          });

          const apiReq: ApiRequest = {
            method: req.method || 'GET',
            url: req.url,
            headers: req.headers,
            query,
            body,
          };

          const apiRes = await handleApiRoute(apiReq);

          res.statusCode = apiRes.statusCode;
          for (const [k, v] of Object.entries(apiRes.headers)) {
            res.setHeader(k, v);
          }
          res.end(typeof apiRes.body === 'string' ? apiRes.body : JSON.stringify(apiRes.body));
        } catch (err: any) {
          console.error('API middleware error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      devApiPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'Sistem Presensi Siswa & Guru',
          short_name: 'Presensi',
          description: 'Aplikasi presensi digital cerdas untuk siswa dan guru berbasis deteksi wajah dan scan QR/kartu.',
          theme_color: '#2563eb',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
