import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { afterEach, expect, it, vi } from 'vitest';
import { nearlineAvailability, registerApiStatus, type StatusPageRenderer } from './api-status.ts';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('reports real service availability without claiming every endpoint was tested', async () => {
  const app = Fastify();
  const check = vi.fn<() => Promise<'ok' | 'unavailable'>>().mockResolvedValueOnce('ok').mockResolvedValueOnce('unavailable');
  registerApiStatus(app, [{ path: '/api/v1/nearline/archives', summary: '查詢封存資料' }], check);
  try {
    const healthy = (await app.inject('/api/status')).json();
    expect(healthy.status).toBe('ok');
    expect(healthy.services[1].status).toBe('ok');
    expect(healthy.endpoints).toEqual([{ path: '/api/v1/nearline/archives', method: 'GET', description: '查詢封存資料' }]);
    expect(healthy.endpoints[0]).not.toHaveProperty('status');
    const unavailable = (await app.inject('/api/status')).json();
    expect(unavailable.status).toBe('degraded');
    expect(unavailable.services[1].status).toBe('unavailable');
  } finally {
    await app.close();
  }
});

it.each(['/api/status', '/api/status/'])('delegates HTML and Next navigation at %s without probing twice', async (url) => {
  const app = Fastify();
  const check = vi.fn<() => Promise<'ok' | 'unavailable'>>().mockResolvedValue('ok');
  const render = vi.fn<StatusPageRenderer>(async (_request, reply) =>
    reply.type('text/html').header('vary', 'RSC, Next-Router-State-Tree').send('site layout'),
  );
  registerApiStatus(app, [], check, render);
  try {
    for (const headers of [{ accept: 'text/html' }, { accept: '*/*', rsc: '1' }]) {
      const response = await app.inject({ url, headers });
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers.vary).toContain('Accept');
      expect(response.headers.vary).toContain('Next-Router-State-Tree');
      expect(response.body).toBe('site layout');
    }
    expect(render).toHaveBeenCalledTimes(2);
    expect(check).not.toHaveBeenCalled();
    const json = await app.inject({ url, headers: { accept: 'application/json' } });
    expect(json.json().status).toBe('ok');
    expect(json.headers['cache-control']).toBe('no-store');
    expect(check).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(2);
  } finally {
    await app.close();
  }
});

it('discards upstream machine details and returns no error or token data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'api-status-'));
  await writeFile(join(root, 'token'), 'private-token');
  vi.stubEnv('TAG_NEARLINE_API_ORIGIN', 'http://internal.example');
  vi.stubEnv('TAG_NEARLINE_TOKEN_FILE', join(root, 'token'));
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ privatePath: '/home/secret', disk: 123, token: 'secret' })))
      .mockRejectedValueOnce(new Error('/home/secret private-token')),
  );
  try {
    expect(await nearlineAvailability()).toBe('ok');
    expect(await nearlineAvailability()).toBe('unavailable');
  } finally {
    await rm(root, { recursive: true });
  }
});
