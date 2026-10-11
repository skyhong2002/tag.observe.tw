// Tag groups (docs/tag-groups.md): the filing rules, then the rule writer
// and the public and admin routes against a real MariaDB (TEST_DB_URL).
// Never point TEST_DB_URL at the production database: tables are truncated.
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken, type LoginStore } from '../src/auth/google-login.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { articleTags, tagGroupDefs, tagGroupMembers, tagStats, tagWikidata } from '../src/db/schema.ts';
import { runTagGroupsJob } from '../src/jobs/tag-groups-job.ts';
import { aiConfig, fileAi, parseReply, prompt } from '../src/tag-groups/ai.ts';
import { personGroups, SEED_GROUPS, sectionTopic, typeGroups, voteTopics } from '../src/tag-groups/rules.ts';
import { fileTag, seedGroupDefs } from '../src/tag-groups/run.ts';
import { ancestors, descendants, moveProblem } from '../src/tag-groups/tree.ts';

const groupId = (label: string) => SEED_GROUPS.find((g) => g.label === label)?.id as number;
const labels = (picks: { groupId: number }[]) => picks.map((p) => SEED_GROUPS.find((g) => g.id === p.groupId)?.label);

describe('person rules', () => {
  it('files a sitting legislator under 政治人物, 現任立委 and the party', () => {
    const picks = personGroups({
      citizenship: ['中華民國'],
      occupations: ['政治人物'],
      parties: ['中國國民黨'],
      positions: [
        { label: '立法委員', current: true },
        { label: '中國國民黨主席', current: true },
        { label: '臺北市議員', current: false },
      ],
    });
    expect(labels(picks)).toEqual(['政治人物', '現任立委', '國民黨']);
  });

  it('keeps past posts out and foreign people in the foreign groups', () => {
    const trump = personGroups({
      citizenship: ['美國'],
      occupations: ['企業大亨', '政治人物', '演員'],
      parties: ['共和黨'],
      positions: [{ label: '美國總統', current: true }],
    });
    // a politician is not filed as an entertainer or business manager; foreign parties have no group
    expect(labels(trump)).toEqual(['外國政治人物']);
    expect(labels(personGroups({ citizenship: ['日本'], occupations: ['棒球運動員'], parties: [], positions: [] }))).toEqual([
      '外國運動員',
    ]);
    expect(labels(personGroups({ citizenship: ['香港'], occupations: ['演員', '歌手'], parties: [], positions: [] }))).toEqual([
      '中港藝人',
    ]);
    expect(labels(personGroups({ citizenship: ['中華民國'], occupations: ['歌手'], parties: [], positions: [] }))).toEqual([
      '藝人',
      '歌手樂團',
    ]);
    const mayor = personGroups({
      citizenship: ['中華民國'],
      occupations: ['政治人物'],
      parties: [],
      positions: [
        { label: '臺北市市長', current: true },
        { label: '臺北市副市長', current: false },
      ],
    });
    expect(labels(mayor)).toEqual(['政治人物', '現任縣市長']);
    const premier = personGroups({
      citizenship: ['中華民國'],
      occupations: [],
      parties: [],
      positions: [{ label: '行政院院長', current: true }],
    });
    expect(labels(premier)).toEqual(['政治人物', '內閣']);
  });
});

describe('wikidata types', () => {
  it('maps direct types to groups and topics, once each', () => {
    const picks = typeGroups(
      [
        { id: 'Q891723', label: '上市公司' },
        { id: 'Q4830453', label: '企業' },
        { id: 'Q43229', label: '組織' },
      ],
      [groupId('產業金融')],
    );
    expect(picks).toEqual([{ groupId: groupId('公司廠商'), note: '上市公司', review: false }]);
    expect(labels(typeGroups([{ id: 'Q7278', label: '政黨' }]))).toEqual(['政治']);
    expect(typeGroups([])).toEqual([]);
  });

  it('holds a type back for review when the outlets file the tag elsewhere', () => {
    const show = [{ id: 'Q15416', label: '電視節目' }];
    // 「失聯」: a TV series on Wikidata, but the news files it under 社會
    expect(typeGroups(show, [groupId('社會')])[0].review).toBe(true);
    expect(typeGroups(show, [groupId('娛樂'), groupId('社會')])[0].review).toBe(false);
    // no section data to back the type
    expect(typeGroups(show, [])[0].review).toBe(true);
    // a party is a party whatever the sections say
    expect(typeGroups([{ id: 'Q7278', label: '政黨' }], [])[0].review).toBe(false);
  });
});

