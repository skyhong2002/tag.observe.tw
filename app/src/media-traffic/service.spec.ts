import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerExternalTraffic } from './external-routes.ts';
import { emptyTraffic } from './live.ts';
import { emptyRadar } from './radar.ts';
import { syncFromService, syncRadarFromService, trafficService } from './service.ts';

const service = { url: 'http://127.0.0.1:18150', token: 'x'.repeat(40) };

describe('trafficService', () => {
  it('needs both settings and a loopback address', () => {
    expect(trafficService({})).toBeNull();
    expect(trafficService({ TAG_TRAFFIC_SERVICE_URL: 'http://127.0.0.1:18150/', TAG_TRAFFIC_SERVICE_TOKEN: 't' })).toEqual({
      url: 'http://127.0.0.1:18150',
      token: 't',
    });
    expect(() => trafficService({ TAG_TRAFFIC_SERVICE_URL: 'https://traffic.observe.tw', TAG_TRAFFIC_SERVICE_TOKEN: 't' })).toThrow();
  });
});

describe('syncFromService', () => {
  it('registers the outlets and mirrors the stored months as a snapshot', async () => {
    const calls: Array<{ method: string; path: string; body: unknown; auth: string }> = [];
    const request = (async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      calls.push({
        method: init.method as string,
        path,
        body: JSON.parse(init.body as string),
        auth: (init.headers as Record<string, string>).authorization,
      });
      if (path === '/internal/v1/watch') return Response.json({ watched: 2, refused: [] });
      return Response.json({
        lastRun: { startedAt: '2026-10-21T09:35:00.000Z', refused: false, note: null },
        domains: [{ domain: 'udn.com', fetchedAt: '2026-10-21T09:35:10.000Z', monthly: [{ month: '202609', visits: 5 }], profiles: {} }],
        state: {
          'udn.com': { lastAttemptAt: '2026-10-21T09:35:10.000Z', lastSuccessAt: '2026-10-21T09:35:10.000Z', failures: 0 },
          'x.com': { lastAttemptAt: '2026-10-20T00:00:00.000Z', lastSuccessAt: null, failures: 2 },
        },
      });
    }) as unknown as typeof fetch;
    const result = await syncFromService(['udn.com', 'x.com'], emptyTraffic(), service, { request });
    expect(calls.map((c) => [c.method, c.path])).toEqual([
      ['PUT', '/internal/v1/watch'],
      ['POST', '/internal/v1/traffic'],
    ]);
    expect(calls[0].body).toEqual({ domains: ['udn.com', 'x.com'], refreshDays: 7 });
    expect(calls[0].auth).toBe(`Bearer ${service.token}`);
    expect(result).toMatchObject({
      status: 'ok',
      checkedAt: '2026-10-21T09:35:00.000Z',
      updated: 1,
      failedAt: { 'x.com': '2026-10-20T00:00:00.000Z' },
    });
    expect(result.domains.map((d) => d.domain)).toEqual(['udn.com']);
  });
});

describe('syncRadarFromService', () => {
  it('mirrors the latest Radar period per outlet and keeps outlets the service lacks', async () => {
    const paths: string[] = [];
    const request = (async (url: string) => {
      paths.push(new URL(url).pathname);
      return Response.json({
        lastRun: {
          startedAt: '2026-10-21T19:35:00.000Z',
          finishedAt: '2026-10-21T19:55:00.000Z',
          ok: 900,
          failed: 0,
          blocked: false,
          note: null,
        },
        domains: {
          'udn.com': [
            {
              domain: 'udn.com',
              fetchedAt: '2026-10-14T19:40:00.000Z',
              dateStart: '2026-10-12T00:00:00.000Z',
              dateEnd: '2026-10-12T00:00:00.000Z',
              rank: null,
              bucket: 50000,
              bucketLowerBound: null,
            },
            {
              domain: 'udn.com',
              fetchedAt: '2026-10-21T19:40:00.000Z',
              dateStart: '2026-10-19T00:00:00.000Z',
              dateEnd: '2026-10-19T00:00:00.000Z',
              rank: null,
              bucket: 20000,
              bucketLowerBound: null,
            },
          ],
        },
      });
    }) as unknown as typeof fetch;
    const old = {
      domain: 'x.com.tw',
      fetchedAt: '2026-10-01T00:00:00.000Z',
      dateStart: '2026-09-28T00:00:00.000Z',
      dateEnd: '2026-09-28T00:00:00.000Z',
      rank: null,
      bucket: null,
      bucketLowerBound: 200000,
    };
    const result = await syncRadarFromService(['udn.com', 'x.com.tw'], { ...emptyRadar(), domains: [old] }, service, { request });
    expect(paths).toEqual(['/internal/v1/radar']);
    expect(result).toMatchObject({ status: 'ok', checkedAt: '2026-10-21T19:35:00.000Z', error: null });
    expect(result.domains).toEqual([
      old,
      expect.objectContaining({ domain: 'udn.com', bucket: 20000, dateEnd: '2026-10-19T00:00:00.000Z' }),
    ]);
  });
});

describe('/internal/similarweb with the service configured', () => {
  it('forwards authenticated loopback calls unchanged and still 404s everything else', async () => {
    const upstream = Fastify();
    const seen: Array<{ url: string; auth?: string; body: unknown }> = [];
    upstream.all('/internal/similarweb/*', async (request, reply) => {
      seen.push({ url: request.url, auth: request.headers.authorization, body: request.body });
      return reply.code(202).send({ domain: 'x.com.tw', status: 'pending' });
    });
    await upstream.listen({ host: '127.0.0.1', port: 0 });
    const port = (upstream.server.address() as { port: number }).port;
    const app = Fastify();
    const token = 'b'.repeat(40);
    registerExternalTraffic(app, {} as never, {
      tokens: new Map([['blog', Buffer.from(token)]]),
      service: { url: `http://127.0.0.1:${port}`, token: 'unused' },
    });
    try {
      const ok = await app.inject({
        method: 'POST',
        url: '/internal/similarweb/requests',
        headers: { authorization: `Bearer ${token}` },
        payload: { domain: 'x.com.tw' },
      });
      expect(ok.statusCode).toBe(202);
      expect(seen).toEqual([{ url: '/internal/similarweb/requests', auth: `Bearer ${token}`, body: { domain: 'x.com.tw' } }]);
      const get = await app.inject({ url: '/internal/similarweb/results?domain=x.com.tw', headers: { authorization: `Bearer ${token}` } });
      expect(get.statusCode).toBe(202);
      expect(seen[1].url).toBe('/internal/similarweb/results?domain=x.com.tw');
      const outside = await app.inject({
        method: 'POST',
        url: '/internal/similarweb/requests',
        headers: { authorization: `Bearer ${token}`, 'cf-connecting-ip': '1.2.3.4' },
        payload: { domain: 'x.com.tw' },
      });
      expect(outside.statusCode).toBe(404);
      expect(seen).toHaveLength(2);
    } finally {
      await app.close();
      await upstream.close();
    }
  });
});
