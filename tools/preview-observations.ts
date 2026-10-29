// Read-only API for an isolated issue-19 preview. Never starts crawlers,
// migrations, authentication or workers; only the new endpoint reads the DB.
// TAG_DB_URL=... TAG_PREVIEW_API_PORT=18420 node tools/preview-observations.ts

import rateLimit from '@fastify/rate-limit';
import replyFrom from '@fastify/reply-from';
import Fastify from 'fastify';
import { createDb } from '../app/src/db/client.ts';
import { registerObservations } from '../app/src/v1/observations.ts';

const port = Number(process.env.TAG_PREVIEW_API_PORT ?? 18420);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid preview API port');
const upstream = new URL(process.env.TAG_PREVIEW_UPSTREAM ?? 'http://127.0.0.1:18130');
if (upstream.hostname !== '127.0.0.1') throw Error('Preview upstream must be a local gateway');
const host = process.env.TAG_PREVIEW_HOST ?? '127.0.0.1';
const ui = process.env.TAG_PREVIEW_UI_ORIGIN ? new URL(process.env.TAG_PREVIEW_UI_ORIGIN) : null;
if (ui && ui.hostname !== '127.0.0.1') throw Error('Preview UI must be local');
const connection = createDb(undefined, { poolSize: 1 });
const app = Fastify({ logger: true, routerOptions: { ignoreTrailingSlash: true } });
await app.register(rateLimit, {
  max: 30,
  timeWindow: '1 minute',
  allowList: (request) => !request.url.startsWith('/api/v1/observations'),
});
await app.register(replyFrom);
app.addHook('onClose', () => connection.close());
registerObservations(app, connection.db);
app.get('/api/v1/*', async (req, reply) => {
  // Do not forward browser cookies or credentials to the production gateway.
  return reply.from(new URL(req.raw.url!, upstream).href, {
    rewriteRequestHeaders: (_request, headers) => {
      const { cookie: _cookie, authorization: _authorization, ...publicHeaders } = headers;
      return publicHeaders;
    },
  });
});
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    void app.close();
  });
if (ui) {
  app.get('/auth/me', async (_req, reply) => {
    reply.header('cache-control', 'no-store');
    return { enabled: false, user: null };
  });
  app.get('/*', async (req, reply) => reply.from(new URL(req.raw.url!, ui).href));
}
await app.listen({ port, host });
