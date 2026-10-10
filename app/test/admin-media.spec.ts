// /auth/admin/* (app/src/admin/routes.ts) against a real MariaDB (TEST_DB_URL).
// Never point TEST_DB_URL at the production database: tables are truncated.
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { JobQueue } from '../src/admin/routes.ts';
import { buildApp } from '../src/app.js';
import { hashToken, type LoginStore } from '../src/auth/google-login.ts';
import { runArticles, runIndex } from '../src/crawl/pipeline.ts';
import { sourceByMedia } from '../src/crawl/registry.ts';
import { createDb, type Db } from '../src/db/client.ts';
import {
  articles,
  articleTagEdits,
  articleTagLog,
  articleTags,
  mediaCategories,
  mediaCategoryDefs,
  mediaCategoryLog,
} from '../src/db/schema.ts';
import { campOf } from '../src/v1/coverage.ts';

vi.mock('../src/crawl/fetch.ts', async (original) => ({
  ...(await original<typeof import('../src/crawl/fetch.ts')>()),
  fetchText: vi.fn(async (url: string) => ({
    status: 200,
    url,
    headers: {},
    body: `<html><head><title>測試新聞</title><meta name="keywords" content="颱風#停班停課"></head>
      <body><article><p>${'內文。'.repeat(80)}</p></article></body></html>`,
  })),
}));

const url = process.env.TEST_DB_URL;
const ORIGIN = 'https://tag.observe.tw';
const TABLES = [
  'media_categories',
  'media_category_defs',
  'media_category_log',
  'articles',
  'article_tags',
  'crawl_runs',
  'article_tag_edits',
  'article_tag_log',
];

// Sessions keyed by cookie value: an admin and a reader.
const people: Record<string, { email: string }> = { admin: { email: 'admin@example.com' }, reader: { email: 'reader@example.com' } };
const store: LoginStore = {
  upsertUser: async () => 1,
  createSession: async () => {},
  deleteSession: async () => {},
  listUsers: async () => [],
  sessionUser: async (hash) => {
    const name = Object.keys(people).find((key) => hashToken(key) === hash);
    return name ? { id: 1, sub: name, email: people[name].email, name, picture: null } : null;
  },
};

