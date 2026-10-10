import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { afterEach, expect, it, vi } from 'vitest';
import { nearlineAvailability, registerApiStatus } from './api-status.ts';

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

it('renders a browser page and escapes endpoint descriptions', async () => {
  const app = Fastify();
  registerApiStatus(app, [{ path: '/api/status', summary: '<script>unsafe</script>' }], async () => 'ok');
  try {
    const response = await app.inject({ url: '/api/status', headers: { accept: 'text/html' } });
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toContain('Nearline：正常');
    expect(response.body).toContain('&lt;script&gt;');
    expect(response.body).not.toContain('<script>unsafe');
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
