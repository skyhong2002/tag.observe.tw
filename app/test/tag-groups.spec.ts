// Tag groups (docs/tag-groups.md): the filing rules, then the rule writer
// and the public and admin routes against a real MariaDB (TEST_DB_URL).
// Never point TEST_DB_URL at the production database: tables are truncated.
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken, type LoginStore } from '../src/auth/google-login.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { tagGroupMembers, tagWikidata } from '../src/db/schema.ts';
import { aiConfig, fileAi, parseReply, prompt } from '../src/tag-groups/ai.ts';
import { personGroups, SEED_GROUPS, sectionTopic, typeGroups, voteTopics } from '../src/tag-groups/rules.ts';
import { fileTag, seedGroupDefs } from '../src/tag-groups/run.ts';

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
    for (const t of ['tag_group_defs', 'tag_group_members', 'tag_group_member_log', 'tag_wikidata'])
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
    expect(await fileAi(db, ['總預算', '川普'], config, { fetchImpl: fake })).toEqual({ asked: 1, added: 1 });
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
    expect(await fileAi(db, ['總預算'], config, { fetchImpl: fake })).toEqual({ asked: 0, added: 0 });
    expect(calls).toBe(1);
  });
});
