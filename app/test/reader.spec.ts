// Reader features (app/src/reader/) against a real MariaDB (TEST_DB_URL).
// Never point TEST_DB_URL at the production database: tables are truncated.
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken, type LoginStore } from '../src/auth/google-login.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { articles, articleTags, eventSnapshots, events, eventThreads, users } from '../src/db/schema.ts';
import { looksLikeKey, newApiKey } from '../src/reader/api-keys.ts';
import { readingReport } from '../src/reader/routes.ts';
import { parseFollow, parsePrefs, parseReport, parseSave } from '../src/reader/validate.ts';

const url = process.env.TEST_DB_URL;
const ORIGIN = 'https://tag.observe.tw';
const known = (m: string) => ['udn', 'ltn'].includes(m);

describe('reader request parsing', () => {
  it('cleans follows and rejects unknown targets', () => {
    expect(parseFollow({ kind: 'tag', target: '  颱風  假 ' }, known)).toEqual({ kind: 'tag', target: '颱風 假' });
    expect(parseFollow({ kind: 'media', target: 'udn' }, known)).toEqual({ kind: 'media', target: 'udn' });
    expect(parseFollow({ kind: 'media', target: 'nope' }, known)).toBe('unknown media');
    expect(parseFollow({ kind: 'event', target: 42 }, known)).toEqual({ kind: 'event', target: '42' });
    expect(typeof parseFollow({ kind: 'event', target: '0' }, known)).toBe('string');
    expect(typeof parseFollow({ kind: 'journalist', target: 'a%' }, known)).toBe('string');
    expect(typeof parseFollow({ kind: 'tag', target: 'x'.repeat(61) }, known)).toBe('string');
    expect(typeof parseFollow({ kind: 'person', target: 'x' }, known)).toBe('string');
  });
  it('validates saves, prefs and reports', () => {
    expect(parseSave({ kind: 'article', id: '7', note: ' 看 ' })).toEqual({ kind: 'article', id: 7, note: '看' });
    expect(typeof parseSave({ kind: 'article', id: 7, note: 'x'.repeat(501) })).toBe('string');
    expect(parsePrefs({ theme: 'dark', hiddenMedia: ['udn', 'udn'] }, known)).toEqual({ theme: 'dark', hiddenMedia: ['udn'] });
    expect(typeof parsePrefs({ hiddenMedia: ['nope'] }, known)).toBe('string');
    expect(typeof parsePrefs({ colour: 'red' }, known)).toBe('string');
    expect(parseReport({ articleId: 1, kind: 'tags', tags: [' a ', 'a', 'b'], message: '' })).toEqual({
      articleId: 1,
      kind: 'tags',
      tags: ['a', 'b'],
      message: '',
    });
    expect(typeof parseReport({ articleId: 1, kind: 'byline', message: ' ' })).toBe('string');
    expect(typeof parseReport({ articleId: 1, kind: 'tags', tags: [] })).toBe('string');
  });
  it('makes keys of a fixed shape', () => {
    const key = newApiKey();
    expect(looksLikeKey(key)).toBe(true);
    expect(looksLikeKey(`${key}x`)).toBe(false);
  });
  it('summarises reading by outlet, tag and day', () => {
    const at = new Date('2026-10-01T20:00:00Z');
    const report = readingReport([
      { id: 1, media: 'udn', title: 'a', url: 'u', tags: ['x', 'x', 'y'], readAt: at },
      { id: 2, media: 'udn', title: 'b', url: 'u', tags: ['x'], readAt: at },
    ]);
    expect(report.total).toBe(2);
    expect(report.media[0]).toMatchObject({ media: 'udn', count: 2 });
    expect(report.tags[0]).toEqual({ tag: 'x', count: 2 });
    // Taipei day, not UTC.
    expect(report.daily).toEqual([{ day: '2026-10-02', count: 2 }]);
  });
});

