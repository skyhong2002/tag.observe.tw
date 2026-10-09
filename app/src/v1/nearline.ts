import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export function publicArchiveResponse(value: Record<string, unknown>) {
  const entries = (value.entries as Record<string, unknown>[] | undefined)?.map((entry) => {
    const integration = entry.integration as Record<string, unknown> | null;
    return {
      ...entry,
      artifacts: (entry.artifacts as Record<string, unknown>[]).map(({ role, sha256, bytes, rawBytes }) => ({ role, sha256, bytes, rawBytes })),
      integration: integration
        ? Object.fromEntries(Object.entries(integration).filter(([key]) => !['preparedReceipt', 'applyReceipt'].includes(key)))
        : null,
      ...(entry.reason ? { reason: 'source_unavailable' } : {}),
    };
  });
  return { ...value, entries };
}

export function registerNearline(app: FastifyInstance, options = {
  origin: process.env.TAG_NEARLINE_API_ORIGIN,
  tokenFile: process.env.TAG_NEARLINE_TOKEN_FILE,
}) {
  const proxy = async (request: FastifyRequest, reply: FastifyReply, path: string, publicMetadata = false) => {
    reply.header('cache-control', 'no-store');
    if (!options.origin || !options.tokenFile) return reply.code(503).send({ error: 'nearline_not_configured' });
    const authorization = publicMetadata ? `Bearer ${(await readFile(options.tokenFile, 'utf8')).trim()}` : request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: 'nearline_authorization_required' });
    try {
      const response = await fetch(new URL(path, options.origin), {
        method: request.method,
        headers: { authorization, 'content-type': 'application/json' },
        ...(request.method === 'POST' ? { body: JSON.stringify(request.body) } : {}),
        signal: AbortSignal.timeout(30_000),
      });
      reply.code(response.status);
      if (response.headers.get('content-type') === 'application/gzip' && response.body) {
        reply.header('content-type', 'application/gzip');
        return reply.send(Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream<Uint8Array>));
      }
      const data = await response.json() as Record<string, unknown>;
      return reply.send(publicMetadata && path.startsWith('/query') && response.ok ? publicArchiveResponse(data) : data);
    } catch {
      return reply.code(503).send({ error: 'nearline_service_unavailable' });
    }
  };
  app.get('/api/v1/nearline/archives', async (request, reply) => {
    const query = { ...request.query as Record<string, unknown> };
    if ('limit' in query) query.limit = Number(query.limit);
    return proxy(request, reply, `/query?query=${encodeURIComponent(JSON.stringify(query))}`, true);
  });
  app.get('/api/v1/nearline/status', (request, reply) => proxy(request, reply, '/status', true));
  app.post('/api/v1/nearline/retrievals', (request, reply) => proxy(request, reply, '/retrievals'));
  const retrieval = (action: string) => (request: FastifyRequest<{ Params: { id: string; role?: string }; Querystring: Record<string, string> }>, reply: FastifyReply) => {
    if (!/^[a-f0-9]{32}$/.test(request.params.id) || (request.params.role && !['schema', 'data', 'programs'].includes(request.params.role)))
      return reply.code(404).send({ error: 'retrieval_not_found' });
    const suffix = action === '/files' ? `/files/${request.params.role}` : action;
    return proxy(request, reply, `/retrievals/${request.params.id}${suffix}?${new URLSearchParams(request.query)}`);
  };
  app.get('/api/v1/nearline/retrievals/:id', retrieval(''));
  app.get('/api/v1/nearline/retrievals/:id/results', retrieval('/results'));
  app.get('/api/v1/nearline/retrievals/:id/files/:role', retrieval('/files'));
  app.post<{ Params: { id: string } }>('/api/v1/nearline/retrievals/:id/retry', (request, reply) => {
    if (!/^[a-f0-9]{32}$/.test(request.params.id)) return reply.code(404).send({ error: 'retrieval_not_found' });
    return proxy(request, reply, `/retrievals/${request.params.id}/retry`);
  });
}
