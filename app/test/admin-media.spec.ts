// /auth/admin/* (app/src/admin/routes.ts) against a real MariaDB (TEST_DB_URL).
// Never point TEST_DB_URL at the production database: tables are truncated.
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type JobQueue, REFETCH_MS } from '../src/admin/routes.ts';
import { buildApp } from '../src/app.js';
import { hashToken, type LoginStore } from '../src/auth/google-login.ts';
import { fetchText } from '../src/crawl/fetch.ts';
import { runArticles, runIndex } from '../src/crawl/pipeline.ts';
import { sourceByMedia } from '../src/crawl/registry.ts';
import { createDb, type Db } from '../src/db/client.ts';
import {
  articleAuthorLog,
  articles,
  articleTagEdits,
  articleTagLog,
  articleTags,
  mediaCategories,
  mediaCategoryDefs,
  mediaCategoryLog,
  users,
} from '../src/db/schema.ts';
import { mediaScope } from '../src/media-scope.ts';
import { campOf } from '../src/v1/coverage.ts';

vi.mock('../src/crawl/fetch.ts', async (original) => ({
  ...(await original<typeof import('../src/crawl/fetch.ts')>()),
  fetchText: vi.fn(async (url: string) => {
    if (url.includes('slow')) throw Error('The operation was aborted due to timeout');
    return {
      status: 200,
      url,
      headers: {},
      body: `<html><head><title>測試新聞</title><meta name="keywords" content="颱風#停班停課"></head>
      <body><article>${url.includes('byline') ? '<p>政治中心／巫旻璇報導</p>' : ''}<p>${'內文。'.repeat(80)}</p></article></body></html>`,
    };
  }),
}));

const url = process.env.TEST_DB_URL;
const ORIGIN = 'https://tag.observe.tw';
const TABLES = [
  'media_categories',
  'media_category_defs',
  'media_category_log',
  'media_roles',
  'articles',
  'article_tags',
  'crawl_runs',
  'article_tag_edits',
  'article_tag_log',
  'article_author_edits',
  'article_author_log',
];

