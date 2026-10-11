// Tag avatars (docs/tag-avatars.md): the geometry and photo rules, then the
// public and admin routes against a real MariaDB (TEST_DB_URL). Never point
// TEST_DB_URL at the production database: tables are truncated.
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken, type LoginStore } from '../src/auth/google-login.ts';
import { inkImage } from '../src/avatars/ink.ts';
import { judge, MIN_FACE, quality } from '../src/avatars/portrait.ts';
import { shotName } from '../src/avatars/run.ts';
import { type Face, keepLargest, laplacianVariance, similarity } from '../src/avatars/vision.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { tagAvatarCandidates, tagPeople } from '../src/db/schema.ts';

const face = (x: number, y: number, w: number, score = 0.9): Face => ({
  x,
  y,
  w,
  h: w * 1.25,
  score,
  // eyes level, nose centred: a frontal face
  landmarks: [
    [x + w * 0.3, y + w * 0.5],
    [x + w * 0.7, y + w * 0.5],
    [x + w * 0.5, y + w * 0.75],
    [x + w * 0.35, y + w],
    [x + w * 0.65, y + w],
  ],
});

describe('similarity transform', () => {
  it('recovers rotation, scale and shift exactly', () => {
    const src: [number, number][] = [
      [0, 0],
      [10, 0],
      [5, 5],
      [2, 9],
      [8, 9],
    ];
    const angle = Math.PI / 6;
    const k = 2;
    const dst = src.map(([x, y]): [number, number] => [
      k * (Math.cos(angle) * x - Math.sin(angle) * y) + 3,
      k * (Math.sin(angle) * x + Math.cos(angle) * y) - 4,
    ]);
    const m = similarity(src, dst);
    expect(m.c).toBeCloseTo(k * Math.cos(angle), 9);
    expect(m.s).toBeCloseTo(k * Math.sin(angle), 9);
    expect(m.tx).toBeCloseTo(3, 9);
    expect(m.ty).toBeCloseTo(-4, 9);
  });
});

describe('photo rules', () => {
  it('needs one big enough face alone in the crop', () => {
    expect(judge([])).toBe('noface');
    expect(judge([face(500, 300, MIN_FACE - 1)])).toBe('small');
    expect(judge([face(500, 300, 200)])).toBe('ok');
    // a second face of similar size: a group photo
    expect(judge([face(200, 300, 200), face(700, 300, 170)])).toBe('group');
    // a small face right beside the main one: inside the head-and-shoulders crop
    expect(judge([face(500, 300, 200), face(720, 450, 60)])).toBe('bystander');
    // a small face far away: outside the crop
    expect(judge([face(500, 300, 200), face(1100, 100, 60)])).toBe('ok');
  });

  it('scores 0–1 and marks bystander photos down', () => {
    const aligned = { data: new Uint8Array(112 * 112 * 3).fill(140), width: 112, height: 112 };
    const ok = quality(face(0, 0, 300), aligned, 0.9, 'ok');
    const bystander = quality(face(0, 0, 300), aligned, 0.9, 'bystander');
    expect(ok.parts.front).toBe(1);
    expect(ok.score).toBeGreaterThan(0);
    expect(ok.score).toBeLessThanOrEqual(1);
    expect(bystander.score).toBeCloseTo(ok.score * 0.7, 2);
  });

  it('treats Commons crops as the same shot as their source', () => {
    expect(shotName('Lee Da-hye in Nan Ji Chang Night Market (cropped).jpg')).toBe(shotName('Lee Da-hye in Nan Ji Chang Night Market.jpg'));
    expect(shotName('柯文哲 IMG 9322-1 (cropped 2).jpg')).toBe(shotName('柯文哲 IMG 9322-1 (cropped).JPG'));
    expect(shotName('賴清德總統 1.jpg')).not.toBe(shotName('賴清德總統 2.jpg'));
  });

  it('sinks the painted sketch to the bottom edge, so the name sits right under the shoulders', async () => {
    // A photo cut off at the chest: the person fills only the top half of the square.
    const half = await sharp(
      Buffer.alloc(16 * 16 * 4).map((_, i) => (Math.floor(i / 4 / 16) < 8 ? (i % 4 === 3 ? 120 : 255) : 0)),
      { raw: { width: 16, height: 16, channels: 4 } },
    )
      .webp({ lossless: true, exact: true })
      .toBuffer();
    const rows = async (layer: 'color' | 'ink') => {
      const px = await sharp(await inkImage(half, layer))
        .ensureAlpha()
        .raw()
        .toBuffer();
      return [px[3], px[15 * 16 * 4 + 3]];
    };
    const [colorTop, colorBottom] = await rows('color');
    expect(colorTop).toBe(0);
    expect(colorBottom).toBeGreaterThan(200);
    // The tag page's mask layers keep the original framing.
    const [inkTop, inkBottom] = await rows('ink');
    expect(inkTop).toBeGreaterThan(100);
    expect(inkBottom).toBe(0);
  });

  it('keeps only the largest region of a mask', () => {
    // 6×3: a 2-pixel blob at the left, a 4-pixel blob at the right
    const mask = Uint8Array.from([255, 0, 0, 0, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 0, 0, 0, 0]);
    expect([...keepLargest(mask, 6)]).toEqual([0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 0, 0]);
  });

  it('measures sharpness as Laplacian variance', () => {
    const flat = new Uint8Array(16 * 16).fill(100);
    const stripes = Uint8Array.from({ length: 256 }, (_, i) => (i % 2 ? 0 : 255));
    expect(laplacianVariance(flat, 16, 16)).toBe(0);
    expect(laplacianVariance(stripes, 16, 16)).toBeGreaterThan(1000);
  });
});

