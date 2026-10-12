// Identity corrections must change the upload pipeline and survive background work.
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import Fastify from 'fastify';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { registerAvatarAdmin } from '../src/avatars/admin.ts';
import { addPhoto, processTag } from '../src/avatars/run.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { tagAvatarCandidates, tagGroupMembers, tagPeople, tagPeopleLog, tagPictureVotes, tagWikidata } from '../src/db/schema.ts';
import { registerPictureRoutes } from '../src/pictures/routes.ts';
import { applyVotes } from '../src/pictures/votes.ts';
import { fileWikidata } from '../src/tag-groups/run.ts';
import { processTags } from '../src/tag-visuals/run.ts';
import { registerTagPerson } from '../src/v1/tag-person.ts';
import { registerTagVisual } from '../src/v1/tag-visual.ts';

const stubs = vi.hoisted(() => ({ findPerson: vi.fn(), inspect: vi.fn() }));
vi.mock('../src/avatars/wikidata.ts', async (original) => ({ ...(await original<object>()), findPerson: stubs.findPerson }));
vi.mock('../src/avatars/vision.ts', async (original) => ({ ...(await original<object>()), decode: vi.fn(async () => ({})) }));
vi.mock('../src/avatars/portrait.ts', async (original) => ({
  ...(await original<object>()),
  inspect: stubs.inspect,
  quality: () => ({ score: 1, parts: {} }),
  renderAvatar: async () => Buffer.from('sketch'),
}));

const url = process.env.TEST_DB_URL;
const origin = 'https://tag.observe.tw';
const admin = { id: 1, email: 'admin@example.com', name: null, picture: null, role: 'admin' as const };
const tag = '特斯拉';
const path = `/auth/pictures/${encodeURIComponent(tag)}`;
const headers = { origin, 'x-user': 'admin' };

