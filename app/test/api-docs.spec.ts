import { once } from 'node:events';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderApiMarkdown } from '../../tools/gen-api-docs.ts';
import { buildApp } from '../src/app.js';
import { encodeCursor, parseArticleQuery } from '../src/v1/articles.ts';
import { buildOpenApi, ENDPOINTS, examplePath, operationId } from '../src/v1/openapi.ts';

const root = new URL('../../', import.meta.url);
const v1 = new URL('app/src/v1/', root);
// Public API route literals registered in app/src/v1.
const registered = readdirSync(v1)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
  .flatMap((f) =>
    [...readFileSync(new URL(f, v1), 'utf8').matchAll(/app\.(?:get|post)(?:<[^(]*?>)?\(\s*'(\/api\/(?:v1|status)[^']*)'/g)].map(
      (m) => m[1],
    ),
  )
  .map((r) => r.replace(/:(\w+)/g, '{$1}'));

describe('OpenAPI description', () => {
  it('documents every registered /api/v1 route, and nothing else', () => {
    const documented = ENDPOINTS.map((e) => e.path).filter((p) => p !== '/api/v1');
    expect(registered.length).toBeGreaterThan(10);
    expect([...documented].sort()).toEqual([...new Set(registered)].sort());
  });
  it('is internally consistent', () => {
    const spec = buildOpenApi();
    const json = JSON.stringify(spec);
    for (const [, name] of json.matchAll(/"#\/components\/schemas\/(\w+)"/g)) expect(spec.components.schemas, name).toHaveProperty(name);
    const ids = ENDPOINTS.map((e) => operationId(e.path));
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of ENDPOINTS) {
      for (const [, name] of e.path.matchAll(/\{(\w+)\}/g))
        expect(
          e.params?.find((x) => x.name === name && x.in === 'path'),
          `${e.path} ${name}`,
        ).toBeTruthy();
      expect(examplePath(e), e.path).toMatch(/^\/api\/(?:v1|status)[^{}]*$/);
    }
  });
  it('docs/api.md is generated from the current spec (run: node tools/gen-api-docs.ts)', () => {
    expect(readFileSync(new URL('docs/api.md', root), 'utf8')).toBe(renderApiMarkdown());
  });
});

describe('parseArticleQuery', () => {
  const now = new Date('2026-10-01T00:00:00Z');
  it('defaults to the last 24 hours, 50 rows', () => {
    const r = parseArticleQuery({}, now);
    expect(r).toMatchObject({ q: null, media: null, limit: 50, until: now, since: new Date('2026-09-30T00:00:00Z') });
  });
  it('reads bare days as Taipei days and validates the window', () => {
    expect(parseArticleQuery({ since: '2026-09-30', until: '2026-10-01' }, now)).toMatchObject({
      since: new Date('2026-09-29T16:00:00Z'),
      until: new Date('2026-09-30T16:00:00Z'),
    });
    expect(parseArticleQuery({ since: '2026-01-01' }, now)).toEqual({ error: 'window longer than 31 days' });
    expect(parseArticleQuery({ until: 'nope' }, now)).toEqual({ error: 'bad until' });
    expect(parseArticleQuery({ since: 'nope' }, now)).toEqual({ error: 'bad since' });
    expect(parseArticleQuery({ since: '2026-10-02' }, now)).toEqual({ error: 'since must be before until' });
    expect(parseArticleQuery({ hours: '-1' }, now)).toEqual({ error: 'bad hours' });
  });
  it('checks media, category and cursor', () => {
    expect(parseArticleQuery({ media: 'cna, ltn,cna' }, now)).toMatchObject({ media: ['cna', 'ltn'] });
    expect(parseArticleQuery({ media: 'cna,nope' }, now)).toEqual({ error: 'unknown media: nope' });
    expect(parseArticleQuery({ category: 'nope' }, now)).toEqual({ error: 'unknown category' });
    expect(parseArticleQuery({ cursor: 'x' }, now)).toEqual({ error: 'bad cursor' });
    const at = new Date('2026-09-30T12:00:00Z');
    expect(parseArticleQuery({ cursor: encodeCursor(at, 42) }, now)).toMatchObject({ cursor: { at, id: 42 } });
    expect(parseArticleQuery({ limit: '9999', q: '  颱風 ' }, now)).toMatchObject({ limit: 200, q: '颱風' });
  });
  it('checks camp and facets', () => {
    expect(parseArticleQuery({}, now)).toMatchObject({ camp: null, facets: false });
    expect(parseArticleQuery({ camp: 'other', facets: '1' }, now)).toMatchObject({ camp: 'other', facets: true });
    expect(parseArticleQuery({ camp: 'red' }, now)).toEqual({ error: 'unknown camp' });
  });
});

