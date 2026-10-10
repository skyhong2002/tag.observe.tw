import rateLimit from '@fastify/rate-limit';
import { Queue } from 'bullmq';
import Fastify, { LogController } from 'fastify';
import { Redis } from 'ioredis';
import { registerDbConsole } from './admin/db-console.ts';
import { registerAdminRoutes } from './admin/routes.ts';
import { registerLogin } from './auth/google-login.ts';
import { dbLoginStore } from './auth/store.ts';
import { createDb } from './db/client.ts';
import { registerFeeds } from './feeds.ts';
import { isShareImage, legacyRoute } from './legacy-redirects.js';
import { keepMediaCategoriesFresh } from './media-categories.ts';
import { httpDuration, httpRequests, metricsContentType, metricsText } from './metrics.ts';
import { createUiProxy } from './ui-proxy.js';
import { registerArticleContent } from './v1/article-content.ts';
import { registerArticleRelated } from './v1/article-related.ts';
import { registerArticleSearch } from './v1/articles.ts';
import { registerBylines } from './v1/bylines.ts';
import { registerJournalists } from './v1/journalists.ts';
import { registerLiveboard } from './v1/liveboard.ts';
import { registerMediaKeywords } from './v1/media-keywords.ts';
import { registerMediaStats } from './v1/media-stats.ts';
import { registerMediaTrafficComparison } from './v1/media-traffic-comparison.ts';
import { registerNearline } from './v1/nearline.ts';
import { registerApiMeta } from './v1/openapi.ts';
import { registerPageApis } from './v1/pages.ts';
import { registerReaderPresence } from './v1/reader-presence.ts';
import { registerV1Routes } from './v1/routes.ts';
import { registerSimilarity } from './v1/similarity.ts';
import { registerSiteObservation } from './v1/site-observation.ts';

