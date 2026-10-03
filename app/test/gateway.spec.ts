import { once } from 'node:events';
import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { legacyRoute } from '../src/legacy-redirects.js';

describe('legacyRoute', () => {
  it('maps old tag.analysis.tw URL shapes onto new pages', () => {
    const cases: Array<[string, string]> = [
      ['/index.php', '/'],
      ['/index.php?type=3c', '/ranking/?category=3c'],
      ['/tag.php?tag=%E5%B7%9D%E6%99%AE', '/tag/%E5%B7%9D%E6%99%AE/'],
      ['/tag/%E5%B7%9D%E6%99%AE/news/', '/tag/%E5%B7%9D%E6%99%AE/'],
      ['/tag/%E5%B7%9D%E6%99%AE/add/2026-01-01/', '/tag/%E5%B7%9D%E6%99%AE/'],
      ['/cat/news/tag/abc/series/', '/tag/abc/'],
      ['/cat/news/event/2026-01-01/08/', '/event/?at=2026-01-01T00%3A00%3A00.000Z'],
      ['/event/2026-09-28/', '/event/archive/?day=2026-09-28'],
      ['/cat/3c/chart/', '/ranking/?category=3c'],
      ['/event.php?limit=10', '/event/'],
      ['/event/2026-09-28/08/', '/event/?at=2026-09-28T00%3A00%3A00.000Z'],
      ['/event/whatever/', '/event/'],
      ['/eve.php?eve=3', '/event/'],
      ['/events/x', '/event/'],
      ['/topic/media.php?media=cna', '/topic/cna/'],
      ['/topic/media.php?media=%3Cx%3E', '/topic/'],
      ['/topic/index.php', '/topic/'],
      ['/news/setn/123/', '/media/setn/'],
      ['/media/setn/news/', '/media/setn/'],
    ];
    for (const [from, to] of cases) expect(legacyRoute(from), from).toEqual({ status: 301, location: to });
  });
  it('returns 410 with a replacement for the legacy PHP API', () => {
    const r = legacyRoute('/api/tag.php?limit=3');
    expect(r).toMatchObject({ status: 410, body: { error: 'gone', replacement: '/api/v1/ranking' } });
    expect(legacyRoute('/api/unknown.php')).toMatchObject({ status: 410, body: { replacement: null } });
  });
  it('leaves new-site paths alone', () => {
    for (const p of [
      '/',
      '/?category=news',
      '/ranking/?category=news',
      '/tag/x/',
      '/event/',
      '/event/archive/',
      '/eve/12/',
      '/topic/',
      '/topic/cna/',
      '/media/setn/',
      '/media/rti/articles',
      '/media/rti/articles/',
      '/media/rti/articles/?cursor=123',
      '/media/setn/articles/?cursor=456',
      '/article/123/',
      '/_next/static/a.js',
      '/api/v1/ranking',
    ])
      expect(legacyRoute(p), p).toBeNull();
  });
});

describe('gateway', () => {
  let hits: string[] = [];
  const ui = createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`);
    res.setHeader('content-type', 'text/html');
    res.end(`<h1>next:${req.url}</h1>`);
  });
  let app: Awaited<ReturnType<typeof buildApp>>;
  const external = (ip = '203.0.113.7') => ({ 'cf-connecting-ip': ip });
  beforeAll(async () => {
    ui.listen(0, '127.0.0.1');
    await once(ui, 'listening');
    app = await buildApp({ uiOrigin: `http://127.0.0.1:${(ui.address() as { port: number }).port}` });
  });
  afterAll(async () => {
    await app.close();
    ui.close();
  });

  it('renders every non-API page through the UI, including unknown paths (Next 404s them)', async () => {
    hits = [];
    for (const p of ['/', '/tag/x/', '/eve/1/', '/does-not-exist', '/app/src/server.js'])
      expect((await app.inject(p)).body).toBe(`<h1>next:${p}</h1>`);
    expect(hits).toHaveLength(5);
    const head = await app.inject({ method: 'HEAD', url: '/' });
    expect(head.statusCode).toBe(200);
    expect(head.body).toBe('');
  });
  it('redirects legacy URLs and never contacts the old site', async () => {
    hits = [];
    const r = await app.inject('/tag/abc/news/');
    expect(r.statusCode).toBe(301);
    expect(r.headers.location).toBe('/tag/abc/');
    const g = await app.inject('/api/news.php?hours=1');
    expect(g.statusCode).toBe(410);
    expect(g.json().error).toBe('gone');
    expect(hits).toHaveLength(0);
  });
  it('proxies article archive pages and pagination to the UI without legacy redirects', async () => {
    hits = [];
    const paths = ['/media/rti/', '/media/rti/articles', '/media/rti/articles/', '/media/rti/articles/?cursor=123', '/article/123/'];
    for (const path of paths) {
      const response = await app.inject(path);
      expect(response.statusCode, path).toBe(200);
      expect(response.headers.location, path).toBeUndefined();
      expect(response.body, path).toBe(`<h1>next:${path}</h1>`);
    }
    expect(hits).toEqual(paths.map((path) => `GET ${path}`));
    const head = await app.inject({ method: 'HEAD', url: '/media/rti/articles/' });
    expect(head.statusCode).toBe(200);
    expect(head.headers.location).toBeUndefined();
    expect(head.body).toBe('');
  });
  it('rejects non-GET methods on pages', async () => {
    expect((await app.inject({ method: 'POST', url: '/' })).statusCode).toBe(405);
  });
  it('hides /metrics and trims health for external callers', async () => {
    expect((await app.inject('/metrics')).statusCode).toBe(200);
    expect((await app.inject({ url: '/metrics', headers: external() })).statusCode).toBe(404);
    expect((await app.inject({ url: '/_migration/health', headers: external() })).json()).toEqual({ status: 'ok' });
    expect((await app.inject('/_migration/health')).json()).toHaveProperty('uptimeSeconds');
  });
  it('rate-limits external callers per client IP, never local callers', async () => {
    let last = 0;
    for (let i = 0; i < 241; i++) last = (await app.inject({ url: '/api/x.php', headers: external('198.51.100.9') })).statusCode;
    expect(last).toBe(429);
    expect((await app.inject({ url: '/api/x.php', headers: external('198.51.100.10') })).statusCode).toBe(410);
    for (let i = 0; i < 300; i++) expect((await app.inject('/api/x.php')).statusCode).toBe(410);
  });
  it('blocks non-allowlisted image URLs before they reach the UI', async () => {
    hits = [];
    expect((await app.inject('/_next/image?url=https%3A%2F%2Fwww.google.com%2Ffavicon.ico&w=64&q=75')).statusCode).toBe(400);
    expect(hits).toHaveLength(0);
    expect((await app.inject('/_next/image?url=https%3A%2F%2Fattach.setn.com%2Fa.jpg&w=64&q=75')).statusCode).toBe(200);
    expect(hits).toHaveLength(1);
  });
  it('returns 503 when the UI is down', async () => {
    const down = await buildApp({ uiOrigin: 'http://127.0.0.1:9' });
    try {
      expect((await down.inject('/')).statusCode).toBe(503);
    } finally {
      await down.close();
    }
  });
});
