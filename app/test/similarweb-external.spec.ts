// Similarweb lookups for other services (docs/similarweb-requests.md): domain
// checks and budget sharing in memory, then the queue, the run and the
// loopback/token API against a real MariaDB (TEST_DB_URL). Never point
// TEST_DB_URL at the production database: tables are truncated.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db/client.ts';
import { trafficExternalRequests } from '../src/db/schema.ts';
import { runMediaTrafficJob } from '../src/jobs/media-traffic-job.ts';
import {
  externalAllowance,
  externalBudget,
  externalUsedToday,
  publicDomain,
  runExternalRequests,
  submitExternal,
} from '../src/media-traffic/external.ts';
import { serviceTokens } from '../src/media-traffic/external-routes.ts';

describe('submitted domains', () => {
  it('normalises public domains and refuses everything else', () => {
    expect(publicDomain('https://www.Example-News.com.tw/path?x=1')).toBe('example-news.com.tw');
    expect(publicDomain('medium.com')).toBe('medium.com');
    for (const bad of [
      'localhost',
      'foo',
      '127.0.0.1',
      '10.0.0.8',
      'http://[::1]/',
      'blog.observe.tw',
      'skyhong-sm.tailf76d1d.ts.net',
      'printer.local',
      'a.internal',
      'x.test',
      'user:pw@evil.com',
      'evil.com\\@good.com',
      `${'a'.repeat(64)}.com`,
      'a b.com',
      42,
      null,
    ])
      expect(publicDomain(bad), String(bad)).toBeNull();
  });
});

describe('budget', () => {
  const budget = { run: 15, perRun: 3, perDay: 30, submitPerDay: 200 };
  it('gives external lookups only what tag leaves, capped per run and per day', () => {
    expect(externalAllowance({ attempted: 0, remaining: 0, blocked: false }, 0, budget)).toBe(3);
    expect(externalAllowance({ attempted: 13, remaining: 0, blocked: false }, 0, budget)).toBe(2);
    expect(externalAllowance({ attempted: 15, remaining: 0, blocked: false }, 0, budget)).toBe(0);
    // tag still has outlets due, or was refused: nothing for others.
    expect(externalAllowance({ attempted: 4, remaining: 1, blocked: false }, 0, budget)).toBe(0);
    expect(externalAllowance({ attempted: 4, remaining: 0, blocked: true }, 0, budget)).toBe(0);
    expect(externalAllowance({ attempted: 0, remaining: 0, blocked: false }, 29, budget)).toBe(1);
    expect(externalAllowance({ attempted: 0, remaining: 0, blocked: false }, 30, budget)).toBe(0);
  });
  it('reads its knobs from the environment, with safe defaults', () => {
    expect(externalBudget({})).toEqual({ run: 15, perRun: 3, perDay: 30, submitPerDay: 200 });
    expect(externalBudget({ TAG_SIMILARWEB_EXTERNAL_PER_RUN: '5', TAG_SIMILARWEB_RUN_BUDGET: 'x' })).toMatchObject({ perRun: 5, run: 15 });
  });
  it('takes service tokens from the environment, 32 characters or more', () => {
    const tokens = serviceTokens({ TAG_SIMILARWEB_TOKEN_BLOG: 'b'.repeat(40), TAG_SIMILARWEB_TOKEN_SHORT: 'x', OTHER: 'y'.repeat(40) });
    expect([...tokens.keys()]).toEqual(['blog']);
  });
});

const url = process.env.TEST_DB_URL;
const TOKEN = 't'.repeat(48);

