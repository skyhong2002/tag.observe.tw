import type { FastifyInstance } from 'fastify';

export const PRESENCE_WINDOW_MS = 90_000;
const MAX_READERS = 50_000;

/** Ephemeral, single-gateway estimate. Never persisted or grouped by IP. */
export function registerReaderPresence(app: FastifyInstance, now = Date.now) {
  const readers = new Map<string, number>();
  const prune = () => {
    const cutoff = now() - PRESENCE_WINDOW_MS;
    for (const [id, seen] of readers) if (seen <= cutoff) readers.delete(id);
  };
  const snapshot = () => ({ activeReaders: readers.size, windowSeconds: PRESENCE_WINDOW_MS / 1000 });
  const cleanup = setInterval(prune, PRESENCE_WINDOW_MS);
  cleanup.unref();
  app.addHook('onClose', async () => clearInterval(cleanup));

  app.get('/api/v1/reader-presence', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    prune();
    return snapshot();
  });
  app.post<{ Body: { id: string; leave?: boolean } }>(
    '/api/v1/reader-presence',
    {
      bodyLimit: 256,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: { type: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' },
            leave: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      reply.header('cache-control', 'no-store');
      // Mutations are for the site's browser only; GET remains public.
      const origin = request.headers.origin;
      if (origin !== 'https://tag.observe.tw' || request.headers['sec-fetch-site'] === 'cross-site') {
        return reply.code(403).send({ error: 'same-origin requests only' });
      }
      prune();
      const { id, leave } = request.body;
      if (leave) readers.delete(id);
      else {
        if (!readers.has(id) && readers.size >= MAX_READERS) return reply.code(503).send({ error: 'presence unavailable' });
        readers.set(id, now());
      }
      return snapshot();
    },
  );
}