export async function buildApp(
  config,
  {
    logger = false,
    db = /** @type {import('./db/client.ts').Db | null} */ (null),
    loginStore = /** @type {import('./auth/google-login.ts').LoginStore | null} */ (null),
    jobQueue = /** @type {(() => import('./admin/routes.ts').JobQueue) | null} */ (null),
  } = {},
) {
  const app = Fastify({
    logger,
    logController: new LogController({ disableRequestLogging: true }),
    exposeHeadRoutes: true,
    routerOptions: { maxParamLength: 8192, ignoreTrailingSlash: false, ignoreDuplicateSlashes: false },
  });
  const startedAt = Date.now();
  // The app listens on 127.0.0.1 only; public traffic arrives via cloudflared,
  // which always sets cf-connecting-ip. Local callers (Prometheus, Next SSR,
  // tools) never carry it.
  const clientIp = (request) => request.headers['cf-connecting-ip'];
  const isExternal = (request) => typeof clientIp(request) === 'string';
  // The API is public and read-only: any site may call it from a browser
  // (added before the rate limiter so 429s carry it too).
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/')) reply.header('access-control-allow-origin', '*');
  });
  if (config.rateLimit !== false) {
    await app.register(rateLimit, {
      global: true,
      timeWindow: '1 minute',
      max: (request) => (request.url.startsWith('/api/') ? 240 : 1200),
      keyGenerator: (request) => `${clientIp(request)}:${request.url.startsWith('/api/') ? 'api' : 'web'}`,
      allowList: (request) => !isExternal(request),
    });
  }
  app.get('/_migration/health', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    return isExternal(request)
      ? { status: 'ok' }
      : { status: 'ok', version: '0.2.0', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) };
  });
  app.get('/metrics', async (request, reply) => {
    if (isExternal(request)) return reply.code(404).type('text/plain; charset=utf-8').send('Not Found\n');
    reply.header('cache-control', 'no-store').header('content-type', metricsContentType);
    return metricsText();
  });
  app.addHook('onResponse', async (request, reply) => {
    const path = request.url.split('?')[0];
    const route =
      request.routeOptions?.url && request.routeOptions.url !== '/*'
        ? request.routeOptions.url
        : path.split('/').slice(0, 2).join('/') || '/';
    const outcome = reply.getHeader('x-tag-outcome') ?? (reply.statusCode === 301 ? 'redirect' : reply.statusCode === 410 ? 'gone' : 'app');
    httpRequests.inc({ route, outcome });
    httpDuration.observe({ route, outcome }, reply.elapsedTime / 1000);
  });
  const own = db ? { db, close: async () => {} } : config.tagDbUrl ? createDb(config.tagDbUrl) : null;
  const labels = own ? keepMediaCategoriesFresh(own.db, { warn: (err) => app.log.warn({ err }, 'media labels refresh failed') }) : null;
  await labels?.ready;
  if (own) {
    await registerV1Routes(app, own.db);
    registerPageApis(app, own.db);
    registerMediaStats(app, own.db);
    registerMediaTrafficComparison(app, own.db);
    registerMediaKeywords(app, own.db);
    registerArticleSearch(app, own.db);
    registerSimilarity(app, own.db);
    registerJournalists(app, own.db);
    registerBylines(app, own.db);
    registerArticleContent(app, own.db);
    registerArticleRelated(app, own.db);
    registerSiteObservation(app, own.db);
    registerLiveboard(app, own.db);
  }
  const login = registerLogin(app, loginStore ?? (own ? dbLoginStore(own.db) : null), config.login ?? null);
  // The worker's queue, opened on the first crawl an admin asks for.
  /** @type {{ redis: Redis; queue: Queue } | null} */
  let jobs = null;
  const openQueue = () => {
    if (!jobs) {
      const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:16379', { maxRetriesPerRequest: null });
      jobs = { redis, queue: new Queue('tag-jobs', { connection: redis }) };
    }
    return /** @type {import('./admin/routes.ts').JobQueue} */ (/** @type {unknown} */ (jobs.queue));
  };
  if (own && config.login)
    registerAdminRoutes(app, own.db, { requireAdmin: login.requireAdmin, origin: config.login.origin, queue: jobQueue ?? openQueue });
  if (config.login && config.adminer)
    registerDbConsole(app, { currentUser: login.currentUser, origin: config.login.origin, adminer: config.adminer });
  registerReaderPresence(app);
  registerNearline(app);
  const proxyToUi = createUiProxy(config.uiOrigin);
  registerApiMeta(app, proxyToUi);
  registerFeeds(app, own?.db ?? null);
  app.addHook('onClose', async () => {
    labels?.stop();
    if (jobs) {
      await jobs.queue.close();
      await jobs.redis.quit();
    }
    if (own) await own.close();
  });
  const handler = async (request, reply) => {
    const legacy = legacyRoute(request.raw.url);
    if (legacy?.status === 301)
      return reply.code(301).header('location', legacy.location).header('cache-control', 'public, max-age=86400').send();
    if (legacy?.status === 410) return reply.code(410).header('cache-control', 'public, max-age=86400').send(legacy.body);
    const path = request.url.split('?')[0];
    // /api/ itself is the docs page (Next) with its share image; anything else under /api/ is JSON.
    const api = path.startsWith('/api/') && path !== '/api/' && !isShareImage(path);
    if (api && request.method === 'OPTIONS')
      return reply
        .code(204)
        .header('access-control-allow-methods', 'GET, HEAD, OPTIONS')
        .header('access-control-allow-headers', request.headers['access-control-request-headers'] ?? '*')
        .header('access-control-max-age', '86400')
        .send();
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return reply.code(405).header('allow', 'GET, HEAD').send({ error: 'method not allowed' });
    if (api) {
      const hint = path.endsWith('/') && path.length > 1 ? `; try ${path.slice(0, -1)}` : '';
      return reply.code(404).send({ error: `no such endpoint${hint}`, docs: '/api/', index: '/api/v1' });
    }
    return proxyToUi(request, reply);
  };
  app.route({ method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], url: '/', handler });
  app.route({ method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], url: '/*', handler });
  await app.ready();
  return app;
}