const stored = (ink: number) =>
  sharp(
    Buffer.alloc(16 * 16 * 4).map((_, i) => (i % 4 === 3 ? ink : 255)),
    { raw: { width: 16, height: 16, channels: 4 } },
  )
    .webp({ lossless: true, exact: true })
    .toBuffer();
const alpha = async (webp: Buffer) => (await sharp(webp).ensureAlpha().raw().toBuffer())[3];

const url = process.env.TEST_DB_URL;
const ORIGIN = 'https://tag.observe.tw';
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

describe.skipIf(!url)('tag avatar routes (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const as = (who: string | null, write = true) => ({
    ...(who ? { cookie: `tag_session=${who}` } : {}),
    ...(write ? { origin: ORIGIN } : {}),
  });
  const choose = (rank: unknown, headers = as('admin'), tag = '賴清德') =>
    app.inject({ method: 'PUT', url: `/auth/admin/avatars/${encodeURIComponent(tag)}`, headers, payload: { rank } as object });
  const person = async (tag = '賴清德') => (await app.inject({ url: `/api/v1/tags/${encodeURIComponent(tag)}/person` })).json().person;

  beforeAll(async () => {
    if (/\/tag_observe$/.test(url ?? '')) throw Error('TEST_DB_URL points at the production database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    for (const t of ['tag_people', 'tag_avatar_candidates', 'tag_people_log']) await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
    const checkedAt = new Date('2026-10-11T00:00:00Z');
    await db.insert(tagPeople).values([
      {
        tag: '賴清德',
        wikidataId: 'Q3847080',
        label: '賴清德',
        description: '中華民國總統',
        facts: {
          citizenship: ['中華民國'],
          occupations: ['政治人物'],
          parties: ['民主進步黨'],
          positions: [{ label: '中華民國總統', current: true }],
        },
        status: 'auto',
        shownRank: 1,
        checkedAt,
      },
      { tag: '台北', status: 'none', checkedAt },
    ]);
    // Stored avatars: grey = silhouette (all person here), alpha = ink; rank 1 light ink, rank 2 dark ink.
    const images = await Promise.all([60, 200].map(stored));
    await db.insert(tagAvatarCandidates).values(
      [1, 2].map((rank) => ({
        tag: '賴清德',
        rank,
        file: `賴清德 ${rank}.jpg`,
        pageUrl: `https://commons.wikimedia.org/wiki/File:${rank}`,
        license: 'CC BY 4.0',
        licenseUrl: null,
        artist: '總統府',
        score: 0.9 - rank / 10,
        scores: { size: 1 },
        verdict: 'ok',
        image: images[rank - 1],
      })),
    );
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

  it('serves the person, the shown avatar and its attribution', async () => {
    const p = await person();
    expect(p).toMatchObject({ wikidataId: 'Q3847080', avatar: { file: '賴清德 1.jpg', license: 'CC BY 4.0', artist: '總統府' } });
    const img = await app.inject({ url: p.avatar.url });
    expect(img.headers['content-type']).toBe('image/webp');
    expect(await alpha(img.rawPayload)).toBeCloseTo(60, -1);
    // The white paper under the strokes: the person's silhouette.
    const fill = await app.inject({ url: `${p.avatar.url}&layer=fill` });
    expect(await alpha(fill.rawPayload)).toBeCloseTo(255, -1);
    // Both painted, for the home page cloud: an opaque person, strokes tinting the white toward orange.
    const color = await app.inject({ url: `${p.avatar.url}&layer=color` });
    const [r, g, b, a] = await sharp(color.rawPayload).ensureAlpha().raw().toBuffer();
    expect(a).toBeGreaterThan(245);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect((await app.inject({ url: '/api/v1/tag-avatars' })).json().avatars).toEqual({ 賴清德: p.avatar.url });
    expect(await person('台北')).toBeNull();
    expect((await app.inject({ url: `/api/v1/tags/${encodeURIComponent('台北')}/avatar` })).statusCode).toBe(404);
  });

  it('lets only admins switch or hide, from the site itself', async () => {
    expect((await choose(2, as(null))).statusCode).toBe(401);
    expect((await choose(2, as('reader'))).statusCode).toBe(403);
    expect((await choose(2, as('admin', false))).statusCode).toBe(403);
    expect((await choose('2')).statusCode).toBe(400);
    expect((await choose(3)).statusCode).toBe(404);
    expect((await choose(1, as('admin'), '沒這個人')).statusCode).toBe(404);
  });

  it('switches to another candidate, hides, and logs each change', async () => {
    const before = (await person()).avatar.url;
    expect((await choose(2)).json()).toMatchObject({ status: 'chosen', shownRank: 2, reviewedBy: 'admin@example.com' });
    const after = await person();
    expect(after.avatar.file).toBe('賴清德 2.jpg');
    expect(after.avatar.url).not.toBe(before);
    expect(await alpha((await app.inject({ url: after.avatar.url })).rawPayload)).toBeCloseTo(200, -1);

    expect((await choose(null)).json()).toMatchObject({ status: 'hidden', shownRank: null });
    expect((await person()).avatar).toBeNull();
    expect((await app.inject({ url: `/api/v1/tags/${encodeURIComponent('賴清德')}/avatar` })).statusCode).toBe(404);

    const list = (await app.inject({ url: '/auth/admin/avatars?status=hidden', headers: as('admin', false) })).json();
    expect(list.counts).toMatchObject({ hidden: 1, none: 1 });
    expect(list.people[0].candidates.map((c: { rank: number }) => c.rank)).toEqual([1, 2]);
    // admins still see every candidate of a hidden avatar
    const candidate = await app.inject({ url: list.people[0].candidates[0].image, headers: as('admin', false) });
    expect(await alpha(candidate.rawPayload)).toBeCloseTo(60, -1);
    expect((await app.inject({ url: list.people[0].candidates[0].image, headers: as('reader', false) })).statusCode).toBe(403);

    const log = await db.execute(sql`SELECT action, from_rank, to_rank FROM tag_people_log ORDER BY id`);
    expect((log[0] as unknown as object[]).map((r) => Object.values(r))).toEqual([
      ['show', 1, 2],
      ['hide', 2, null],
    ]);
  });
});