describe.skipIf(!url)('reader features (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const people: Record<string, { id: number; email: string }> = {
    admin: { id: 1, email: 'admin@example.com' },
    alice: { id: 2, email: 'alice@example.com' },
    bob: { id: 3, email: 'bob@example.com' },
  };
  const store: LoginStore = {
    upsertUser: async () => 1,
    createSession: async () => {},
    deleteSession: async () => {},
    listUsers: async () => [],
    sessionUser: async (hash) => {
      const name = Object.keys(people).find((key) => hashToken(key) === hash);
      return name ? { id: people[name].id, sub: name, email: people[name].email, name, picture: null } : null;
    },
  };
  const as = (who: string | null, write = true) => ({
    ...(who ? { cookie: `tag_session=${who}` } : {}),
    ...(write ? { origin: ORIGIN } : {}),
  });
  const call = (method: 'GET' | 'PUT' | 'POST' | 'DELETE', path: string, body?: unknown, who: string | null = 'alice') =>
    app.inject({ method, url: path, headers: as(who, method !== 'GET'), ...(body === undefined ? {} : { payload: body as object }) });
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600e3);

  beforeAll(async () => {
    if (/\/tag_observe$/.test(url ?? '')) throw Error('TEST_DB_URL points at the production database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    for (const t of [
      'articles',
      'article_tags',
      'events',
      'event_threads',
      'user_follows',
      'user_saves',
      'user_prefs',
      'user_feed_tokens',
      'user_api_keys',
      'reader_history',
      'reader_reports',
      'users',
    ])
      await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
    await db.insert(users).values(
      Object.entries(people).map(([name, p]) => ({
        id: p.id,
        googleSub: name,
        email: p.email,
        name,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      })),
    );
    const article = (id: number, media: string, title: string, tags: string[], h: number, authors: string[] | null = null) => ({
      id,
      media,
      title,
      tags,
      authors,
      url: `https://example.com/${media}/${id}`,
      publishedAt: hoursAgo(h),
      crawledAt: hoursAgo(h),
    });
    await db
      .insert(articles)
      .values([
        article(1, 'udn', '颱風來了', ['颱風', '停班停課'], 2),
        article(2, 'ltn', '颱風動態', ['颱風'], 3, ['記者王小明／台北報導']),
        article(3, 'ltn', '股市收盤', ['股市'], 4),
        article(4, 'udn', '十天前的颱風', ['颱風'], 240),
      ]);
    await db.insert(articleTags).values(
      [1, 2, 3, 4].flatMap((id) => {
        const tags = id === 3 ? ['股市'] : id === 1 ? ['颱風', '停班停課'] : ['颱風'];
        return tags.map((tag) => ({ articleId: id, tag, publishedAt: hoursAgo(id === 4 ? 240 : id + 1) }));
      }),
    );
    await db.insert(eventThreads).values({
      id: 9,
      category: 'news',
      firstTime: hoursAgo(5),
      lastTime: hoursAgo(1),
      hours: 4,
      allTags: ['颱風'],
      majorTags: ['颱風'],
      maxTag: '颱風',
      history: {},
      combinedFrom: [],
      combinedTo: [],
    });
    await db.insert(events).values({
      snapshotId: 1,
      rank: 1,
      score: 1,
      tags: [['颱風', 1]],
      major: ['颱風'],
      news: [],
      majorNews: [{ id: 1, title: '颱風來了', url: 'https://example.com/udn/1', image: null, media: 'udn' }],
      threadId: 9,
    });
    app = await buildApp(
      {
        tagDbUrl: null,
        uiOrigin: 'http://127.0.0.1:1',
        rateLimit: false,
        login: { clientId: 'id', clientSecret: 'secret', origin: ORIGIN, admins: new Set(['admin@example.com']) },
      },
      { db, loginStore: store, jobQueue: () => ({ add: async () => ({}), getJob: async () => null, getJobs: async () => [] }) },
    );
  });
  afterAll(async () => {
    await app?.close();
    await close?.();
  });

  it('asks for a session and same-origin writes', async () => {
    expect((await call('GET', '/auth/me/follows', undefined, null)).statusCode).toBe(401);
    const cross = await app.inject({ method: 'PUT', url: '/auth/me/follows', headers: { cookie: 'tag_session=alice' }, payload: {} });
    expect(cross.statusCode).toBe(403);
  });

  it('follows things and builds 我的動態 from them', async () => {
    expect((await call('PUT', '/auth/me/follows', { kind: 'tag', target: '颱風', follow: true })).statusCode).toBe(200);
    expect((await call('PUT', '/auth/me/follows', { kind: 'journalist', target: '王小明', follow: true })).statusCode).toBe(200);
    expect((await call('PUT', '/auth/me/follows', { kind: 'event', target: 9, follow: true })).statusCode).toBe(200);
    expect((await call('PUT', '/auth/me/follows', { kind: 'event', target: 999, follow: true })).statusCode).toBe(404);
    // Following twice is harmless.
    const follows = (await call('PUT', '/auth/me/follows', { kind: 'tag', target: '颱風', follow: true })).json().follows;
    expect(follows).toHaveLength(3);

    const feed = (await call('GET', '/auth/me/feed')).json();
    expect(feed.articles.map((a: { id: number }) => a.id)).toEqual([1, 2]);
    expect(feed.articles[1].matched).toEqual([
      { kind: 'tag', target: '颱風' },
      { kind: 'journalist', target: '王小明' },
    ]);
    expect(feed.events).toMatchObject([{ id: 9, active: true, headlines: [{ title: '颱風來了' }] }]);
    // Bob follows nothing and sees nothing of Alice's.
    expect((await call('GET', '/auth/me/feed', undefined, 'bob')).json().articles).toEqual([]);

    expect((await call('PUT', '/auth/me/prefs', { hiddenMedia: ['ltn'] })).statusCode).toBe(200);
    expect((await call('GET', '/auth/me/feed')).json().articles.map((a: { id: number }) => a.id)).toEqual([1]);
    await call('PUT', '/auth/me/prefs', { hiddenMedia: [] });
  });

  it('serves the private RSS only under the current token', async () => {
    expect((await call('GET', '/auth/me/feed-token')).json().url).toBeNull();
    const first = (await call('POST', '/auth/me/feed-token')).json().url as string;
    const path = new URL(first).pathname;
    const rss = await app.inject({ url: path });
    expect(rss.statusCode).toBe(200);
    expect(rss.headers['cache-control']).toBe('private, max-age=600');
    expect(rss.body).toContain('【追蹤事件】颱風來了');
    expect(rss.body).toContain('颱風動態');
    const second = (await call('POST', '/auth/me/feed-token')).json().url as string;
    expect(second).not.toBe(first);
    expect((await app.inject({ url: path })).statusCode).toBe(404);
    await call('DELETE', '/auth/me/feed-token');
    expect((await app.inject({ url: new URL(second).pathname })).statusCode).toBe(404);
  });

  it('saves articles and events with notes', async () => {
    expect((await call('PUT', '/auth/me/saves', { kind: 'article', id: 1, saved: true, note: '回頭看' })).statusCode).toBe(200);
    expect((await call('PUT', '/auth/me/saves', { kind: 'event', id: 9, saved: true })).statusCode).toBe(200);
    expect((await call('PUT', '/auth/me/saves', { kind: 'article', id: 404, saved: true })).statusCode).toBe(404);
    await call('PUT', '/auth/me/saves', { kind: 'article', id: 1, saved: true, note: '改註記' });
    const saves = (await call('GET', '/auth/me/saves')).json().saves;
    expect(saves).toHaveLength(2);
    expect(saves.find((s: { kind: string }) => s.kind === 'article')).toMatchObject({ note: '改註記', article: { title: '颱風來了' } });
    expect(saves.find((s: { kind: string }) => s.kind === 'event')).toMatchObject({ event: { id: 9, tags: ['颱風'] } });
    await call('PUT', '/auth/me/saves', { kind: 'event', id: 9, saved: false });
    expect((await call('GET', '/auth/me/saves')).json().saves).toHaveLength(1);
  });

  it('records reading only after opting in, and forgets it on opt-out', async () => {
    expect((await call('POST', '/auth/me/history', { articleId: 1 })).json()).toEqual({ recorded: false });
    expect((await call('PUT', '/auth/me/prefs', { history: true, theme: 'dark' })).json().prefs).toMatchObject({
      history: true,
      theme: 'dark',
    });
    expect((await call('POST', '/auth/me/history', { articleId: 1 })).json()).toEqual({ recorded: true });
    await call('POST', '/auth/me/history', { articleId: 2 });
    const report = (await call('GET', '/auth/me/history/report')).json();
    expect(report).toMatchObject({ enabled: true, total: 2 });
    expect(report.tags[0]).toEqual({ tag: '颱風', count: 2 });
    await call('PUT', '/auth/me/prefs', { history: false });
    expect((await call('GET', '/auth/me/history/report')).json()).toMatchObject({ enabled: false, total: 0 });
    // Other preferences survive a partial update.
    expect((await call('GET', '/auth/me/prefs')).json().prefs.theme).toBe('dark');
  });

  it('issues, lists and revokes API keys', async () => {
    const created = await call('POST', '/auth/me/api-keys', { label: '研究用' });
    expect(created.statusCode).toBe(201);
    const { key, keys } = created.json();
    expect(looksLikeKey(key)).toBe(true);
    expect(keys).toEqual([expect.objectContaining({ label: '研究用', prefix: key.slice(0, 10), lastUsedAt: null })]);
    expect(JSON.stringify((await call('GET', '/auth/me/api-keys')).json())).not.toContain(key);
    await call('POST', '/auth/me/api-keys', { label: 'b' });
    await call('POST', '/auth/me/api-keys', { label: 'c' });
    expect((await call('POST', '/auth/me/api-keys', { label: 'd' })).statusCode).toBe(409);
    // Bob cannot revoke Alice's key.
    expect((await call('DELETE', `/auth/me/api-keys/${keys[0].id}`, undefined, 'bob')).statusCode).toBe(404);
    expect((await call('DELETE', `/auth/me/api-keys/${keys[0].id}`)).json().keys).toHaveLength(2);
  });

  it('takes reports from readers and lets admins resolve them', async () => {
    expect((await call('POST', '/auth/me/reports', { articleId: 3, kind: 'tags', tags: ['股市', '台股'], message: '' })).statusCode).toBe(
      201,
    );
    expect((await call('POST', '/auth/me/reports', { articleId: 3, kind: 'byline', message: '署名錯了' }, 'bob')).statusCode).toBe(201);
    expect((await call('POST', '/auth/me/reports', { articleId: 404, kind: 'other', message: 'x' })).statusCode).toBe(404);
    expect((await call('GET', '/auth/admin/reports', undefined, 'alice')).statusCode).toBe(403);
    const queue = (await call('GET', '/auth/admin/reports', undefined, 'admin')).json();
    expect(queue.open).toBe(2);
    expect(queue.reports[0]).toMatchObject({
      kind: 'tags',
      tags: ['股市', '台股'],
      currentTags: ['股市'],
      reporter: { email: 'alice@example.com' },
      article: { id: 3 },
    });
    const id = queue.reports[0].id;
    expect((await call('PUT', `/auth/admin/reports/${id}`, { status: 'accepted', resolution: '已補上' }, 'alice')).statusCode).toBe(403);
    expect((await call('PUT', `/auth/admin/reports/${id}`, { status: 'accepted', resolution: '已補上' }, 'admin')).statusCode).toBe(200);
    expect((await call('GET', '/auth/me/reports')).json().reports[0]).toMatchObject({ status: 'accepted', resolution: '已補上' });
    expect((await call('GET', '/auth/admin/reports', undefined, 'admin')).json().open).toBe(1);
  });
  it('suggests what to follow next: starter, related and reading', async () => {
    const at = (h: number) => new Date(now - h * 3600e3);
    const extra = [
      { id: 5, media: 'udn', tags: ['颱風', '停班停課'], h: 5, authors: null },
      { id: 6, media: 'udn', tags: ['颱風', '停班停課'], h: 6, authors: null },
      { id: 7, media: 'udn', tags: ['颱風', '停班停課'], h: 7, authors: null },
      { id: 8, media: 'ltn', tags: ['能源'], h: 8, authors: ['記者王小明／台北報導'] },
      { id: 9, media: 'ltn', tags: ['能源'], h: 9, authors: ['記者王小明／台北報導'] },
      { id: 10, media: 'ltn', tags: ['颱風'], h: 1, authors: null },
      { id: 11, media: 'udn', tags: ['颱風'], h: 10, authors: null },
    ];
    await db.insert(articles).values(
      extra.map((a) => ({
        id: a.id,
        media: a.media,
        title: `報導 ${a.id}`,
        tags: a.tags,
        authors: a.authors,
        url: `https://example.com/${a.media}/${a.id}`,
        publishedAt: at(a.h),
        crawledAt: at(a.h),
      })),
    );
    await db.insert(articleTags).values(extra.flatMap((a) => a.tags.map((tag) => ({ articleId: a.id, tag, publishedAt: at(a.h) }))));
    await db.execute(sql.raw('TRUNCATE TABLE `event_snapshots`'));
    await db.insert(eventSnapshots).values({ id: 1, category: 'news', hourStart: at(1), computedAt: at(1), eventCount: 1, durationMs: 1 });

    // Bob follows nothing: the starter lists today's events.
    const fresh = (await call('GET', '/auth/me/suggestions', undefined, 'bob')).json();
    expect(fresh.starter.events).toEqual([{ id: 9, title: '颱風來了', tags: ['颱風'] }]);
    expect(fresh.reading).toBeNull();

    // Alice follows 颱風, 王小明 and event 9.
    const before = (await call('GET', '/auth/me/suggestions')).json();
    expect(before.starter.events).toEqual([]);
    expect(before.related).toEqual(
      expect.arrayContaining([
        { kind: 'tag', target: '停班停課', label: '#停班停課', because: '常和 #颱風 一起出現' },
        { kind: 'tag', target: '能源', label: '#能源', because: '王小明 常寫' },
      ]),
    );
    expect(before.related.some((s: { target: string }) => s.target === '颱風')).toBe(false);

    // Reading only blue outlets brings the green side of the same topics.
    await call('PUT', '/auth/me/prefs', { history: true });
    for (const id of [1, 5, 6, 7, 11]) await call('POST', '/auth/me/history', { articleId: id });
    const reading = (await call('GET', '/auth/me/suggestions')).json().reading;
    expect(reading.tags).toEqual([{ kind: 'tag', target: '停班停課', label: '#停班停課', because: '近 30 天讀了 4 篇' }]);
    expect(reading.otherSide).toMatchObject({ camp: 'blue', share: 1 });
    expect(reading.otherSide.articles.map((a: { id: number }) => a.id)).toEqual([10, 2]);
    await call('PUT', '/auth/me/prefs', { history: false });
  });
});

