import { once } from 'node:events';
import { createServer } from 'node:http';
import { expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

it('sets host-only one-day HSTS on HTTPS HTML, API, static and error responses, overriding upstream policy', async () => {
  const ui = createServer((req, res) => {
    res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains; preload');
    res.statusCode = req.url === '/missing/' ? 404 : 200;
    res.end('fixture');
  });
  ui.listen(0, '127.0.0.1');
  await once(ui, 'listening');
  const app = await buildApp({ uiOrigin: `http://127.0.0.1:${(ui.address() as { port: number }).port}` });
  const https = { 'cf-connecting-ip': '203.0.113.243', 'x-forwarded-proto': 'https' };
  try {
    for (const [url, status] of [
      ['/', 200],
      ['/api/v1/openapi.json', 200],
      ['/_next/static/fixture.js', 200],
      ['/missing/', 404],
      ['/api/missing', 404],
      ['/api/old.php', 410],
    ] as const) {
      const response = await app.inject({ url, headers: https });
      expect(response.statusCode).toBe(status);
      expect(response.headers['strict-transport-security']).toBe('max-age=86400');
    }
    for (const headers of [{}, { ...https, 'x-forwarded-proto': 'http' }, { 'x-forwarded-proto': 'https' }]) {
      const response = await app.inject({ url: '/', headers });
      expect(response.headers['strict-transport-security']).toBeUndefined();
    }
    for (let i = 0; i < 60; i++) await app.inject({ url: '/api/old.php', headers: https });
    const limited = await app.inject({ url: '/api/old.php', headers: https });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['strict-transport-security']).toBe('max-age=86400');
    await new Promise<void>((resolve, reject) => ui.close((err) => (err ? reject(err) : resolve())));
    const unavailable = await app.inject({ url: '/', headers: https });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.headers['strict-transport-security']).toBe('max-age=86400');
  } finally {
    await app.close();
    if (ui.listening) ui.close();
  }
});