describe.skipIf(!url)('admin media labels (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const added: Array<{ name: string; data: unknown; jobId: string }> = [];
  const queue: JobQueue = {
    add: async (name, data, opts) => {
      added.push({ name, data, jobId: opts.jobId });
      return { id: opts.jobId };
    },
    getJob: async (id) =>
      added.some((job) => job.jobId === id)
        ? {
            id,
            name: 'crawl-media',
            data: {},
            returnvalue: { inserted: 3 },
            timestamp: 0,
            finishedOn: 1000,
            getState: async () => 'completed',
          }
        : null,
    getJobs: async () => [],
  };
  const as = (who: string | null, write = true) => ({
    ...(who ? { cookie: `tag_session=${who}` } : {}),
    ...(write ? { origin: ORIGIN } : {}),
  });

  beforeAll(async () => {
    if (/\/tag_observe$/.test(url ?? '')) throw Error('TEST_DB_URL points at the production database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    for (const t of TABLES) await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
    app = await buildApp(
      {
        tagDbUrl: null,
        uiOrigin: 'http://127.0.0.1:1',
        rateLimit: false,
        login: { clientId: 'id', clientSecret: 'secret', origin: ORIGIN, admins: new Set(['admin@example.com']) },
      },
      { db, loginStore: store, jobQueue: () => queue },
    );
  });
  afterAll(async () => {
    await app?.close();
    await close?.();
  });

  it('seeds the labels from media-catalog.json on first start', async () => {
    const defs = await db.select().from(mediaCategoryDefs);
    expect(defs.find((d) => d.key === 'blue')?.label).toBe('藍營傾向媒體');
    expect(await db.select().from(mediaCategories).where(eq(mediaCategories.media, 'udn'))).toContainEqual({
      media: 'udn',
      category: 'blue',
    });
    expect(campOf('udn')).toBe('blue');
  });

  it('lets only signed-in admins in, and only from the site itself', async () => {
    expect((await app.inject({ url: '/auth/admin/media/cna', headers: as(null, false) })).statusCode).toBe(401);
    expect((await app.inject({ url: '/auth/admin/media/cna', headers: as('reader', false) })).statusCode).toBe(403);
    const ok = await app.inject({ url: '/auth/admin/media/cna', headers: as('admin', false) });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['cache-control']).toBe('no-store');
    expect(ok.json()).toMatchObject({ media: 'cna', categories: expect.arrayContaining(['green', 'news']) });
    const foreign = await app.inject({
      method: 'PUT',
      url: '/auth/admin/media/cna/categories',
      headers: { cookie: 'tag_session=admin', origin: 'https://evil.example' },
      payload: { categories: [] },
    });
    expect(foreign.statusCode).toBe(403);
  });

  it('finds the outlet of a news page, subdomains included', async () => {
    const lookup = (page: string) => app.inject({ url: `/auth/admin/lookup?url=${encodeURIComponent(page)}`, headers: as('admin', false) });
    expect((await lookup('https://www.cna.com.tw/news/aipl/202610100001.aspx')).json().candidates[0].media).toBe('cna');
    expect((await lookup('https://house.ettoday.net/news/123')).json().candidates[0].media).toBe('ettoday');
    expect((await lookup('ftp://x')).statusCode).toBe(400);
  });

  it('edits an outlet’s labels, logs who did it and updates the public API at once', async () => {
    const created = await app.inject({ method: 'POST', url: '/auth/admin/categories', headers: as('admin'), payload: { label: '泛紅' } });
    expect(created.statusCode).toBe(201);
    const key = created.json().key;
    expect(key).toMatch(/^tag\d+$/);
    const ascii = await app.inject({
      method: 'POST',
      url: '/auth/admin/categories',
      headers: as('admin'),
      payload: { label: 'Pro China 2' },
    });
    expect(ascii.json().key).toBe('pro-china-2');
    const digits = await app.inject({ method: 'POST', url: '/auth/admin/categories', headers: as('admin'), payload: { label: '泛紅2' } });
    expect(digits.json().key).toMatch(/^tag\d+$/);
    const put = await app.inject({
      method: 'PUT',
      url: '/auth/admin/media/cna/categories',
      headers: as('admin'),
      payload: { categories: ['news', 'blue', 'green', key] },
    });
    expect(put.json()).toMatchObject({ added: ['blue', key], removed: [] });
    // Both camps: blue wins, as before.
    expect(campOf('cna')).toBe('blue');
    const categories = (await app.inject('/api/v1/categories')).json();
    expect(categories.find((c: { key: string }) => c.key === key)).toMatchObject({ label: '泛紅', members: ['cna'], ranked: false });
    const log = await db.select().from(mediaCategoryLog).where(eq(mediaCategoryLog.media, 'cna'));
    expect(log.map((l) => [l.category, l.action, l.email])).toEqual(
      expect.arrayContaining([
        ['blue', 'add', 'admin@example.com'],
        [key, 'add', 'admin@example.com'],
      ]),
    );
    const undo = await app.inject({
      method: 'PUT',
      url: '/auth/admin/media/cna/categories',
      headers: as('admin'),
      payload: { categories: ['news', 'green'] },
    });
    expect(undo.json()).toMatchObject({ removed: expect.arrayContaining(['blue', key]) });
    expect(campOf('cna')).toBe('green');
    const bad = await app.inject({
      method: 'PUT',
      url: '/auth/admin/media/cna/categories',
      headers: as('admin'),
      payload: { categories: ['nope'] },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('re-fetches one article now and replaces its tags', async () => {
    const page = 'https://www.cna.com.tw/news/aipl/202610100002.aspx';
    const first = await app.inject({ method: 'POST', url: '/auth/admin/media/cna/refetch', headers: as('admin'), payload: { url: page } });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ added: true, article: { title: '測試新聞', tags: ['颱風', '停班停課'], fetchStatus: 'ok' } });
    const id = first.json().article.id;
    await db
      .update(articles)
      .set({ tags: ['舊標籤'] })
      .where(eq(articles.id, id));
    await db.insert(articleTags).values({ articleId: id, tag: '舊標籤', publishedAt: new Date() });
    const again = await app.inject({ method: 'POST', url: '/auth/admin/media/cna/refetch', headers: as('admin'), payload: { url: page } });
    expect(again.json()).toMatchObject({ added: false, article: { tags: ['颱風', '停班停課'] } });
    const stored = await db.select({ tag: articleTags.tag }).from(articleTags).where(eq(articleTags.articleId, id));
    expect(stored.map((r) => r.tag).sort()).toEqual(['停班停課', '颱風']);
  });

  it('queues a crawl of one outlet for the worker and reports its state', async () => {
    const crawl = await app.inject({
      method: 'POST',
      url: '/auth/admin/media/cna/crawl',
      headers: as('admin'),
      payload: { stage: 'index' },
    });
    expect(crawl.statusCode).toBe(202);
    expect(added.at(-1)).toMatchObject({ name: 'crawl-media', data: { media: 'cna', stage: 'index' } });
    const job = await app.inject({ url: `/auth/admin/jobs/${crawl.json().jobId}`, headers: as('admin', false) });
    expect(job.json()).toMatchObject({ state: 'completed', result: { inserted: 3 } });
    expect(
      (await app.inject({ method: 'POST', url: '/auth/admin/media/cna/crawl', headers: as('admin'), payload: { stage: 'all' } }))
        .statusCode,
    ).toBe(400);
  });

  it('edits one article’s tags by hand and keeps the edit through crawls until a re-fetch', async () => {
    const page = 'https://www.cna.com.tw/news/aipl/202610100003.aspx';
    const first = await app.inject({ method: 'POST', url: '/auth/admin/media/cna/refetch', headers: as('admin'), payload: { url: page } });
    const id = first.json().article.id;
    const tagsOf = async () =>
      (await db.select({ tag: articleTags.tag }).from(articleTags).where(eq(articleTags.articleId, id))).map((r) => r.tag).sort();
    const edit = (tags: unknown, who = 'admin') =>
      app.inject({ method: 'PUT', url: `/auth/admin/articles/${id}/tags`, headers: as(who), payload: { tags } });
    expect((await edit(['x'], 'reader')).statusCode).toBe(403);
    expect((await edit('颱風')).statusCode).toBe(400);
    expect((await edit(['a'.repeat(61)])).statusCode).toBe(400);
    const saved = await edit(['颱風', ' 停班  停課 ', '台北市', '台北市']);
    expect(saved.json()).toMatchObject({
      added: ['停班 停課', '台北市'],
      removed: ['停班停課'],
      article: { tags: ['颱風', '停班 停課', '台北市'], editedBy: 'admin@example.com' },
    });
    expect(await tagsOf()).toEqual(['停班 停課', '台北市', '颱風'].sort());
    expect((await db.select().from(articleTagLog).where(eq(articleTagLog.articleId, id))).length).toBe(3);

    // The feed lists it again with its own tags; a body retry fetches it again.
    const spec = sourceByMedia('cna');
    if (!spec) throw Error('no cna');
    await runIndex(db, spec, {
      listed: { items: [{ url: page, title: '測試新聞', publishedAt: null, tags: ['停班停課', '颱風'] }], errors: [] },
    });
    await db.update(articles).set({ contentFetchedAt: null }).where(eq(articles.id, id));
    await runArticles(db, spec, { limit: 5 });
    const [kept] = await db.select({ tags: articles.tags }).from(articles).where(eq(articles.id, id));
    expect(kept.tags).toEqual(['颱風', '停班 停課', '台北市']);
    expect(await tagsOf()).toEqual(['停班 停課', '台北市', '颱風'].sort());

    // An admin re-fetch hands the tags back to the page.
    const again = await app.inject({ method: 'POST', url: '/auth/admin/media/cna/refetch', headers: as('admin'), payload: { url: page } });
    expect(again.json().article).toMatchObject({ tags: ['颱風', '停班停課'], editedAt: null });
    expect(await db.select().from(articleTagEdits).where(eq(articleTagEdits.articleId, id))).toEqual([]);

    // This site's own article page names the article directly.
    const own = await app.inject({
      url: `/auth/admin/lookup?url=${encodeURIComponent(`${ORIGIN}/article/${id}/`)}`,
      headers: as('admin', false),
    });
    expect(own.json()).toMatchObject({ candidates: [{ media: 'cna' }], article: { id, url: page } });
  });
});
