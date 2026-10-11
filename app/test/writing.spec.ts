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
import { articles, articleWriting } from '../src/db/schema.ts';
import { runWritingJob, runWritingPeopleJob } from '../src/jobs/writing-job.ts';
import { VERSION } from '../src/writing/rules.ts';

const url = process.env.TEST_DB_URL;
const ORIGIN = 'https://tag.observe.tw';
const store: LoginStore = {
  upsertUser: async () => 1,
  createSession: async () => {},
  deleteSession: async () => {},
  listUsers: async () => [],
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
    await db.execute(sql`DELETE FROM tag_group_members WHERE group_id = 9901`);
    await db.execute(sql`DELETE FROM tag_group_defs WHERE id = 9901`);
    await db.execute(sql`INSERT INTO tag_group_defs (id, label, kind, sort, created_at) VALUES (9901, '名嘴', 'group', 0, NOW())`);
    await db.execute(sql`INSERT INTO tag_group_members (tag, group_id, source, status, updated_at)
      VALUES ('邱九十', 9901, 'admin', 'confirmed', NOW()), ('周十一', 9901, 'admin', 'confirmed', NOW())`);
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
      await db.delete(articles).where(inArray(articles.id, ids));
      await db.execute(sql`DELETE FROM tag_group_members WHERE group_id = 9901`);
      await db.execute(sql`DELETE FROM tag_group_defs WHERE id = 9901`);
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

  it('lets an admin correct a poster role, with a log entry', async () => {
    const put = (name: string, payload: object, headers: Record<string, string> = { cookie: 'tag_session=admin', origin: ORIGIN }) =>
      app.inject({ method: 'PUT', url: `/auth/admin/writing/people/${encodeURIComponent(name)}`, headers, payload });
    expect((await put('沈小明', { role: '評論名嘴', note: 'x' }, { cookie: 'tag_session=admin' })).statusCode).toBe(403);
    expect((await put('沈小明', { role: '評論名嘴' })).statusCode).toBe(400);
    expect((await put('沈小明', { role: '評論名嘴', note: '本篇是政治評論' })).json()).toMatchObject({ relabelled: 1 });
    expect((await app.inject({ url: `/api/v1/articles/${ids[0]}/writing` })).json().social.role).toBe('評論名嘴');
    const listed = await app.inject({ url: '/auth/admin/writing/people', headers: { cookie: 'tag_session=admin' } });
    expect(listed.json().log[0]).toMatchObject({ name: '沈小明', before: null, after: '評論名嘴' });
    // The list shows each poster's most common role and the split, not an arbitrary one.
    expect(listed.json().posters.find((p: { name: string }) => p.name === '沈小明')).toMatchObject({
      role: '評論名嘴',
      roles: [{ role: '評論名嘴', n: 1 }],
    });
    expect((await put('沈小明', { role: null })).json().relabelled).toBe(1);
    expect((await app.inject({ url: `/api/v1/articles/${ids[0]}/writing` })).json().social.role).toBe('未知');
  });
});