describe('section topics', () => {
  it('reads Chinese section names and whole Latin words', () => {
    expect(sectionTopic('政治')).toBe(groupId('政治'));
    expect(sectionTopic('國際財經')).toBe(groupId('國際'));
    expect(sectionTopic('國際政經')).toBe(groupId('國際'));
    expect(sectionTopic('台股盤中')).toBe(groupId('產業金融'));
    expect(sectionTopic('sports')).toBe(groupId('體育'));
    expect(sectionTopic('Politics')).toBe(groupId('政治'));
    expect(sectionTopic('competition')).toBeNull();
    expect(sectionTopic('news')).toBeNull();
    expect(sectionTopic(null)).toBeNull();
  });

  it('gives each outlet one vote, so a ticker feed cannot outvote papers', () => {
    const politics = groupId('政治');
    const money = groupId('產業金融');
    const rows = [
      { media: 'cnyes', topic: money, n: 900 },
      { media: 'udn', topic: politics, n: 40 },
      { media: 'ltn', topic: politics, n: 30 },
      { media: 'cna', topic: politics, n: 5 },
      { media: 'cna', topic: money, n: 5 },
    ];
    expect(voteTopics(rows)).toEqual([
      { groupId: politics, share: 0.625, outlets: 3 },
      { groupId: money, share: 0.375, outlets: 2 },
    ]);
    // too few outlets to say anything
    expect(voteTopics(rows.slice(0, 2))).toEqual([]);
  });
});

describe('AI fallback', () => {
  it('needs a base URL and key, and defaults to sky-fast', () => {
    expect(aiConfig({})).toBeNull();
    expect(aiConfig({ TAG_AI_BASE_URL: 'http://gw/v1/', TAG_AI_API_KEY: 'k' })).toEqual({
      baseUrl: 'http://gw/v1',
      apiKey: 'k',
      model: 'sky-fast',
    });
  });

  it('lists the groups and the headlines in the prompt', () => {
    const [system, user] = prompt(SEED_GROUPS, [{ tag: '總預算', titles: ['立法院審總預算'] }]);
    expect(system.content).toContain('2 現任立委');
    expect(system.content).toContain('101 政治');
    expect(user.content).toBe('標籤：總預算\n- 立法院審總預算');
  });

  it('keeps only asked tags and known group ids', () => {
    const reply = JSON.stringify({
      tags: [
        { tag: '總預算', groups: [15, 101, 999, '101'] },
        { tag: '沒問', groups: [1] },
        { tag: '罷免', groups: 'x' },
      ],
    });
    const out = parseReply(reply, ['總預算', '罷免'], new Set(SEED_GROUPS.map((g) => g.id)));
    expect([...out]).toEqual([['總預算', [15, 101]]]);
    expect(parseReply('not json', ['總預算'], new Set([1])).size).toBe(0);
  });
});

describe('group tree', () => {
  const defs = [
    { id: 1, label: '政治人物', kind: 'group' as const, sort: 0, parentId: null },
    { id: 2, label: '現任立委', kind: 'group' as const, sort: 1, parentId: 1 },
    { id: 9, label: '不分區', kind: 'group' as const, sort: 2, parentId: 2 },
    { id: 101, label: '政治', kind: 'topic' as const, sort: 3, parentId: null },
  ];
  it('walks down and up', () => {
    expect(descendants(defs, 1)).toEqual([1, 2, 9]);
    expect(ancestors(defs, 9).map((d) => d.id)).toEqual([2, 1]);
    expect(ancestors(defs, 1)).toEqual([]);
  });
  it('refuses cycles and mixed kinds', () => {
    expect(moveProblem(defs, 1, 9)).toMatch(/itself/);
    expect(moveProblem(defs, 2, 2)).toMatch(/itself/);
    expect(moveProblem(defs, 2, 101)).toMatch(/same kind/);
    expect(moveProblem(defs, 9, 1)).toBeNull();
    expect(moveProblem(defs, 9, null)).toBeNull();
  });
});

const url = process.env.TEST_DB_URL;
const ORIGIN = 'https://tag.observe.tw';
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

