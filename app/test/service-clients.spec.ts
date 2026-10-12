import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { metricsText } from '../src/metrics.ts';
import { serviceClients } from '../src/service-clients.ts';

const YOUTUBE = 'test-youtube-token-0123456789abcdef0123456789abcdef';
const BLOG = 'test-blog-token-0123456789abcdef0123456789abcdef';
const TOOLS = 'test-tools-token-0123456789abcdef0123456789abcdef';
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const env = {
  TAG_SERVICE_TOKENS: `youtube:${hash(YOUTUBE)}, blog:${hash(BLOG)}, tools:${hash(TOOLS)}, broken:xyz, Upper:${hash('x')}`,
  TAG_TRUSTED_CLIENT_IPS: 'blog=217.142.232.200, blog=2001:DB8::1, =198.51.100.1',
};
// The legacy PHP API answers 410 without a database, so it is a cheap /api/ path.
const URL = '/api/x.php';

describe('service allowlist for the rate limit', () => {
  let seen: IncomingHttpHeaders = {};
  const ui = createServer((req, res) => {
    seen = req.headers;
    res.end('ok');
  });
  let now = 0;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const get = (headers: Record<string, string> = {}) => app.inject({ url: URL, headers }).then((r) => r.statusCode);
  const times = async (n: number, headers: Record<string, string>) => {
    const codes: number[] = [];
    for (let i = 0; i < n; i++) codes.push(await get(headers));
    return codes;
  };
  beforeAll(async () => {
    ui.listen(0, '127.0.0.1');
    await once(ui, 'listening');
    app = await buildApp(
      { uiOrigin: `http://127.0.0.1:${(ui.address() as { port: number }).port}` },
      { services: serviceClients(env, { now: () => now, perServiceMax: 100, totalMax: 120 }) },
    );
  });
  afterAll(async () => {
    await app.close();
    ui.close();
  });

  it('parses only well-formed entries', () => {
    expect(serviceClients(env).names.sort()).toEqual(['blog', 'tools', 'youtube']);
    expect(serviceClients({}).names).toEqual([]);
  });

  it('keeps ordinary callers at 60 a minute, with a missing or unknown token alike', async () => {
    expect(new Set(await times(60, { 'cf-connecting-ip': '198.51.100.1' }))).toEqual(new Set([410]));
    expect(await get({ 'cf-connecting-ip': '198.51.100.1' })).toBe(429);
    expect(await get({ 'cf-connecting-ip': '198.51.100.1', 'x-service-token': 'not-a-token' })).toBe(429);
    const wrong = { 'cf-connecting-ip': '198.51.100.2', 'x-service-token': `${YOUTUBE}x` };
    expect(new Set(await times(60, wrong))).toEqual(new Set([410]));
    expect(await get(wrong)).toBe(429);
  });

  it('lets a matching token past the public limit, from a limited IP too', async () => {
    const codes = await times(70, { 'cf-connecting-ip': '198.51.100.1', 'x-service-token': YOUTUBE });
    expect(new Set(codes)).toEqual(new Set([410]));
  });

  it('lets the trusted IP past the public limit, but not its neighbours', async () => {
    now += 60_000;
    expect(new Set(await times(65, { 'cf-connecting-ip': '217.142.232.200' }))).toEqual(new Set([410]));
    expect(await get({ 'cf-connecting-ip': '2001:db8::1' })).toBe(410);
    expect(new Set(await times(60, { 'cf-connecting-ip': '217.142.232.201' }))).toEqual(new Set([410]));
    expect(await get({ 'cf-connecting-ip': '217.142.232.201' })).toBe(429);
  });

  it('limits each service on its own, without starving the others', async () => {
    now += 60_000;
    // youtube used 70 of its 100 above; a runaway loop is stopped at 100.
    const runaway = await times(40, { 'x-service-token': YOUTUBE });
    expect(runaway.filter((c) => c === 410)).toHaveLength(30);
    const limited = await app.inject({ url: URL, headers: { 'x-service-token': YOUTUBE } });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).not.toMatchObject({ scope: 'services' });
    // Only the 30 within youtube's budget count against the shared cap.
    expect(new Set(await times(30, { 'x-service-token': BLOG }))).toEqual(new Set([410]));
  });

  it('caps all services together per minute, local token calls included, and resets next minute', async () => {
    // 60 of this minute's shared 120 are used above.
    expect(new Set(await times(60, { 'x-service-token': TOOLS }))).toEqual(new Set([410]));
    const capped = await app.inject({ url: URL, headers: { 'x-service-token': TOOLS } });
    expect(capped.statusCode).toBe(429);
    expect(capped.json()).toMatchObject({ scope: 'services' });
    expect(capped.headers['retry-after']).toBe('60');
    // Ordinary callers, and local callers without a token, are unaffected.
    expect(await get({ 'cf-connecting-ip': '198.51.100.3' })).toBe(410);
    expect(new Set(await times(150, {}))).toEqual(new Set([410]));
    now += 60_000;
    expect(await get({ 'x-service-token': TOOLS })).toBe(410);
  });

  it('records requests per service in metrics', async () => {
    const text = await metricsText();
    expect(text).toMatch(/tag_service_requests_total\{service="youtube",via="token",outcome="ok"\} \d+/);
    expect(text).toMatch(/tag_service_requests_total\{service="blog",via="ip",outcome="ok"\} \d+/);
    expect(text).toMatch(/tag_service_requests_total\{service="youtube",via="token",outcome="limited"\} \d+/);
    expect(text).toMatch(/tag_service_requests_total\{service="tools",via="token",outcome="limited"\} \d+/);
    expect(text).toMatch(/tag_service_requests_total\{service="unknown",via="token",outcome="bad-token"\} \d+/);
  });

  it('never forwards the token to the UI', async () => {
    expect((await app.inject({ url: '/tag/x/', headers: { 'x-service-token': TOOLS } })).statusCode).toBe(200);
    expect(seen['x-service-token']).toBeUndefined();
  });
});
