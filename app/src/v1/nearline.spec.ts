import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { afterEach, expect, it, vi } from 'vitest';
import { publicArchiveResponse, registerNearline } from './nearline.ts';

afterEach(() => vi.unstubAllGlobals());

it('omits storage topology and source errors from public metadata', () => {
  const result = publicArchiveResponse({ entries: [{ artifacts: [{ remote: 'secret:share', key: 'private', role: 'data', sha256: 'a', bytes: 1, rawBytes: 2 }], integration: { preparedReceipt: 'private:path', classification: 'nearline_only' }, reason: 'private source error' }] });
  expect(JSON.stringify(result)).not.toContain('private');
  expect(JSON.stringify(result)).not.toContain('secret');
});

it('requires caller authorization for retrieval and forwards it rather than the internal token', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nearline-test-'));
  await writeFile(join(root, 'token'), 'internal-token');
  const app = Fastify();
  registerNearline(app, { origin: 'http://127.0.0.1:18135', tokenFile: join(root, 'token') });
  const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'job' }), { status: 202, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', upstream);
  try {
    expect((await app.inject({ method: 'POST', url: '/api/v1/nearline/retrievals', payload: {} })).statusCode).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
    const response = await app.inject({ method: 'POST', url: '/api/v1/nearline/retrievals', payload: {}, headers: { authorization: 'Bearer user-token' } });
    expect(response.statusCode).toBe(202);
    expect(upstream.mock.calls[0][1].headers.authorization).toBe('Bearer user-token');
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});
