// Writing signals end to end against a real MariaDB (TEST_DB_URL): the job
// analyses bodies, the people job resolves a bare name, the public API reads
// the result and an admin correction re-labels it. Never point TEST_DB_URL at
// the production database: tables are truncated.
import { eq, inArray, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken, type LoginStore } from '../src/auth/google-login.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { articles, articleTags, articleWriting, tagGroupDefs } from '../src/db/schema.ts';
import { runWritingJob, runWritingPeopleJob } from '../src/jobs/writing-job.ts';
import { writingOverview } from '../src/v1/writing.ts';
import { VERSION } from '../src/writing/rules.ts';

const url = process.env.TEST_DB_URL;
const ORIGIN = 'https://tag.observe.tw';
const store: LoginStore = {
  upsertUser: async () => 1,
  createSession: async () => {},
  deleteSession: async () => {},
  listUsers: async () => [],
  setAdmin: async () => false,
  sessionUser: async (hash) =>
    hash === hashToken('admin') ? { id: 1, sub: 'admin', email: 'admin@example.com', name: 'admin', picture: null } : null,
};
const filler = '其餘內文。'.repeat(60);

describe.skipIf(!url)('writing signals (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let ids: number[] = [];
  const now = new Date();

  beforeAll(async () => {
    if (/\/tag_observe$/.test(url ?? '')) throw Error('TEST_DB_URL points at the production database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    for (const t of ['article_writing', 'writing_people', 'writing_people_log']) await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
    await db.delete(articles).where(sql`url LIKE 'https://writing.test/%'`);
    const bodies = [
      ['名醫看了反應驚人', '精神科醫師沈小明10日在臉書貼文表示，致詞罵得太好。'],
      ['邱九十發文', '邱九十今天在臉書發文質疑。'],
      ['周十一發文', '周十一今天在臉書發文。'],
      ['學生發文', '有學生深夜在臉書發文。'],
      ['颱風動態', '颱風今天接近，氣象署發布海上警報。'],
      ...[1, 2, 3].map((i) => [`前立委談選情${i}`, `前立委邱九十${i}日接受專訪時說明。`]),
    ];
    await db.insert(articles).values(
      bodies.map(([title, lead], i) => ({
        media: 'chinatimes',
        publishedAt: new Date(now.getTime() - i * 60e3),
        crawledAt: now,
        url: `https://writing.test/${i}`,
        title,
        tags: [],
        body: `${lead}${filler}`,
        bodyStatus: 'ok',
        source: 'own',
      })),
    );
    ids = (await db.select({ id: articles.id }).from(articles).where(sql`url LIKE 'https://writing.test/%'`).orderBy(articles.id)).map(
      (r) => r.id,
    );
    // Only known people get a learned role: 邱九十 by the text, 周十一 by group.
    await db.execute(sql`DELETE FROM tag_group_members WHERE group_id IN (9901, 9902, 9903, 9904)`);
    await db.execute(sql`DELETE FROM tag_group_defs WHERE id IN (9901, 9902, 9903, 9904)`);
    await db.execute(sql`INSERT INTO tag_group_defs (id, label, kind, sort, created_at) VALUES (9901, '名嘴', 'group', 0, NOW())`);
    await db.execute(sql`INSERT INTO tag_group_members (tag, group_id, source, status, updated_at)
      VALUES ('邱九十', 9901, 'admin', 'confirmed', NOW()), ('周十一', 9901, 'admin', 'confirmed', NOW())`);
    await db.insert(tagGroupDefs).values([
      { id: 9902, label: '測試評論分類', kind: 'group', writingRole: '評論名嘴', createdAt: now },
      { id: 9903, label: '測試醫療分類', kind: 'group', writingRole: '醫療健康', createdAt: now },
      { id: 9904, label: '測試子分類', kind: 'group', parentId: 9903, createdAt: now },
    ]);
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
    if (ids.length) {
      await db.delete(articleTags).where(inArray(articleTags.articleId, ids));
      await db.delete(articles).where(inArray(articles.id, ids));
      await db.execute(sql`DELETE FROM tag_group_members WHERE group_id IN (9901, 9902, 9903, 9904)`);
      await db.execute(sql`DELETE FROM tag_group_defs WHERE id IN (9901, 9902, 9903, 9904)`);
    }
    await close?.();
  });

  it('analyses bodies, resolves bare names and serves the result', async () => {
    const first = await runWritingJob(db);
    // Other specs leave bodies in the shared test database; count only ours below.
    expect(first.articles).toBeGreaterThanOrEqual(8);
    expect((await runWritingJob(db)).articles).toBe(0);
    // Datetimes stay in UTC end to end (raw rows would come back as local-time strings).
    const [stored] = await db.select().from(articleWriting).where(eq(articleWriting.articleId, ids[0]));
    const [source] = await db.select({ publishedAt: articles.publishedAt }).from(articles).where(eq(articles.id, ids[0]));
    expect(stored.publishedAt.toISOString()).toBe(source.publishedAt.toISOString());

    const article = await app.inject({ url: `/api/v1/articles/${ids[0]}/writing` });
    expect(article.json()).toMatchObject({
      version: VERSION,
      social: { platform: 'Facebook', poster: '沈小明', role: '醫療健康', roleSource: 'clause' },
      titleTags: ['反應'],
    });
    const bare = await app.inject({ url: `/api/v1/articles/${ids[1]}/writing` });
    expect(bare.json().social).toMatchObject({ poster: '邱九十', role: '未知' });

    expect(await runWritingPeopleJob(db)).toMatchObject({ resolved: 2, relabelled: 2 });
    expect((await app.inject({ url: `/api/v1/articles/${ids[2]}/writing` })).json().social).toMatchObject({
      poster: '周十一',
      role: '評論名嘴',
    });
    expect((await app.inject({ url: `/api/v1/articles/${ids[3]}/writing` })).json().social.poster).toBeNull();
    expect((await app.inject({ url: `/api/v1/articles/${ids[1]}/writing` })).json().social).toMatchObject({
      role: '前任公職',
      roleSource: 'people',
    });

    const overview = (await app.inject({ url: '/api/v1/writing?days=7' })).json();
    expect(overview.totals.social).toBeGreaterThanOrEqual(2);
    expect(overview.posters.map((p: { name: string }) => p.name)).toEqual(expect.arrayContaining(['沈小明', '邱九十', '周十一']));
    const list = (await app.inject({ url: '/api/v1/writing/articles?role=醫療健康&poster=沈小明' })).json();
    expect(list.articles.map((a: { id: number }) => a.id)).toEqual([ids[0]]);
    const media = (await app.inject({ url: '/api/v1/media/chinatimes/writing?days=7' })).json();
    expect(media.totals.social).toBeGreaterThanOrEqual(2);
  });

  const headers = { cookie: 'tag_session=admin', origin: ORIGIN };
  const decide = (id: number, status: 'confirmed' | 'rejected', tag = '沈小明') =>
    app.inject({
      method: 'PUT',
      url: `/auth/admin/tag-groups/${id}/tags/${encodeURIComponent(tag)}`,
      headers,
      payload: { status },
    });
  const social = async () => (await app.inject({ url: `/api/v1/articles/${ids[0]}/writing` })).json().social;

  it('uses shared classifications and directs obsolete editors to tag management', async () => {
    const old = await app.inject({ method: 'PUT', url: '/auth/admin/writing/people/沈小明', headers, payload: { roles: ['醫療健康'] } });
    expect(old.statusCode).toBe(409);
    expect(old.json().manageUrl).toContain('/admin/tags/');
    const denied = await app.inject({
      method: 'PUT',
      url: '/auth/admin/tag-groups/9902/tags/沈小明',
      headers: { cookie: 'tag_session=admin' },
      payload: { status: 'confirmed' },
    });
    expect(denied.statusCode).toBe(403);
    expect((await decide(9902, 'confirmed')).statusCode).toBe(200);
    expect((await social()).roles).toEqual(['評論名嘴']);
    const common = (await app.inject({ url: '/api/v1/tags/沈小明/groups' })).json().groups;
    expect(common).toEqual(expect.arrayContaining([expect.objectContaining({ id: 9902 })]));
    await decide(9902, 'rejected');
    expect((await social()).roles).toEqual(['未知']);
  });

  it('preserves multiple shared labels across analysis, filtering, counts and removal', async () => {
    const before = await writingOverview(db, 7);
    await decide(9902, 'confirmed');
    await decide(9903, 'confirmed');
    await db.update(articleWriting).set({ version: 'old' }).where(eq(articleWriting.articleId, ids[0]));
    await runWritingJob(db);
    await runWritingPeopleJob(db);
    expect(await social()).toMatchObject({ roles: ['評論名嘴', '醫療健康'], roleSource: 'people' });
    for (const role of ['評論名嘴', '醫療健康']) {
      const list = (await app.inject({ url: `/api/v1/writing/articles?role=${role}&poster=沈小明` })).json();
      expect(list.articles).toHaveLength(1);
      expect(list.articles[0]).toMatchObject({ id: ids[0], roles: ['評論名嘴', '醫療健康'] });
    }
    const after = await writingOverview(db, 7);
    expect(after.totals.articles).toBe(before.totals.articles);
    expect(after.totals.social).toBe(before.totals.social);
    expect(after.totals.roles['評論名嘴']).toBe(before.totals.roles['評論名嘴'] + 1);
    expect(after.totals.roles['醫療健康']).toBe(before.totals.roles['醫療健康'] + 1);
    expect(after.posters.filter((p) => p.name === '沈小明')).toEqual([
      expect.objectContaining({ roles: ['評論名嘴', '醫療健康'], articles: 1, outlets: 1 }),
    ]);
    await decide(9902, 'rejected');
    expect((await social()).roles).toEqual(['醫療健康']);
    expect((await app.inject({ url: '/api/v1/writing/articles?role=評論名嘴&poster=沈小明' })).json().articles).toEqual([]);
    await decide(9903, 'rejected');
    expect((await social()).roles).toEqual(['未知']);
  });

  it('inherits subgroup roles, keeps mappings on rename and recalculates moves/deletions', async () => {
    await decide(9904, 'confirmed');
    expect((await social()).roles).toEqual(['醫療健康']);
    const patch = (id: number, payload: object) => app.inject({ method: 'PATCH', url: `/auth/admin/tag-groups/${id}`, headers, payload });
    expect((await patch(9903, { label: '更名的醫療分類' })).statusCode).toBe(200);
    await decide(9904, 'confirmed');
    expect((await social()).roles).toEqual(['醫療健康']);
    expect((await patch(9904, { parentId: 9902 })).statusCode).toBe(200);
    expect((await social()).roles).toEqual(['評論名嘴']);
    expect((await app.inject({ method: 'DELETE', url: '/auth/admin/tag-groups/9902', headers })).statusCode).toBe(200);
    expect((await social()).roles).toEqual(['未知']);
    // Classifications also work for organizations and other non-person tags.
    expect((await decide(9903, 'confirmed', '測試機構')).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/v1/tags/測試機構/groups' })).json().groups).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 9903 })]),
    );
  });

  it('separates article keywords from retelling evidence and paginates unique articles', async () => {
    const tag = '沈小明';
    await db.insert(articleTags).values(ids.map((articleId) => ({ articleId, tag, publishedAt: now })));
    const get = (suffix = '', auth = true) =>
      app.inject({ url: `/auth/admin/tags/${tag}/articles${suffix}`, headers: auth ? headers : {} });
    expect((await get('', false)).statusCode).toBe(401);
    expect((await get('?before=oops')).statusCode).toBe(400);
    const response = await get();
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const rows = response.json().articles;
    expect(rows).toHaveLength(ids.length);
    const retold = rows.find((r: { id: number }) => r.id === ids[0]);
    expect(retold.relations.map((r: { kind: string }) => r.kind)).toEqual(['tagged', 'retold']);
    expect(retold.relations[1].evidence).toContain('精神科醫師沈小明');
    expect(retold.publishedAt).toBe(new Date(Math.floor(now.getTime() / 1000) * 1000).toISOString());
    expect(rows.find((r: { id: number }) => r.id === ids[4]).relations.map((r: { kind: string }) => r.kind)).toEqual(['tagged']);
    const page = (await get(`?before=${ids[4]}`)).json();
    expect(page.articles.map((r: { id: number }) => r.id)).toEqual(ids.slice(0, 4).reverse());
    expect(page.next).toBeNull();
    await db.insert(articles).values(
      Array.from({ length: 32 }, (_, i) => ({
        media: 'chinatimes',
        publishedAt: now,
        crawledAt: now,
        url: `https://writing.test/page-${i}`,
        title: `分頁測試 ${i}`,
        tags: [tag],
        source: 'own' as const,
      })),
    );
    const extra = (await db.select({ id: articles.id }).from(articles).where(sql`url LIKE 'https://writing.test/page-%'`)).map((r) => r.id);
    ids.push(...extra);
    await db.insert(articleTags).values(extra.map((articleId) => ({ articleId, tag, publishedAt: now })));
    const first = (await get()).json();
    expect(first.articles).toHaveLength(30);
    expect(first.next).toBe(first.articles[29].id);
    const second = (await get(`?before=${first.next}`)).json();
    expect(new Set([...first.articles, ...second.articles].map((r: { id: number }) => r.id)).size).toBe(ids.length);
    expect(second.next).toBeNull();
  });

  it('reads and filters legacy rows without a roles array', async () => {
    await db.update(articleWriting).set({ role: '醫療健康', roles: null }).where(eq(articleWriting.articleId, ids[0]));
    expect((await app.inject({ url: `/api/v1/articles/${ids[0]}/writing` })).json().social.roles).toEqual(['醫療健康']);
    const list = (await app.inject({ url: '/api/v1/writing/articles?role=醫療健康&poster=沈小明' })).json();
    expect(list.articles.map((a: { id: number }) => a.id)).toEqual([ids[0]]);
    expect((await writingOverview(db, 7)).posters.find((p) => p.name === '沈小明')?.roles).toEqual(['醫療健康']);
  });
});
