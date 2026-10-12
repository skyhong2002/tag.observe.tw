import rateLimit from '@fastify/rate-limit';
import { Queue } from 'bullmq';
import Fastify, { LogController } from 'fastify';
import { Redis } from 'ioredis';
import { registerDbConsole } from './admin/db-console.ts';
import { registerAdminRoutes } from './admin/routes.ts';
import { registerLogin } from './auth/google-login.ts';
import { dbLoginStore } from './auth/store.ts';
import { registerAvatarAdmin } from './avatars/admin.ts';
import { createDb } from './db/client.ts';
import { registerFeeds } from './feeds.ts';
import { isShareImage, legacyRoute } from './legacy-redirects.js';
import { keepMediaCategoriesFresh } from './media-categories.ts';
import { registerExternalTraffic } from './media-traffic/external-routes.ts';
import { registerTaiwanShares } from './media-traffic/taiwan-share.ts';
import { httpDuration, httpRequests, metricsContentType, metricsText, serviceRequests } from './metrics.ts';
import { registerPictureRoutes } from './pictures/routes.ts';
import { API_KEY_MAX_PER_MINUTE, API_MAX_PER_MINUTE, apiKeyLookup } from './reader/api-keys.ts';
import { registerReaderRoutes } from './reader/routes.ts';
import { serviceClients } from './service-clients.ts';
import { registerTagGroupAdmin } from './tag-groups/admin.ts';
import { registerTagVisualAdmin } from './tag-visuals/admin.ts';
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
import { registerTagGroups } from './v1/tag-groups.ts';
import { registerTagPerson } from './v1/tag-person.ts';
import { registerTagVisual } from './v1/tag-visual.ts';
import { registerVocabulary } from './v1/vocabulary.ts';
import { registerWriting } from './v1/writing.ts';
import { registerWritingAdmin } from './writing/admin.ts';