describe.skipIf(!url)('correct a brand mistaken for a person (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  const app = Fastify();
  const queued = vi.fn(async () => ({ id: 'photo-job' }));
  const correction = (customHeaders = headers) =>
    app.inject({ method: 'PUT', url: `${path}/kind`, headers: customHeaders, payload: { kind: 'visual' } });
  const seed = async () => {
    await db
      .insert(tagPeople)
      .values({ tag, wikidataId: 'Q9036', label: '尼科拉·特斯拉', status: 'auto', shownRank: 1, checkedAt: new Date(0) })
      .onDuplicateKeyUpdate({ set: { wikidataId: 'Q9036', status: 'auto', shownRank: 1 } });
  };
  beforeAll(async () => {
    if (new URL(url!).pathname === '/tag_observe') throw Error('Refusing production database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    for (const table of [
      'tag_people',
      'tag_people_log',
      'tag_avatar_candidates',
      'tag_visuals',
      'tag_visual_candidates',
      'tag_picture_votes',
      'tag_wikidata',
      'tag_group_members',
    ]) {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table}`));
    }
    await seed();
    await db.insert(tagWikidata).values({ tag, wikidataId: 'Q9036', types: [{ id: 'Q5', label: '人類' }], checkedAt: new Date() });
    await db.insert(tagAvatarCandidates).values({
      tag,
      rank: 1,
      file: 'Tesla.jpg',
      pageUrl: '',
      score: 1,
      scores: {},
      verdict: 'ok',
      image: await sharp({ create: { width: 8, height: 8, channels: 4, background: '#fff' } })
        .webp()
        .toBuffer(),
    });
    await db.insert(tagPictureVotes).values({ tag, kind: 'avatar', userId: 1, rank: 1, at: new Date() });
    await db.insert(tagGroupMembers).values([
      { tag, groupId: 1, source: 'person', status: 'auto', updatedAt: new Date() },
      { tag, groupId: 2, source: 'admin', status: 'confirmed', updatedAt: new Date() },
    ]);
    const queue = () => ({ add: queued, getJob: async () => null, getJobs: async () => [] });
    registerPictureRoutes(app, db, {
      origin,
      queue,
      currentUser: async (r) => (r.headers['x-user'] ? { ...admin, role: r.headers['x-user'] === 'admin' ? 'admin' : 'reader' } : null),
    });
    registerTagPerson(app, db);
    registerTagVisual(app, db);
    registerAvatarAdmin(app, db, { origin, queue, requireAdmin: async () => admin });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await close?.();
  });

  it('requires an administrator and same-origin requests', async () => {
    expect((await correction({ origin, 'x-user': '' })).statusCode).toBe(401);
    expect((await correction({ origin, 'x-user': 'reader' })).statusCode).toBe(403);
    expect((await correction({ origin: 'https://other.example', 'x-user': 'admin' })).statusCode).toBe(403);
    expect((await app.inject({ url: path, headers })).json().kind).toBe('avatar');
  });
  it('removes the wrong public identity and automatic person groups, keeping historical votes', async () => {
    expect((await correction()).statusCode).toBe(200);
    expect((await app.inject({ url: path, headers })).json()).toMatchObject({ kind: 'visual', candidates: [], myVote: null });
    expect((await app.inject({ url: `/api/v1/tags/${encodeURIComponent(tag)}/person` })).json().person).toBeNull();
    expect((await app.inject({ url: `/api/v1/tags/${encodeURIComponent(tag)}/avatar` })).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/v1/tag-avatars' })).json().avatars).not.toHaveProperty(tag);
    expect(await db.select().from(tagPictureVotes)).toHaveLength(1);
    expect(await db.select().from(tagAvatarCandidates)).toHaveLength(1);
    expect(await db.select().from(tagGroupMembers)).toMatchObject([{ source: 'admin', status: 'confirmed' }]);
    await correction();
    expect(await db.select().from(tagPeopleLog)).toMatchObject([{ action: 'nonhuman', email: admin.email }]);
    expect(await db.select().from(tagPeopleLog)).toHaveLength(1);
  });
  it('accepts a logo without a face, votes for it, and serves it as the public picture', async () => {
    const image = await sharp(Buffer.from('<svg width="80" height="80"><path fill="red" d="M10 10h60v20H50v40H30V30H10z"/></svg>'))
      .png()
      .toBuffer();
    const uploaded = await app.inject({
      method: 'POST',
      url: `${path}/upload`,
      headers,
      payload: { image: image.toString('base64'), agree: true },
    });
    expect(uploaded.statusCode).toBe(200);
    expect(uploaded.json()).toMatchObject({ kind: 'visual', rank: 1 });
    expect(queued).not.toHaveBeenCalled();
    const state = (await app.inject({ url: path, headers })).json();
    expect(state).toMatchObject({ kind: 'visual', shownRank: 1, myVote: 1, candidates: [{ kind: 'logo', votes: 1 }] });
    expect(state.candidates[0].image).toContain('kind=visual');
    expect((await app.inject({ url: state.candidates[0].image, headers })).headers['content-type']).toBe('image/webp');
    const visual = (await app.inject({ url: `/api/v1/tags/${encodeURIComponent(tag)}/visual` })).json().visual;
    expect(visual.kind).toBe('logo');
    expect((await app.inject({ url: visual.image })).headers['content-type']).toBe('image/webp');
  });
  it('does not resurrect portraits through reruns, stale votes, or queued uploads', async () => {
    expect(await processTag(db, tag, { force: true })).toMatchObject({ status: 'nonhuman', skipped: true });
    expect(stubs.findPerson).not.toHaveBeenCalled();
    expect(await addPhoto(db, tag, Buffer.from('old upload'), admin.email, 1)).toMatchObject({ error: expect.stringContaining('非人物') });
    await applyVotes(db, tag, 'avatar');
    expect((await db.select().from(tagPeople))[0].status).toBe('nonhuman');
    expect(
      (await app.inject({ method: 'PUT', url: `/auth/admin/avatars/${encodeURIComponent(tag)}`, headers, payload: { rank: 1 } }))
        .statusCode,
    ).toBe(404);
    await fileWikidata(db, [tag]);
    expect(await db.select().from(tagGroupMembers)).toMatchObject([{ source: 'admin' }]);
  });
  it('honors a correction made while a portrait upload is rendering', async () => {
    await seed();
    let inspected!: () => void;
    const entered = new Promise<void>((resolve) => {
      inspected = resolve;
    });
    let finish!: (value: object) => void;
    stubs.inspect.mockImplementationOnce(() => {
      inspected();
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const pending = addPhoto(db, tag, Buffer.from('old upload'), admin.email, 1);
    await entered;
    await correction();
    finish({ verdict: 'ok', main: {}, aligned: {} });
    expect(await pending).toMatchObject({ error: expect.stringContaining('非人物') });
    expect(await db.select().from(tagAvatarCandidates)).toHaveLength(1);
  });
  it('honors a correction made during an automatic identity lookup', async () => {
    await seed();
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let finish!: (value: null) => void;
    stubs.findPerson.mockImplementationOnce(() => {
      entered();
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const pending = processTag(db, tag);
    await started;
    await correction();
    finish(null);
    expect(await pending).toMatchObject({ status: 'nonhuman', skipped: true });
    expect((await db.select().from(tagPeople).where(eq(tagPeople.tag, tag)))[0].status).toBe('nonhuman');
  });
  it('lets general-picture discovery proceed despite a cached namesake human', async () => {
    const loose = vi.fn(async () => []);
    const item = vi.fn(async () => []);
    expect(await processTags(db, [tag], { force: true, looseImpl: loose, itemImpl: item })).toMatchObject({ unasked: 1 });
    expect(loose).toHaveBeenCalledWith(tag);
    expect(item).not.toHaveBeenCalledWith('Q9036');
  });
});
