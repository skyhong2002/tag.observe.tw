import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('gateway cache boundaries', () => {
  it('keeps anonymous success public and every credential-bearing API success private, even invalid or empty headers', async () => {
    const app = await buildApp({ uiOrigin: 'http://127.0.0.1:9' });
    try {
      const anonymous = await app.inject('/api/v1/openapi.json');
      expect(anonymous.statusCode).toBe(200);
      expect(anonymous.headers['cache-control']).toBe('public, max-age=3600');
      for (const headers of [
        { 'x-api-key': 'cache-header-fixture' },
        { 'x-api-key': '' },
        { authorization: 'Bearer cache-header-fixture' },
        { authorization: '' },
        { cookie: 'cache-header-fixture=invalid' },
        { cookie: '' },
        { 'x-service-token': 'cache-header-fixture' },
        { 'x-service-token': '' },
      ]) {
        const response = await app.inject({ url: '/api/v1/openapi.json', headers });
        expect(response.statusCode).toBe(200);
        expect(response.headers['cache-control']).toBe('private, no-store');
      }
    } finally {
      await app.close();
    }
  });
  it('overrides cache headers on legacy errors, handler failures and rate-limiter 429s', async () => {
    const app = await buildApp({ uiOrigin: 'http://127.0.0.1:9' });
    try {
      for (const [url, status] of [
        ['/api/x.php', 410],
        ['/api/no-such-route', 404],
        ['/', 503],
      ] as const) {
        const r = await app.inject(url);
        expect(r.statusCode).toBe(status);
        expect(r.headers['cache-control']).toBe('no-store');
      }
      for (const header of ['cookie', 'authorization', 'x-service-token', 'x-api-key']) {
        const failed = await app.inject({ url: '/api/v1/articles?limit=invalid', headers: { [header]: 'invalid' } });
        expect(failed.statusCode).toBeGreaterThanOrEqual(400);
        expect(failed.headers['cache-control']).toBe('no-store');
      }
      for (let i = 0; i < 60; i++) await app.inject({ url: '/api/x.php', headers: { 'cf-connecting-ip': '203.0.113.221' } });
      const limited = await app.inject({ url: '/api/x.php', headers: { 'cf-connecting-ip': '203.0.113.221' } });
      expect(limited.statusCode).toBe(429);
      expect(limited.headers['cache-control']).toBe('no-store');
      expect(limited.headers['retry-after']).toBeDefined();
    } finally {
      await app.close();
    }
  });
});