describe('public API gateway behaviour', () => {
  const ui = createServer((req, res) => res.end(`next:${req.url}`));
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    ui.listen(0, '127.0.0.1');
    await once(ui, 'listening');
    // Route registration never touches the database; handlers are not called here.
    app = await buildApp({ uiOrigin: `http://127.0.0.1:${(ui.address() as { port: number }).port}` }, { db: {} as never });
  });
  afterAll(async () => {
    await app.close();
    ui.close();
  });

  it('serves the index and the OpenAPI document', async () => {
    for (const url of ['/api/v1', '/api/v1/']) {
      const r = await app.inject(url);
      expect(r.statusCode).toBe(200);
      expect(r.json().endpoints).toHaveLength(ENDPOINTS.length);
    }
    const spec = await app.inject('/api/v1/openapi.json');
    expect(spec.headers['content-type']).toMatch(/^application\/json/);
    expect(spec.json().openapi).toBe('3.1.0');
  });
  it('serves a public endpoint directory without runtime or storage state', async () => {
    const r = await app.inject('/api/status');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ status: 'degraded', scope: 'api_availability' });
    const body = r.json();
    expect(body.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/api/v1/nearline/archives' }),
        expect.objectContaining({ path: '/api/v1/nearline/status' }),
        expect.objectContaining({ path: '/api/v1/nearline/retrievals' }),
      ]),
    );
    expect(JSON.stringify(body)).not.toMatch(/127\.0\.0\.1|nas:|disk|database|indexRevision|uptime/i);
  });
  it('renders status through the site UI for browsers and Next navigation, preserving JSON access', async () => {
    for (const url of ['/api/status', '/api/status/']) {
      for (const headers of [{ accept: 'text/html' }, { rsc: '1' }]) {
        const response = await app.inject({ url, headers });
        expect(response.body).toBe(`next:${url}`);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers.vary).toContain('Accept');
      }
      const json = await app.inject({ url, headers: { accept: 'application/json' } });
      expect(json.json().scope).toBe('api_availability');
    }
  });
  it('allows cross-origin reads, including preflight and errors', async () => {
    const r = await app.inject('/api/v1/openapi.json');
    expect(r.headers['access-control-allow-origin']).toBe('*');
    const pre = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/ranking',
      headers: { origin: 'https://example.org', 'access-control-request-method': 'GET' },
    });
    expect(pre.statusCode).toBe(204);
    expect(pre.headers['access-control-allow-origin']).toBe('*');
    expect(pre.headers['access-control-allow-methods']).toContain('GET');
    expect((await app.inject('/api/tag.php')).headers['access-control-allow-origin']).toBe('*');
    expect((await app.inject('/')).headers['access-control-allow-origin']).toBeUndefined();
  });
  it('answers unknown API paths with JSON 404, but leaves /api/ to the docs page', async () => {
    const r = await app.inject('/api/v1/nope');
    expect(r.statusCode).toBe(404);
    expect(r.json()).toMatchObject({ error: 'no such endpoint', docs: '/api/' });
    expect((await app.inject('/api/v1/ranking/')).json().error).toBe('no such endpoint; try /api/v1/ranking');
    expect((await app.inject({ method: 'POST', url: '/api/v1/ranking' })).statusCode).toBe(405);
    expect((await app.inject('/api/')).body).toBe('next:/api/');
  });
  it('points legacy PHP API callers at the docs', async () => {
    expect((await app.inject('/api/tag.php')).json()).toMatchObject({
      replacement: '/api/v1/ranking',
      docs: 'https://tag.observe.tw/api/',
    });
  });
});
