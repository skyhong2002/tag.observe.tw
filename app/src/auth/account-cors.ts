import type { FastifyInstance } from 'fastify';

export const LIVE_OBSERVE_ORIGIN = 'https://live.observe.tw';
const paths = ['/auth/me', '/auth/me/live-observe', '/auth/logout'];

/** Credentials stay on tag.observe.tw; only the dashboard's account surface is shared. */
export function registerAccountCors(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (!paths.includes(path) || request.headers.origin !== LIVE_OBSERVE_ORIGIN) return;
    reply.header('access-control-allow-origin', LIVE_OBSERVE_ORIGIN);
    reply.header('access-control-allow-credentials', 'true');
    reply.header('vary', 'Origin');
    reply.header('cache-control', 'private, no-store');
  });
  for (const path of paths)
    app.options(path, async (request, reply) => {
      const method = request.headers['access-control-request-method'];
      const allowed = path === '/auth/me' ? ['GET'] : path === '/auth/logout' ? ['POST'] : ['GET', 'PUT'];
      const headers = String(request.headers['access-control-request-headers'] || '')
        .toLowerCase()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (request.headers.origin !== LIVE_OBSERVE_ORIGIN || !allowed.includes(String(method)) || headers.some((h) => h !== 'content-type'))
        return reply.code(403).send({ error: 'origin or method not allowed' });
      return reply
        .header('access-control-allow-methods', allowed.join(', '))
        .header('access-control-allow-headers', 'Content-Type')
        .header('access-control-max-age', '600')
        .code(204)
        .send();
    });
}

export function dashboardReturn(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u0020\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.origin === LIVE_OBSERVE_ORIGIN && !url.username && !url.password && ['/', '/liveboard/setting/'].includes(url.pathname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
