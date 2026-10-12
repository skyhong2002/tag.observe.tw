import { request as undiciRequest } from 'undici';
import { imageRequestAllowed } from './image-allowlist.js';

// Everything that is not the gateway's own API is rendered by the Next.js SSR
// app on UI_ORIGIN (loopback only), including its 404 page.
const HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
]);
// Credentials stay with the gateway: the Next app reads no cookies or
// authorization (sessions are checked by the gateway's /auth routes), so it
// never needs them, and a forwarding mistake can never leak them.
const CREDENTIALS = new Set(['cookie', 'authorization', 'x-service-token']);

/**
 * The UI URL for a request path, or null when the path could leave the UI
 * origin. Only a single leading `/` is allowed: `//host/x` and `/\host/x`
 * would make URL() switch host (protocol-relative), and so would their
 * percent-encoded forms once decoded. The result must still be on `base`.
 */
export function uiTarget(rawUrl, base) {
  if (typeof rawUrl !== 'string' || !rawUrl.startsWith('/')) return null;
  const q = rawUrl.indexOf('?');
  const path = q < 0 ? rawUrl : rawUrl.slice(0, q);
  let decoded = path;
  try {
    // Decode repeatedly so %252F%252F is caught too.
    for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(decoded); i++) decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (/^[/\\]{2}|^\/[\\]/.test(path) || /^[/\\]{2}|^\/[\\]/.test(decoded) || /[\\]/.test(path)) return null;
  // Built from the origin and the path only, never URL(raw, base).
  const target = new URL(base.origin + rawUrl);
  if (target.origin !== base.origin) return null;
  return target;
}

/**
 * Next marks ISR pages `s-maxage=<revalidate>, stale-while-revalidate=<about a
 * year>`. A shared cache (Cloudflare) honouring that could serve a day-old
 * page from a quiet edge, so cap it: a minute fresh, five more minutes stale
 * while it refetches. Browsers always revalidate (max-age=0). Dynamic pages
 * (no-store) are left alone. Cookies never reach Next (CREDENTIALS), so ISR
 * pages carry no per-reader content.
 */
export function edgeCacheControl(status, value) {
  return status === 200 && typeof value === 'string' && /\bs-maxage=\d+/.test(value) && !/\b(?:private|no-store)\b/.test(value)
    ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
    : value;
}

export function createUiProxy(origin, { request = undiciRequest, timeout = 15000 } = {}) {
  const base = new URL(origin);
  return async function proxyToUi(req, reply) {
    if (/^\/_next\/image\/?$/.test(req.raw.url.split('?')[0]) && !imageRequestAllowed(req.raw.url)) {
      return reply.code(400).type('text/plain; charset=utf-8').header('x-tag-outcome', 'blocked').send('image host not allowed\n');
    }
    const target = uiTarget(req.raw.url, base);
    if (!target) return reply.code(400).type('text/plain; charset=utf-8').header('x-tag-outcome', 'blocked').send('bad path\n');
    const headers = {};
    for (const [key, value] of Object.entries(req.headers))
      if (!HOP.has(key) && !CREDENTIALS.has(key) && key !== 'host') headers[key] = value;
    headers['x-forwarded-host'] = req.headers.host ?? '';
    headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] ?? 'https';
    let upstream;
    try {
      upstream = await request(target, { method: req.method, headers, headersTimeout: timeout, bodyTimeout: timeout });
    } catch (error) {
      req.log.warn({ err: error?.message }, 'ui origin unavailable');
      return reply
        .code(503)
        .type('text/plain; charset=utf-8')
        .header('retry-after', '5')
        .header('x-tag-outcome', 'ui-down')
        .send('UI temporarily unavailable\n');
    }
    reply.code(upstream.statusCode);
    for (const [key, value] of Object.entries(upstream.headers)) if (!HOP.has(key)) reply.header(key, value);
    const cacheControl = edgeCacheControl(upstream.statusCode, upstream.headers['cache-control']);
    if (cacheControl) reply.header('cache-control', cacheControl);
    reply.header('x-tag-outcome', 'ui');
    if (req.method === 'HEAD') {
      await upstream.body.dump();
      return reply.send();
    }
    return reply.send(upstream.body);
  };
}