// Sessions keyed by cookie value: an admin and a reader.
const people: Record<string, { email: string }> = { admin: { email: 'admin@example.com' }, reader: { email: 'reader@example.com' } };
const store: LoginStore = {
  upsertUser: async () => 1,
  createSession: async () => {},
  deleteSession: async () => {},
  listUsers: async () => [],
  setAdmin: async () => false,
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
    // Only the camp is edited here; tags come from site.observe.tw (unset in tests).
    expect(ok.json()).toMatchObject({ media: 'cna', categories: ['green'], tags: [], tagDomains: expect.arrayContaining(['cna.com.tw']) });
    expect(ok.json().definitions.map((d: { key: string }) => d.key)).toEqual(['blue', 'green']);
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

  it('edits an outlet’s camp, logs who did it and leaves the other groups alone', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/auth/admin/media/cna/categories',
      headers: as('admin'),
      payload: { categories: ['blue', 'green'] },
    });
    expect(put.json()).toMatchObject({ categories: ['blue', 'green'], added: ['blue'], removed: [] });
    // Both camps: blue wins, as before.
    expect(campOf('cna')).toBe('blue');
    const log = await db.select().from(mediaCategoryLog).where(eq(mediaCategoryLog.media, 'cna'));
    expect(log.map((l) => [l.category, l.action, l.email])).toContainEqual(['blue', 'add', 'admin@example.com']);
    const undo = await app.inject({
      method: 'PUT',
      url: '/auth/admin/media/cna/categories',
      headers: as('admin'),
      payload: { categories: ['green'] },
    });
    expect(undo.json()).toMatchObject({ removed: ['blue'] });
    expect(campOf('cna')).toBe('green');
    // The analysis groups (news…) stay: rankings and events still read them.
    const groups = await db.select().from(mediaCategories).where(eq(mediaCategories.media, 'cna'));
    expect(groups.map((g) => g.category)).toEqual(expect.arrayContaining(['news', 'green']));
    for (const categories of [['nope'], ['news', 'green']]) {
      const bad = await app.inject({
        method: 'PUT',
        url: '/auth/admin/media/cna/categories',
        headers: as('admin'),
        payload: { categories },
      });
      expect(bad.statusCode).toBe(400);
    }
    // New tags are made on site.observe.tw.
    const created = await app.inject({ method: 'POST', url: '/auth/admin/categories', headers: as('admin'), payload: { label: '泛紅' } });
    expect(created.statusCode).toBe(410);
    expect(created.json().manage).toBe('https://site.observe.tw/sites/');
  });

  it('keeps the former labels (性質 included) in the DB, shown only in the change log', async () => {
    expect(await db.select().from(mediaCategories).where(eq(mediaCategories.media, 'news_yahoo'))).toContainEqual({
      media: 'news_yahoo',
      category: 'platform',
    });
    await db
      .insert(mediaCategoryLog)
      .values({ media: 'life', category: 'role:partner', action: 'add', email: 'admin@example.com', at: new Date() });
    const detail = (await app.inject({ url: '/auth/admin/media/life', headers: as('admin', false) })).json();
    expect(detail.definitions).not.toContainEqual(expect.objectContaining({ key: 'partner' }));
    expect(detail.logLabels).toMatchObject({ partner: '新聞合作', news: '新聞媒體' });
    expect(detail).not.toHaveProperty('roles');
    const put = await app.inject({
      method: 'PUT',
      url: '/auth/admin/media/news_yahoo/categories',
      headers: as('admin'),
      payload: { categories: ['blue'] },
    });
    expect(put.json()).toMatchObject({ categories: ['blue'], added: ['blue'], removed: [] });
    expect(await db.select().from(mediaCategories).where(eq(mediaCategories.media, 'news_yahoo'))).toContainEqual({
      media: 'news_yahoo',
      category: 'platform',
    });
    expect(mediaScope('life')).not.toHaveProperty('roles');
    const list = (await app.inject({ url: '/auth/admin/media', headers: as('admin', false) })).json();
    expect(list.categories.map((d: { key: string }) => d.key)).toEqual(['blue', 'green']);
    expect(list.trafficSite).toBe('https://site.observe.tw');
    expect(list.media.find((o: { media: string }) => o.media === 'news_yahoo').categories).toEqual(['blue']);
    expect(list.media.find((o: { media: string }) => o.media === 'life').edits).toMatchObject({ count: 1, lastBy: 'admin@example.com' });
    expect(list.media.find((o: { media: string }) => o.media === 'ftv').edits).toBeNull();
    expect(list).not.toHaveProperty('roles');
    const gone = await app.inject({ method: 'PUT', url: '/auth/admin/media/life/roles', headers: as('admin'), payload: { roles: [] } });
    expect(gone.statusCode).not.toBe(200);
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

  it('shows admins the whole stored body, past the public window too', async () => {
    const page = 'https://www.cna.com.tw/news/aipl/202610100004.aspx';
    const first = await app.inject({ method: 'POST', url: '/auth/admin/media/cna/refetch', headers: as('admin'), payload: { url: page } });
    const id = first.json().article.id;
    const body = (who: string | null) => app.inject({ url: `/auth/admin/articles/${id}/body`, headers: as(who, false) });
    expect((await body(null)).statusCode).toBe(401);
    expect((await body('reader')).statusCode).toBe(403);
    expect((await app.inject({ url: '/auth/admin/articles/0/body', headers: as('admin', false) })).statusCode).toBe(404);

    await db
      .update(articles)
      .set({ publishedAt: new Date(Date.now() - 30 * 86400e3) })
      .where(eq(articles.id, id));
    expect((await app.inject(`/api/v1/articles/${id}/content`)).json().content).toMatchObject({ status: 'expired', body: null });
    const full = await body('admin');
    expect(full.headers['cache-control']).toBe('no-store');
    expect(full.json()).toMatchObject({ id, body: '內文。'.repeat(80), chars: 240, status: 'ok', archived: false });

    await db
      .update(articles)
      .set({ body: null, contentArchiveHash: 'a'.repeat(64) })
      .where(eq(articles.id, id));
    expect((await body('admin')).json()).toMatchObject({ body: null, chars: 0, archived: true });
  });

  it('sets one article’s byline by hand and keeps it through crawls until a re-fetch', async () => {
    const page = 'https://www.cna.com.tw/news/aipl/202610110001-byline.aspx';
    const first = await app.inject({ method: 'POST', url: '/auth/admin/media/cna/refetch', headers: as('admin'), payload: { url: page } });
    const id = first.json().article.id;
    expect(first.json().article).toMatchObject({ authors: ['巫旻璇'], bylineEditedAt: null });
    const edit = (authors: unknown, who = 'admin') =>
      app.inject({ method: 'PUT', url: `/auth/admin/articles/${id}/authors`, headers: as(who), payload: { authors } });
    expect((await edit(['x'], 'reader')).statusCode).toBe(403);
    expect((await edit('王小明')).statusCode).toBe(400);
    const saved = await edit([' 王小明 ', '巫旻璇', '王小明']);
    expect(saved.json().article).toMatchObject({ authors: ['王小明', '巫旻璇'], bylineEditedBy: 'admin@example.com' });
    const [row] = await db.select({ creator: articles.creator }).from(articles).where(eq(articles.id, id));
    expect(row.creator).toBe('王小明、巫旻璇');
    expect(await db.select({ before: articleAuthorLog.before, after: articleAuthorLog.after }).from(articleAuthorLog)).toEqual([
      { before: ['巫旻璇'], after: ['王小明', '巫旻璇'] },
    ]);

    // A body retry reads 巫旻璇 from the page again, but keeps the hand edit.
    const spec = sourceByMedia('cna');
    if (!spec) throw Error('no cna');
    await db.update(articles).set({ contentFetchedAt: null }).where(eq(articles.id, id));
    await runArticles(db, spec, { limit: 5 });
    const [kept] = await db.select({ authors: articles.authors }).from(articles).where(eq(articles.id, id));
    expect(kept.authors).toEqual(['王小明', '巫旻璇']);

    // Empty means 未署名.
    expect((await edit([])).json().article.authors).toEqual([]);

    // An admin re-fetch hands the byline back to the page.
    const again = await app.inject({ method: 'POST', url: '/auth/admin/media/cna/refetch', headers: as('admin'), payload: { url: page } });
    expect(again.json().article).toMatchObject({ authors: ['巫旻璇'], bylineEditedAt: null });
  });

  it('gives up a slow re-fetch after one short try and says why', async () => {
    const page = 'https://www.cna.com.tw/news/aipl/202610110002-slow.aspx';
    vi.mocked(fetchText).mockClear();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/admin/media/cna/refetch',
      headers: as('admin'),
      payload: { url: page },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().result).toMatchObject({ failed: 1, errors: [expect.stringContaining('timeout')] });
    expect(vi.mocked(fetchText)).toHaveBeenCalledWith(page, expect.objectContaining({ timeout: REFETCH_MS, retries: 0 }));
  });

  it('counts each account’s activity, admin edits matched by email', async () => {
    const at = new Date();
    await db
      .insert(users)
      .values({ googleSub: 'activity-spec-admin', email: 'Admin@Example.com', name: 'admin', createdAt: at, lastLoginAt: at })
      .onDuplicateKeyUpdate({ set: { email: 'Admin@Example.com' } });
    const [{ id }] = await db.select({ id: users.id }).from(users).where(eq(users.googleSub, 'activity-spec-admin'));
    expect((await app.inject({ url: '/auth/admin/user-activity', headers: as('reader', false) })).statusCode).toBe(403);
    const body = (await app.inject({ url: '/auth/admin/user-activity', headers: as('admin', false) })).json();
    expect(body.metrics.map((m: { key: string }) => m.key)).toEqual(expect.arrayContaining(['reads', 'votes', 'media', 'articles']));
    // The label edits above were logged as admin@example.com.
    expect(body.users[id].counts.media).toBeGreaterThan(0);
    expect(body.users[id].counts.articles).toBeGreaterThan(0);
    expect(Date.parse(body.users[id].lastActiveAt)).toBeGreaterThan(Date.now() - 3600e3);
    await db.delete(users).where(eq(users.googleSub, 'activity-spec-admin'));
  });
});