export async function buildApp(
  config,
  {
    logger = false,
    db = /** @type {import('./db/client.ts').Db | null} */ (null),
    loginStore = /** @type {import('./auth/google-login.ts').LoginStore | null} */ (null),
    jobQueue = /** @type {(() => import('./admin/routes.ts').JobQueue) | null} */ (null),
    // Service tokens for the Similarweb request API (tests); the environment otherwise.
    externalTokens = /** @type {Map<string, Buffer> | null} */ (null),
    // Allowlisted observe services for the rate limit (tests); the environment otherwise.
    services = /** @type {import('./service-clients.ts').ServiceClients | null} */ (null),
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
  // Apply after handlers and the limiter, including early 429 responses.
  // Header presence is enough: invalid credentials must not enter a shared cache.
  app.addHook('onSend', async (request, reply, payload) => {
    // TLS terminates at Cloudflare; only the loopback tunnel's external
    // requests carry cf-connecting-ip and its normalized forwarded protocol.
    if (request.protocol === 'https' || (isExternal(request) && request.headers['x-forwarded-proto'] === 'https'))
      reply.header('strict-transport-security', 'max-age=86400');
    else reply.removeHeader('strict-transport-security');
    if (reply.statusCode >= 400) reply.header('cache-control', 'no-store');
    else if (
      request.headers['x-api-key'] !== undefined ||
      request.headers.authorization !== undefined ||
      (/^\/api\/v1(?:\/|\?|$)/.test(request.url) &&
        (request.headers.cookie !== undefined || request.headers['x-service-token'] !== undefined))
    )
      reply.header('cache-control', 'private, no-store');
    return payload;
  });
  // Personal API keys (app/src/reader/api-keys.ts) get their own budget; set
  // once the database is open below.
  /** @type {import('./reader/api-keys.ts').ApiKeyLookup | null} */
  let apiKeys = null;
  if (config.rateLimit !== false) {
    // Our own services (youtube/blog.observe.tw, app/src/service-clients.ts)
    // get a budget of their own per service (the limiter below), and all of
    // them together a shared cap (preHandler, so only requests within their
    // own budget count and one runaway service cannot starve the others).
    const clients = services ?? serviceClients();
    if (clients.names.length) app.log.info({ services: clients.names }, 'service allowlist');
    app.decorateRequest('serviceClient', null);
    app.addHook('onRequest', async (request) => {
      const client = clients.identify(request);
      if (client === false) {
        serviceRequests.inc({ service: 'unknown', via: 'token', outcome: 'bad-token' });
        if (clients.firstThisMinute('log:bad-token')) request.log.warn({ ip: clientIp(request) }, 'unknown service token');
        return;
      }
      if (client) request.serviceClient = client;
    });
    app.addHook('preHandler', async (request, reply) => {
      const client = request.serviceClient;
      if (!client || clients.take()) return;
      if (clients.firstThisMinute('log:total')) request.log.warn({ service: client.service }, 'service requests over the shared cap');
      return reply.code(429).header('retry-after', '60').send({ error: 'too many requests', scope: 'services' });
    });
    app.addHook('onResponse', async (request, reply) => {
      const client = request.serviceClient;
      if (!client) return;
      const outcome = reply.statusCode === 429 ? 'limited' : 'ok';
      serviceRequests.inc({ service: client.service, via: client.via, outcome });
      if (outcome === 'limited' && clients.firstThisMinute(`log:service:${client.service}`))
        request.log.warn({ service: client.service, via: client.via }, 'service rate-limited');
    });
    await app.register(rateLimit, {
      global: true,
      timeWindow: '1 minute',
      max: (request, key) =>
        request.serviceClient
          ? clients.perServiceMax
          : key.startsWith('key:')
            ? API_KEY_MAX_PER_MINUTE
            : request.url.startsWith('/api/')
              ? API_MAX_PER_MINUTE
              : 1200,
      keyGenerator: async (request) => {
        if (request.serviceClient) return `svc:${request.serviceClient.service}`;
        const api = request.url.startsWith('/api/');
        const keyId = api && apiKeys ? await apiKeys.identify(request) : null;
        return keyId ? `key:${keyId}` : `${clientIp(request)}:${api ? 'api' : 'web'}`;
      },
      // Local callers are free, except a service token from loopback, which
      // still counts so a runaway local sync cannot flood the app.
      allowList: (request) => !isExternal(request) && !request.serviceClient,
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
    registerTagPerson(app, own.db);
    registerTagVisual(app, own.db);
    // Similarweb lookups for other services on this machine: loopback and a service token only.
    registerExternalTraffic(app, own.db, externalTokens ? { tokens: externalTokens } : {});
    registerWriting(app, own.db);
    registerTagGroups(app, own.db);
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
  if (own && config.login) registerTaiwanShares(app, own.db, { requireAdmin: login.requireAdmin, origin: config.login.origin });
  if (own && config.login)
    registerAvatarAdmin(app, own.db, {
      requireAdmin: login.requireAdmin,
      origin: config.login.origin,
      queue: jobQueue ?? openQueue,
      uiOrigin: config.uiOrigin,
    });
  if (own && config.login) registerWritingAdmin(app, own.db, { requireAdmin: login.requireAdmin, origin: config.login.origin });
  if (own && config.login) registerTagGroupAdmin(app, own.db, { requireAdmin: login.requireAdmin, origin: config.login.origin });
  if (own && config.login)
    registerTagVisualAdmin(app, own.db, { requireAdmin: login.requireAdmin, origin: config.login.origin, uiOrigin: config.uiOrigin });
  if (own && config.login)
    registerPictureRoutes(app, own.db, {
      currentUser: login.currentUser,
      origin: config.login.origin,
      queue: jobQueue ?? openQueue,
      uiOrigin: config.uiOrigin,
    });
  if (own) apiKeys = apiKeyLookup(own.db);
  if (own && config.login && apiKeys)
    registerReaderRoutes(app, own.db, {
      currentUser: login.currentUser,
      requireAdmin: login.requireAdmin,
      origin: config.login.origin,
      apiKeys,
    });
  if (config.login && config.adminer)
    registerDbConsole(app, { currentUser: login.currentUser, origin: config.login.origin, adminer: config.adminer });
  registerReaderPresence(app);
  registerVocabulary(app);
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
    if (legacy && 'location' in legacy) {
      // 307 carries a search query; only the permanent ones are cacheable.
      if (legacy.status !== 307) reply.header('cache-control', 'public, max-age=86400');
      return reply.code(legacy.status).header('location', legacy.location).send();
    }
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
  // The web server's internal routes (page rebuilds, app/src/pictures/refresh.ts) are for the gateway only.
  app.route({
    method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    url: '/internal/*',
    handler: (_request, reply) => reply.code(404).send({ error: 'not found' }),
  });
  app.route({ method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], url: '/*', handler });
  await app.ready();
  return app;
}