describe.skipIf(!url)('similarweb requests (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const local = { remoteAddress: '127.0.0.1' };
  const api = (
    method: 'GET' | 'POST',
    path: string,
    { headers = {} as Record<string, string>, payload = undefined as object | undefined } = {},
  ) =>
    app.inject({
      method,
      url: `/internal/similarweb${path}`,
      headers: { authorization: `Bearer ${TOKEN}`, ...headers },
      payload,
      ...local,
    });
  // A Similarweb stand-in: tag's outlets and blog's domains, with a counter and an optional refusal.
  let calls: string[] = [];
  let refuse: string | null = null;
  let missing: string | null = null;
  const similarweb = (async (u: string) => {
    const domain = new URL(u).searchParams.get('domain') as string;
    calls.push(domain);
    if (domain === refuse) return new Response('{}', { status: 403 });
    if (domain === missing) return new Response('{}', { status: 404 });
    return new Response(
      JSON.stringify({
        SiteName: domain,
        EstimatedMonthlyVisits: { '2026-07-01': 100, '2026-08-01': 200, '2026-09-01': 300 },
        Engagments: { Year: '2026', Month: '9' },
        GlobalRank: { Rank: 1234 },
        Category: 'news_and_media',
        TopCountryShares: [{ CountryCode: 'TW', Value: 0.8 }],
        Competitors: { TopSimilarityCompetitors: [{ Domain: 'other-blog.com' }, 'localhost', { Domain: domain }] },
      }),
    );
  }) as unknown as typeof fetch;
  const budget = { run: 6, perRun: 3, perDay: 30, submitPerDay: 5 };
  const job = (domains: string[]) => runMediaTrafficJob(domains, db, { request: similarweb, budget, pauseMs: 0 });

  beforeAll(async () => {
    if (/\/tag_observe$/.test(url ?? '')) throw Error('TEST_DB_URL points at the production database');
    process.env.TAG_SIMILARWEB_SUBMIT_PER_DAY = '5';
    process.env.TAG_MEDIA_TRAFFIC_FILE = join(mkdtempSync(join(tmpdir(), 'tag-sw-')), 'live.json');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    app = await buildApp(
      { tagDbUrl: null, uiOrigin: 'http://127.0.0.1:1', rateLimit: false },
      { db, externalTokens: new Map([['blog', Buffer.from(TOKEN)]]) },
    );
  });
  beforeEach(async () => {
    for (const t of ['traffic_external_requests', 'traffic_external_sends']) await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
    calls = [];
    refuse = null;
    missing = null;
  });
  afterAll(async () => {
    await app?.close();
    await close?.();
  });

  it('answers only a loopback caller with the token, as 404 otherwise', async () => {
    expect((await api('GET', '/results?domain=medium.com', { headers: { authorization: 'Bearer wrong' } })).statusCode).toBe(404);
    expect((await api('GET', '/results?domain=medium.com', { headers: { authorization: '' } })).statusCode).toBe(404);
    // Through Cloudflare or any proxy: refused even with the token.
    expect((await api('GET', '/results?domain=medium.com', { headers: { 'cf-connecting-ip': '203.0.113.9' } })).statusCode).toBe(404);
    expect((await api('GET', '/results?domain=medium.com', { headers: { 'x-forwarded-for': '203.0.113.9' } })).statusCode).toBe(404);
    const remote = await app.inject({
      method: 'GET',
      url: '/internal/similarweb/results?domain=medium.com',
      headers: { authorization: `Bearer ${TOKEN}` },
      remoteAddress: '203.0.113.9',
    });
    expect(remote.statusCode).toBe(404);
    // The right caller: not requested yet.
    expect((await api('GET', '/results?domain=medium.com')).json()).toEqual({ error: 'not_requested', domain: 'medium.com' });
    // Other methods fall to the /internal/ catch-all: 404, never the UI proxy.
    expect((await api('POST', '/results?domain=medium.com')).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: '/internal/similarweb/requests', ...local })).statusCode).toBe(404);
  });

  it('queues, dedupes and caps submissions, refusing private names', async () => {
    const post = (domain: unknown, kind?: string) => api('POST', '/requests', { payload: { domain, kind } });
    const first = await post('https://www.Medium.com/x', 'similar_sites');
    expect(first.statusCode).toBe(202);
    expect(first.json()).toMatchObject({ domain: 'medium.com', kind: 'similar_sites', status: 'pending', created: true });
    expect((await post('medium.com', 'similar_sites')).statusCode).toBe(200);
    expect((await post('localhost')).json()).toEqual({ error: 'invalid_domain' });
    expect((await post('127.0.0.1')).statusCode).toBe(400);
    expect((await post('medium.com', 'everything')).json()).toEqual({ error: 'invalid_kind' });
    for (const d of ['a1.com', 'a2.com', 'a3.com', 'a4.com']) await post(d, 'traffic');
    expect((await post('a5.com', 'traffic')).statusCode).toBe(429);
    // The same domain submitted twice at once: one row, no error.
    await db.execute(sql.raw('TRUNCATE TABLE `traffic_external_requests`'));
    const both = await Promise.all([post('same.com', 'traffic'), post('same.com', 'traffic')]);
    expect(both.map((r) => r.statusCode).sort()).toEqual([200, 202]);
    expect(await db.select().from(trafficExternalRequests)).toHaveLength(1);
  });

  it("spends only what tag's own outlets leave, then serves the results", async () => {
    for (const d of ['blog-a.com', 'blog-b.com', 'blog-c.com', 'blog-d.com']) await submitExternal(db, 'blog', d, 'similar_sites');
    await submitExternal(db, 'blog', 'blog-a.com', 'traffic');
    // Five outlets of tag's own fill five of the run's six: one left for blog.
    const r = await job(['t1.com', 't2.com', 't3.com', 't4.com', 't5.com']);
    expect(calls.slice(0, 5)).toEqual(['t1.com', 't2.com', 't3.com', 't4.com', 't5.com']);
    expect(calls.slice(5)).toEqual(['blog-a.com']);
    expect(r.external).toMatchObject({ sent: 1, ok: 1, blocked: false });
    const result = (await api('GET', '/results?domain=blog-a.com')).json();
    expect(result).toMatchObject({
      domain: 'blog-a.com',
      source: 'similarweb-extension',
      similarSites: ['other-blog.com'],
      traffic: {
        monthly: [
          { month: '202607', visits: 100 },
          { month: '202608', visits: 200 },
          { month: '202609', visits: 300 },
        ],
        globalRank: 1234,
      },
    });
    expect(result.requests.map((q: { kind: string; status: string }) => `${q.kind} ${q.status}`).sort()).toEqual([
      'similar_sites ok',
      'traffic ok',
    ]);
    // tag's outlets are fresh now: the next run has the per-run three for blog.
    calls = [];
    await job(['t1.com', 't2.com', 't3.com', 't4.com', 't5.com']);
    expect(calls).toEqual(['blog-b.com', 'blog-c.com', 'blog-d.com']);
  });

  it('stops the whole run at a 403 and waits before asking again', async () => {
    for (const d of ['blog-a.com', 'blog-b.com', 'blog-c.com']) await submitExternal(db, 'blog', d, 'similar_sites');
    refuse = 'blog-a.com';
    const r = await job([]);
    expect(calls).toEqual(['blog-a.com']);
    expect(r.external).toMatchObject({ sent: 1, blocked: true });
    const rows = await db.select().from(trafficExternalRequests);
    expect(rows.find((q) => q.domain === 'blog-a.com')?.status).toBe('blocked');
    expect(rows.filter((q) => q.domain !== 'blog-a.com').every((q) => q.status === 'pending')).toBe(true);
    // Within six hours, nothing goes out for others even with budget left.
    refuse = null;
    calls = [];
    expect((await job([])).external).toEqual({ skipped: 'refused' });
    expect(calls).toEqual([]);
    // Resubmitting a refused domain does not clear its wait.
    await submitExternal(db, 'blog', 'blog-a.com', 'similar_sites');
    calls = [];
    await job([]);
    expect(calls).toEqual([]);
    // A 403 on tag's own outlets stops the run before any external lookup.
    for (const t of ['traffic_external_requests', 'traffic_external_sends']) await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
    await submitExternal(db, 'blog', 'blog-b.com', 'similar_sites');
    refuse = 't9.com';
    calls = [];
    await job(['t9.com']).catch(() => {});
    expect(calls).toEqual(['t9.com']);
  });

  it('gives up after three misses, and sends nothing for others after a failed tag run', async () => {
    await submitExternal(db, 'blog', 'gone.com', 'traffic');
    missing = 'gone.com';
    for (let day = 0; day < 3; day++) {
      await runExternalRequestsAt(new Date(Date.now() + day * 86_400_000 + 1000));
    }
    const [row] = await db.select().from(trafficExternalRequests);
    expect([row.status, row.attempts]).toEqual(['no-data', 3]);
    // Every send is counted for the day, the same domain twice included.
    expect(await externalUsedToday(db, new Date(Date.now() + 2 * 86_400_000 + 1000))).toBe(1);
    // tag's own outlets all failing: nothing goes out for blog.
    await submitExternal(db, 'blog', 'blog-x.com', 'similar_sites');
    missing = 't7.com';
    calls = [];
    await job(['t7.com']).catch(() => {});
    expect(calls).toEqual(['t7.com']);
  });

  const runExternalRequestsAt = (now: Date) => runExternalRequests(db, 3, { request: similarweb, now, pauseMs: 0 });
});
