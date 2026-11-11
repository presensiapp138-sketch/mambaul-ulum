import type { IncomingMessage, ServerResponse } from 'http';
import { handleApiRoute, ApiRequest } from './dispatcher.ts';

export default async function handler(req: IncomingMessage & { query?: Record<string, string>; body?: unknown }, res: ServerResponse) {
  try {
    let body = req.body;
    if (!body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
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

    const url = req.url || '/api';
    const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
    const query: Record<string, string | undefined> = {};
    parsedUrl.searchParams.forEach((val, key) => {
      query[key] = val;
    });

    const apiReq: ApiRequest = {
      method: req.method || 'GET',
      url,
      headers: req.headers,
      query: { ...query, ...(req.query || {}) },
      body,
    };

    const apiRes = await handleApiRoute(apiReq);

    res.statusCode = apiRes.statusCode;
    for (const [k, v] of Object.entries(apiRes.headers)) {
      res.setHeader(k, v);
    }
    res.end(typeof apiRes.body === 'string' ? apiRes.body : JSON.stringify(apiRes.body));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Internal Server Error', success: false }));
  }
}