describe.skipIf(!url)('API key rate limit (MariaDB)', () => {
  it('moves a keyed caller to its own budget', async () => {
    const { db, close } = createDb(url);
    const app = await buildApp(
      {
        tagDbUrl: null,
        uiOrigin: 'http://127.0.0.1:1',
        login: { clientId: 'id', clientSecret: 'secret', origin: ORIGIN, admins: new Set() },
      },
      {
        db,
        loginStore: {
          upsertUser: async () => 1,
          createSession: async () => {},
          deleteSession: async () => {},
          listUsers: async () => [],
          sessionUser: async () => ({ id: 2, sub: 'alice', email: 'alice@example.com', name: null, picture: null }),
        },
      },
    );
    try {
      const { key } = (
        await app.inject({
          method: 'POST',
          url: '/auth/me/api-keys',
          headers: { cookie: 'tag_session=alice', origin: ORIGIN, 'cf-connecting-ip': '203.0.113.9' },
          payload: { label: 'rate' },
        })
      ).json();
      const ip = { 'cf-connecting-ip': '203.0.113.9' };
      const anon = await app.inject({ url: '/api/v1/no-such', headers: ip });
      expect(anon.headers['x-ratelimit-limit']).toBe('60');
      const keyed = await app.inject({ url: '/api/v1/no-such', headers: { ...ip, 'x-api-key': key } });
      expect(keyed.headers['x-ratelimit-limit']).toBe('1000');
      const wrong = await app.inject({ url: '/api/v1/no-such', headers: { ...ip, 'x-api-key': newApiKey() } });
      expect(wrong.headers['x-ratelimit-limit']).toBe('60');
    } finally {
      await app.close();
      await close();
    }
  });
});