describe.skipIf(!url)('tag group writer and routes (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const as = (who: string | null, write = true) => ({
    ...(who ? { cookie: `tag_session=${who}` } : {}),
    ...(write ? { origin: ORIGIN } : {}),
  });
  const decide = (group: number, tag: string, status: unknown, headers = as('admin')) =>
    app.inject({
      method: 'PUT',
      url: `/auth/admin/tag-groups/${group}/tags/${encodeURIComponent(tag)}`,
      headers,
      payload: { status } as object,
    });
  const shown = async (tag: string) =>
    (await app.inject({ url: `/api/v1/tags/${encodeURIComponent(tag)}/groups` })).json().groups.map((g: { label: string }) => g.label);

  beforeAll(async () => {
    if (/\/tag_observe$/.test(url ?? '')) throw Error('TEST_DB_URL points at the production database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    for (const t of ['tag_group_defs', 'tag_group_def_log', 'tag_group_members', 'tag_group_member_log', 'tag_wikidata'])
      await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
    await seedGroupDefs(db);
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

  it('files a tag in several groups and replaces only its own auto rows', async () => {
    await fileTag(db, '川普', 'person', [{ groupId: groupId('外國政治人物'), score: null, note: '美國政治人物' }]);
    await fileTag(db, '川普', 'section', [
      { groupId: groupId('國際'), score: 0.6, note: '8 家媒體 60%' },
      { groupId: groupId('產業金融'), score: 0.35, note: '4 家媒體 35%' },
    ]);
    expect(await shown('川普')).toEqual(['外國政治人物', '國際', '產業金融']);
    // the next section run no longer sees 產業金融: only that row goes
    expect(await fileTag(db, '川普', 'section', [{ groupId: groupId('國際'), score: 0.7, note: '9 家媒體 70%' }])).toEqual({
      added: 0,
      removed: 1,
    });
    expect(await shown('川普')).toEqual(['外國政治人物', '國際']);
  });

  it("lets a sure rule promote another source's review row, never an admin's", async () => {
    await db.insert(tagGroupMembers).values([
      { tag: '蔡易餘', groupId: groupId('現任立委'), source: 'legacy', status: 'review', updatedAt: new Date() },
      { tag: '蔡易餘', groupId: groupId('民進黨'), source: 'admin', status: 'review', updatedAt: new Date() },
    ]);
    await fileTag(db, '蔡易餘', 'person', [
      { groupId: groupId('現任立委'), score: null, note: '現任立法委員' },
      { groupId: groupId('民進黨'), score: null, note: '民主進步黨黨員' },
    ]);
    const rows = await db.select().from(tagGroupMembers).where(sql`${tagGroupMembers.tag} = '蔡易餘'`);
    expect(rows.find((r) => r.groupId === groupId('現任立委'))).toMatchObject({ source: 'person', status: 'auto', note: '現任立法委員' });
    expect(rows.find((r) => r.groupId === groupId('民進黨'))).toMatchObject({ source: 'admin', status: 'review' });
    // a review suggestion does not promote anything
    await fileTag(db, '蔡易餘', 'ai', [{ groupId: groupId('民進黨'), score: 0, note: 'AI', status: 'review' }]);
    expect(
      (await db.select().from(tagGroupMembers).where(sql`${tagGroupMembers.tag} = '蔡易餘'`)).find((r) => r.groupId === groupId('民進黨')),
    ).toMatchObject({ source: 'admin' });
  });

  it('lets only admins decide, from the site itself', async () => {
    expect((await decide(groupId('政治'), '川普', 'confirmed', as(null))).statusCode).toBe(401);
    expect((await decide(groupId('政治'), '川普', 'confirmed', as('reader'))).statusCode).toBe(403);
    expect((await decide(groupId('政治'), '川普', 'confirmed', as('admin', false))).statusCode).toBe(403);
    expect((await decide(groupId('政治'), '川普', 'maybe')).statusCode).toBe(400);
    expect((await decide(999, '川普', 'confirmed')).statusCode).toBe(404);
  });

  it('keeps an admin rejection and addition through later rule runs', async () => {
    expect((await decide(groupId('國際'), '川普', 'rejected')).statusCode).toBe(200);
    expect((await decide(groupId('政治'), '川普', 'confirmed')).statusCode).toBe(200);
    await fileTag(db, '川普', 'section', [{ groupId: groupId('國際'), score: 0.9, note: '10 家媒體 90%' }]);
    expect(await shown('川普')).toEqual(['外國政治人物', '政治']);
    const admin = (
      await app.inject({ url: `/auth/admin/tag-groups/tags/${encodeURIComponent('川普')}`, headers: as('admin', false) })
    ).json();
    expect(admin.members.find((m: { groupId: number }) => m.groupId === groupId('國際'))).toMatchObject({
      status: 'rejected',
      reviewedBy: 'admin@example.com',
    });
    expect(admin.members.find((m: { groupId: number }) => m.groupId === groupId('政治'))).toMatchObject({
      source: 'admin',
      status: 'confirmed',
    });
    const [{ n }] = (await db.execute(sql`SELECT COUNT(*) n FROM tag_group_member_log WHERE tag = '川普'`))[0] as unknown as [
      { n: number },
    ];
    expect(Number(n)).toBe(2);
  });

  it('lists groups and their tags publicly, without review or rejected rows', async () => {
    await db
      .insert(tagGroupMembers)
      .values({ tag: '林全', groupId: groupId('內閣'), source: 'legacy', status: 'review', updatedAt: new Date() });
    const list = (await app.inject({ url: '/api/v1/tag-groups' })).json().groups;
    expect(list.find((g: { label: string }) => g.label === '內閣').tags).toBe(0);
    expect(list.find((g: { label: string }) => g.label === '政治')).toMatchObject({ kind: 'topic', tags: 1 });
    const members = (await app.inject({ url: `/api/v1/tag-groups/${groupId('外國政治人物')}` })).json();
    expect(members).toMatchObject({ label: '外國政治人物', next: null, tags: [{ tag: '川普', source: 'person' }] });
    expect((await app.inject({ url: '/api/v1/tag-groups/999' })).statusCode).toBe(404);
  });

  it('lets admins add a group once', async () => {
    const add = (label: string) =>
      app.inject({ method: 'POST', url: '/auth/admin/tag-groups', headers: as('admin'), payload: { label, kind: 'group' } });
    const res = await add('地名');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ label: '地名', kind: 'group' });
    expect((await add('地名')).statusCode).toBe(409);
  });

  it('leaves tags unasked when the gateway fails, so the next run retries', async () => {
    const down = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
    const config = { baseUrl: 'http://gw/v1', apiKey: 'bad', model: 'sky-fast' };
    expect(await fileAi(db, ['罷免'], config, { fetchImpl: down })).toEqual({ asked: 1, added: 0, errors: 1 });
    expect(await db.select().from(tagWikidata).where(sql`${tagWikidata.tag} = '罷免'`)).toEqual([]);
  });

  it('files AI suggestions for review only, and asks once in 30 days', async () => {
    await fileTag(db, '總預算', 'section', [{ groupId: groupId('政治'), score: 0.5, note: '5 家媒體 50%' }]);
    let calls = 0;
    const fake = (async (_url: string, init: { body: string }) => {
      calls++;
      const asked = JSON.parse(init.body).messages[1].content as string;
      expect(asked).toContain('標籤：總預算');
      // 川普 already has a group and a topic: not asked
      expect(asked).not.toContain('川普');
      const content = JSON.stringify({ tags: [{ tag: '總預算', groups: [groupId('議題'), groupId('政治')] }] });
      return new Response(JSON.stringify({ model: 'gpt-test', choices: [{ message: { content } }] }));
    }) as unknown as typeof fetch;
    const config = { baseUrl: 'http://gw/v1', apiKey: 'k', model: 'sky-fast' };
    expect(await fileAi(db, ['總預算', '川普'], config, { fetchImpl: fake })).toEqual({ asked: 1, added: 1, errors: 0 });
    const rows = await db.select().from(tagGroupMembers).where(sql`${tagGroupMembers.tag} = '總預算'`);
    // the section row stays auto; the AI's new group waits for review
    expect(rows.map((r) => [r.groupId, r.source, r.status]).sort()).toEqual(
      [
        [groupId('政治'), 'section', 'auto'],
        [groupId('議題'), 'ai', 'review'],
      ].sort(),
    );
    expect(await shown('總預算')).toEqual(['政治']);
    const [check] = await db.select().from(tagWikidata).where(sql`${tagWikidata.tag} = '總預算'`);
    expect(check.aiCheckedAt).toBeInstanceOf(Date);
    expect(await fileAi(db, ['總預算'], config, { fetchImpl: fake })).toEqual({ asked: 0, added: 0, errors: 0 });
    expect(calls).toBe(1);
  });

  it('nests, renames and reorders groups, and shows a tag in the groups above', async () => {
    const patch = (id: number, payload: object) =>
      app.inject({ method: 'PATCH', url: `/auth/admin/tag-groups/${id}`, headers: as('admin'), payload });
    const foreign = groupId('外國政治人物');
    const politician = groupId('政治人物');
    expect((await patch(foreign, { parentId: politician })).statusCode).toBe(200);
    expect((await patch(politician, { parentId: foreign })).statusCode).toBe(400);
    expect((await patch(foreign, { parentId: groupId('國際') })).statusCode).toBe(400);
    expect((await patch(groupId('北市府'), { label: '臺北市府' })).json()).toMatchObject({ label: '臺北市府' });
    expect((await patch(groupId('北市府'), { label: '政治人物' })).statusCode).toBe(409);
    expect(
      (await app.inject({ method: 'PATCH', url: `/auth/admin/tag-groups/${foreign}`, headers: as('reader'), payload: { label: 'x' } }))
        .statusCode,
    ).toBe(403);
    // 川普 is filed under 外國政治人物 only; 政治人物 shows as its parent
    const groups = (await app.inject({ url: `/api/v1/tags/${encodeURIComponent('川普')}/groups` })).json().groups;
    expect(groups.find((g: { id: number }) => g.id === politician)).toMatchObject({ source: 'parent' });
    expect(groups.find((g: { id: number }) => g.id === foreign)).toMatchObject({ source: 'person', parentId: politician });
    const list = (await app.inject({ url: '/api/v1/tag-groups' })).json().groups;
    expect(list.find((g: { id: number }) => g.id === politician).tags).toBeGreaterThanOrEqual(1);
    // order: swap the first two identity groups
    const order = await app.inject({ method: 'PUT', url: '/auth/admin/tag-groups/order', headers: as('admin'), payload: { ids: [2, 1] } });
    expect(order.statusCode).toBe(200);
    const ids = (await app.inject({ url: '/api/v1/tag-groups' })).json().groups.map((g: { id: number }) => g.id);
    expect(ids.indexOf(2)).toBeLessThan(ids.indexOf(1));
    const [{ n }] = (await db.execute(sql`SELECT COUNT(*) n FROM tag_group_def_log`))[0] as unknown as [{ n: number }];
    // create (地名, earlier), move, rename, sort
    expect(Number(n)).toBe(4);
  });

  it("ranks a group's tags by recent reports, subgroups included", async () => {
    const day = 86_400_000;
    await db.delete(articleTags).where(sql`${articleTags.articleId} BETWEEN 9900001 AND 9900010`);
    await db.delete(tagStats).where(sql`${tagStats.tag} = '川普'`);
    const now = new Date();
    await db.insert(tagStats).values({
      tag: '川普',
      category: 'news',
      level: 2,
      firstHour: now,
      lastHour: now,
      hoursCount: 1,
      maxHour: now,
      maxCount: 1,
      updatedAt: now,
    });
    await db.insert(articleTags).values([
      { articleId: 9900001, tag: '川普', publishedAt: new Date(Date.now() - day) },
      { articleId: 9900002, tag: '川普', publishedAt: new Date(Date.now() - 2 * day) },
      { articleId: 9900003, tag: '川普', publishedAt: new Date(Date.now() - 3 * day) },
      { articleId: 9900004, tag: '川普', publishedAt: new Date(Date.now() - 10 * day) },
    ]);
    const r = (await app.inject({ url: `/api/v1/tag-groups/${groupId('政治人物')}/ranking?days=7` })).json();
    expect(r.subgroups.map((g: { id: number }) => g.id)).toContain(groupId('外國政治人物'));
    expect(r.ranking).toContainEqual({ tag: '川普', recent: 3, previous: 1, groups: [groupId('外國政治人物')] });
    expect((await app.inject({ url: '/api/v1/tag-groups/999/ranking' })).statusCode).toBe(404);
  });

  it('deletes a group: tags leave, subgroups move up, rules and seeds stay out', async () => {
    const foreign = groupId('外國政治人物');
    const child = await app.inject({
      method: 'POST',
      url: '/auth/admin/tag-groups',
      headers: as('admin'),
      payload: { label: '外國元首', kind: 'group', parentId: foreign },
    });
    const childId = child.json().id;
    const del = await app.inject({ method: 'DELETE', url: `/auth/admin/tag-groups/${foreign}`, headers: as('admin') });
    expect(del.json()).toMatchObject({ deleted: true, children: [childId] });
    expect((await db.select().from(tagGroupMembers).where(sql`${tagGroupMembers.groupId} = ${foreign}`)).length).toBe(0);
    const [moved] = await db.select().from(tagGroupDefs).where(sql`${tagGroupDefs.id} = ${childId}`);
    expect(moved.parentId).toBe(groupId('政治人物'));
    expect(await fileTag(db, '川普', 'person', [{ groupId: foreign, score: null, note: '美國政治人物' }])).toMatchObject({ added: 0 });
    await seedGroupDefs(db);
    expect((await app.inject({ url: '/api/v1/tag-groups' })).json().groups.some((g: { id: number }) => g.id === foreign)).toBe(false);
    expect((await app.inject({ url: `/api/v1/tag-groups/${foreign}` })).statusCode).toBe(404);
  });

  it('runs as a daily job within its budget, skipping the AI without a key', async () => {
    const r = await runTagGroupsJob(db, { budgetMs: 0, env: {} });
    expect(r).toMatchObject({ ai: 'skipped: no TAG_AI_API_KEY', stopped: true });
  });
});
