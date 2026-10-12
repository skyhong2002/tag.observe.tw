import { gzipSync } from 'node:zlib';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { SnapshotError, VocabularySnapshots } from '../vocabulary/snapshots.ts';

export function registerVocabulary(app: FastifyInstance, directory = process.env.TAG_VOCABULARY_EXPORT_DIR) {
  const store = directory ? new VocabularySnapshots(directory) : null;
  async function serve(reply: FastifyReply, load: (store: VocabularySnapshots) => Promise<unknown>, immutable = false, encoding = '') {
    if (!store) return reply.code(503).header('cache-control', 'no-store').send({ error: 'vocabulary export unavailable' });
    try {
      const result = await load(store);
      reply.header('vary', 'accept-encoding');
      reply.header('cache-control', immutable ? 'public, max-age=86400, immutable' : 'public, max-age=60');
      if (
        encoding.split(',').some((part) => {
          const [name, ...params] = part.trim().split(';');
          const q = params.find((p) => p.trim().startsWith('q='));
          return name === 'gzip' && (!q || Number(q.trim().slice(2)) > 0);
        })
      ) {
        reply.header('vary', 'accept-encoding').header('content-encoding', 'gzip').type('application/json; charset=utf-8');
        return reply.send(gzipSync(JSON.stringify(result), { level: 1 }));
      }
      return result;
    } catch (error) {
      const code = error instanceof SnapshotError ? error.code : 'unavailable';
      const status = code === 'not-found' ? 404 : code === 'invalid' ? 400 : code === 'resnapshot-required' ? 409 : 503;
      return reply
        .code(status)
        .header('cache-control', 'no-store')
        .send({ error: code, ...(status === 409 ? { resnapshotRequired: true } : {}) });
    }
  }
  app.get('/api/v1/vocabulary/snapshots/current', async (_request, reply) =>
    serve(reply, (s) => s.current(), false, _request.headers['accept-encoding']),
  );
  app.get<{ Params: { id: string }; Querystring: { cursor?: string; compact?: string; limit?: string } }>(
    '/api/v1/vocabulary/snapshots/:id',
    async (request, reply) =>
      serve(
        reply,
        (s) => s.page(request.params.id, request.query.cursor, 'terms', request.query.compact === '1', Number(request.query.limit ?? 500)),
        true,
        request.headers['accept-encoding'],
      ),
  );
  app.get<{ Params: { id: string }; Querystring: { cursor?: string; compact?: string; limit?: string } }>(
    '/api/v1/vocabulary/snapshots/:id/active',
    async (request, reply) =>
      serve(
        reply,
        (s) => s.page(request.params.id, request.query.cursor, 'active', request.query.compact === '1', Number(request.query.limit ?? 500)),
        true,
        request.headers['accept-encoding'],
      ),
  );
  app.get<{ Querystring: { after?: string; target?: string; cursor?: string } }>('/api/v1/vocabulary/changes', async (request, reply) => {
    if (typeof request.query.after !== 'string')
      return reply.code(400).header('cache-control', 'no-store').send({ error: 'after is required' });
    return serve(
      reply,
      (s) => s.changes(request.query.after!, request.query.target, request.query.cursor),
      Boolean(request.query.target),
      request.headers['accept-encoding'],
    );
  });
}
