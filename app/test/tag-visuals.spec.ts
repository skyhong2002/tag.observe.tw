// Tag visuals (docs/tag-visuals.md): place matching, the one-hue logo
// recolouring and the AI reply rules, then the run, the public and the admin
// routes against a real MariaDB (TEST_DB_URL). Never point TEST_DB_URL at
// the production database: tables are truncated.
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken, type LoginStore } from '../src/auth/google-login.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { tagPeople, tagPictureVotes, tagVisualCandidates, tagVisualLog, tagVisuals, tagWikidata } from '../src/db/schema.ts';
import { leader } from '../src/pictures/votes.ts';
import { parseReply, prompt } from '../src/tag-visuals/ai.ts';
import { isEmoji } from '../src/tag-visuals/emoji.ts';
import { city, country, taiwanPlace } from '../src/tag-visuals/places.ts';
import { DARKEST, LIGHTEST, lightnessMap, oklab, orangeAt, recolourLogo } from '../src/tag-visuals/recolour.ts';
import { arrange, processTags } from '../src/tag-visuals/run.ts';

describe('places', () => {
  it('finds counties with or without 縣/市, townships only by full name', () => {
    expect(taiwanPlace('台北')).toMatchObject({ value: 'tw-county:63000', label: '台北市' });
    expect(taiwanPlace('臺北市')?.value).toBe('tw-county:63000');
    expect(taiwanPlace('花蓮')?.label).toBe('花蓮縣');
    expect(taiwanPlace('員山鄉')).toMatchObject({ label: '宜蘭縣員山鄉' });
    // 「恆春」 is also a Qing official; a bare township name is too risky.
    expect(taiwanPlace('恆春')).toBeNull();
    // Both a county and a city; several 信義區.
    expect(taiwanPlace('新竹')).toBeNull();
    expect(taiwanPlace('信義區')).toBeNull();
    expect(taiwanPlace('新竹市')?.label).toBe('新竹市');
  });

  it('draws white shapes with the orange line', () => {
    const p = taiwanPlace('高雄') as NonNullable<ReturnType<typeof taiwanPlace>>;
    expect(p.image).toMatch(/^<svg [^>]*viewBox="0 0 160 160"/);
    expect(p.image).toContain('fill="#fff" stroke="#f54900"');
    // Where it is: Taiwan faint, 高雄 filled.
    expect(p.large).toContain('stroke-opacity=".45"');
    expect(p.large).toContain('fill="#f54900"');
    expect(country('392', '日本')?.value).toBe('country:392');
    expect(country('999', '?')).toBeNull();
    const moscow = city('Q649', '莫斯科', [37.6, 55.75], '643');
    expect(moscow.image).toContain('<circle');
    expect(moscow.value).toBe('city:Q649');
  });
});

describe('one-hue logos', () => {
  const hue = ([r, g, b]: number[]) => {
    const [, a, bb] = oklab(r, g, b);
    return Math.atan2(bb, a);
  };

  it('keeps every shade on the brand hue, from a little darker than the brand to near white', () => {
    const brand = hue([245, 73, 0]);
    for (const L of [DARKEST, 0.75, 0.9]) expect(hue(orangeAt(L))).toBeCloseTo(brand, 1);
    expect(oklab(...orangeAt(DARKEST))[0]).toBeCloseTo(DARKEST, 2);
    expect(oklab(...orangeAt(DARKEST))[0]).toBeLessThan(oklab(245, 73, 0)[0]);
  });

  it('stretches the logo’s own lightness range and keeps white white', () => {
    // navy, red, white (MLB): two distinct oranges and white.
    const [navy, red, white] = [oklab(0, 45, 98)[0], oklab(200, 16, 46)[0], 1];
    const map = lightnessMap([navy, navy, red, red, white, white]);
    expect(map(navy)).toBeCloseTo(DARKEST, 5);
    expect(map(red)).toBeGreaterThan(map(navy) + 0.1);
    expect(map(red)).toBeLessThan(LIGHTEST);
    expect(map(white)).toBe(1);
    // One colour: all the darkest orange.
    expect(lightnessMap([0.3, 0.3, 0.31])(0.3)).toBeCloseTo(DARKEST, 5);
  });

  it('recolours an image, keeping its alpha', async () => {
    // 10×10, transparent round a 6×6 logo: green top half, white bottom half.
    const raw = Buffer.alloc(10 * 10 * 4);
    for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) raw.set(y < 5 ? [0, 128, 0, 255] : [255, 255, 255, 255], (y * 10 + x) * 4);
    const png = await sharp(raw, { raw: { width: 10, height: 10, channels: 4 } })
      .png()
      .toBuffer();
    const out = await sharp(await recolourLogo(png, 64, 64))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width } = out.info;
    const px = (x: number, y: number) => [...out.data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)];
    expect(px(width >> 1, 8)[0]).toBeGreaterThan(px(width >> 1, 8)[2] + 100); // green became orange
    // WebP is lossy: near white.
    for (const c of px(width >> 1, out.info.height - 8).slice(0, 3)) expect(c).toBeGreaterThan(235);
  });
});

describe('logo cut-out', () => {
  it('takes a solid background off, keeps white walled inside the emblem, and trims the margin', async () => {
    // A 200×200 white square, an orange ring (r 40–60) round a white centre, at the middle.
    const size = 200;
    const raw = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const r = Math.hypot(x - 100, y - 100);
        raw.set(r >= 40 && r <= 60 ? [220, 80, 20, 255] : [255, 255, 255, 255], (y * size + x) * 4);
      }
    const png = await sharp(raw, { raw: { width: size, height: size, channels: 4 } })
      .png()
      .toBuffer();
    const out = await sharp(await recolourLogo(png, 512, 192))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = out.info;
    // Trimmed to the ring (120 px across, plus 2%), then fitted to 192 px high.
    expect(width).toBe(height);
    expect(height).toBe(192);
    const at = (x: number, y: number) => out.data[(Math.round(y) * width + Math.round(x)) * 4 + 3];
    expect(at(1, 1)).toBe(0); // the old white corner is gone
    expect(at(width / 2, height / 2)).toBeGreaterThan(240); // the white centre stays
    expect(at(width / 2, height * 0.08)).toBeGreaterThan(240); // the ring
    // A logo already transparent round the edge is left as it is.
    const clear = await sharp({ create: { width: 40, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: { create: { width: 20, height: 10, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }, left: 10, top: 5 },
      ])
      .png()
      .toBuffer();
    const trimmed = await sharp(await recolourLogo(clear, 512, 192)).metadata();
    expect((trimmed.width ?? 0) / (trimmed.height ?? 1)).toBeCloseTo(2, 0);
  });
});

describe('AI picks', () => {
  it('keeps only real emoji', () => {
    expect(isEmoji('🎆')).toBe(true);
    expect(isEmoji('🇹🇼')).toBe(true);
    expect(isEmoji('🎆🎆')).toBe(false);
    expect(isEmoji('火')).toBe(false);
    const picks = parseReply(
      JSON.stringify({
        tags: [
          { tag: '煙火', emoji: '🎆', same: null, why: '煙火' },
          { tag: '地震', emoji: '地震' },
          { tag: 'GPU', emoji: null, same: false },
          { tag: '別的', emoji: '🎆' },
        ],
      }),
      ['煙火', '地震', 'GPU'],
    );
    expect(picks.get('煙火')).toEqual({ emoji: '🎆', same: null, why: '煙火' });
    expect(picks.get('地震')).toEqual({ emoji: null, same: null, why: null });
    expect(picks.get('GPU')?.same).toBe(false);
    expect(picks.has('別的')).toBe(false);
    expect(parseReply('not json', ['煙火']).size).toBe(0);
  });

  it('orders candidates: an agreed item first, else the emoji and a doubtful item last', () => {
    const kinds = (a: ReturnType<typeof arrange>) => a.candidates.map((c) => `${c.kind} ${c.value}`);
    const fireworks = arrange({ emoji: '🎆', same: null, why: '煙火' }, 'm', null);
    expect(fireworks.status).toBe('review');
    expect(kinds(fireworks)).toEqual(['emoji 🎆']);
    expect(fireworks.candidates[0].note).toBe('煙火・AI（m）');
    expect(arrange(undefined, 'm', null).candidates).toEqual([]);
    const item = { kind: 'logo' as const, value: 'GPU.svg', note: 'Wikidata：GPU' };
    const agreed = arrange({ emoji: '💻', same: true, why: null }, 'm', item);
    expect([agreed.status, ...kinds(agreed)]).toEqual(['auto', 'logo GPU.svg', 'emoji 💻']);
    const doubtful = arrange({ emoji: '💻', same: false, why: '晶片' }, 'm', item);
    expect([doubtful.status, ...kinds(doubtful)]).toEqual(['review', 'emoji 💻', 'logo GPU.svg']);
    expect(doubtful.candidates[1].note).toBe('Wikidata 項目不符・Wikidata：GPU');
    // The candidate goes into the prompt.
    expect(prompt([{ tag: 'GPU', titles: ['輝達 GPU 出貨'], candidate: '國家政治保衛總局（蘇聯機構）' }])[1].content).toContain(
      'Wikidata 候選：國家政治保衛總局（蘇聯機構）',
    );
  });
});

const url = process.env.TEST_DB_URL;
const ORIGIN = 'https://tag.observe.tw';
const accounts: Record<string, { email: string }> = { admin: { email: 'admin@example.com' }, reader: { email: 'reader@example.com' } };
const store: LoginStore = {
  upsertUser: async () => 1,
  createSession: async () => {},
  deleteSession: async () => {},
  listUsers: async () => [],
  setAdmin: async () => false,
  sessionUser: async (hash) => {
    const name = Object.keys(accounts).find((key) => hashToken(key) === hash);
    return name ? { id: name === 'admin' ? 1 : 2, sub: name, email: accounts[name].email, name, picture: null } : null;
  },
};

describe.skipIf(!url)('tag visual run and routes (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const as = (who: string | null, write = true) => ({
    ...(who ? { cookie: `tag_session=${who}` } : {}),
    ...(write ? { origin: ORIGIN } : {}),
  });
  const visual = async (tag: string) => (await app.inject({ url: `/api/v1/tags/${encodeURIComponent(tag)}/visual` })).json().visual;
  const put = (tag: string, body: object, headers = as('admin')) =>
    app.inject({ method: 'PUT', url: `/auth/admin/tag-visuals/${encodeURIComponent(tag)}`, headers, payload: body });

  beforeAll(async () => {
    if (/\/tag_observe$/.test(url ?? '')) throw Error('TEST_DB_URL points at the production database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    for (const t of ['tag_visuals', 'tag_visual_candidates', 'tag_visual_log', 'tag_people', 'tag_wikidata', 'tag_picture_votes'])
      await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
    const at = new Date('2026-10-11T00:00:00Z');
    await db.insert(tagPeople).values({ tag: '賴清德', wikidataId: 'Q3847080', status: 'auto', checkedAt: at });
    await db.insert(tagWikidata).values([
      { tag: '某人', wikidataId: 'Q1', types: [{ id: 'Q5', label: '人類' }], checkedAt: at },
      // A namesake actor: the county still wins.
      { tag: '高雄', wikidataId: 'Q5336671', types: [{ id: 'Q5', label: '人類' }], checkedAt: at },
      // Items with a logo: one the news means, one a namesake.
      { tag: 'MLB', wikidataId: 'Q1163715', label: '美國職業棒球大聯盟', description: '職業棒球聯盟', types: [], checkedAt: at },
      { tag: 'GPU', wikidataId: 'Q213213', label: '國家政治保衛總局', description: '蘇聯機構', types: [], checkedAt: at },
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
    await close?.();
  });

  it('draws places, holds AI picks for review and skips people', async () => {
    let asked: string[] = [];
    const fetchImpl = (async (_u: string, init: { body: string }) => {
      const user = JSON.parse(init.body).messages[1].content as string;
      asked = [...user.matchAll(/標籤：(\S+)/g)].map((m) => m[1]);
      const content = JSON.stringify({
        tags: [
          { tag: '煙火', emoji: '🎆', why: '就是煙火' },
          { tag: '停水', emoji: null, why: '沒有完全對到的' },
          { tag: 'MLB', emoji: '⚾', same: true },
          { tag: 'GPU', emoji: null, same: false, why: '顯示晶片' },
          { tag: '鴻海', emoji: null, same: true },
        ],
      });
      return new Response(JSON.stringify({ model: 'test-model', choices: [{ message: { content } }] }));
    }) as unknown as typeof fetch;
    let user = '';
    const spy = (async (u: string, init: { body: string }) => {
      user = JSON.parse(init.body).messages[1].content;
      return fetchImpl(u, init as RequestInit);
    }) as unknown as typeof fetch;
    const logo = (qid: string) => ({
      kind: 'logo' as const,
      value: `${qid}.svg`,
      label: qid,
      wikidataId: qid,
      image: Buffer.from('x'),
      pageUrl: `https://commons.wikimedia.org/wiki/File:${qid}.svg`,
      license: null,
      licenseUrl: null,
      artist: null,
    });
    // No item is exactly 「鴻海」; one whose name contains it is; 煙火 and 停水 match nothing.
    const looseImpl = async (tag: string) =>
      tag === '鴻海' ? [{ qid: 'Q463094', label: '鴻海精密工業', description: '台灣電子代工企業' }] : [];
    const tally = await processTags(db, ['台北', '高雄', '煙火', '停水', '賴清德', '某人', 'MLB', 'GPU', '鴻海'], {
      ai: { baseUrl: 'http://ai', apiKey: 'k', model: 'm' },
      fetchImpl: spy,
      itemImpl: async (qid) => logo(qid),
      findImpl: async () => null,
      looseImpl,
    });
    expect(asked).toEqual(['煙火', '停水', 'MLB', 'GPU', '鴻海']);
    expect(user).toContain('Wikidata 候選：國家政治保衛總局（蘇聯機構）');
    expect(user).toContain('Wikidata 候選：鴻海精密工業（台灣電子代工企業）');
    // MLB keeps its logo (its emoji next); GPU's namesake waits for an admin who knows better; 停水 has nothing;
    // 鴻海 gets the logo of the item whose name contains it, once the AI agrees.
    expect(tally).toEqual({ place: 2, emoji: 1, logo: 3, none: 1 });
    const [hon] = await db.select().from(tagVisuals).where(eq(tagVisuals.tag, '鴻海'));
    expect(hon).toMatchObject({ status: 'auto', kind: 'logo', wikidataId: 'Q463094' });
    expect(hon.note).toContain('名稱相近');
    const [gpu] = await db.select().from(tagVisuals).where(eq(tagVisuals.tag, 'GPU'));
    expect(gpu).toMatchObject({ status: 'review', kind: 'logo', shownRank: 1 });
    expect(gpu.note).toContain('Wikidata 項目不符');
    const mlb = await db.select().from(tagVisualCandidates).where(eq(tagVisualCandidates.tag, 'MLB'));
    expect(mlb.map((c) => `${c.rank} ${c.kind}`)).toEqual(['1 logo', '2 emoji']);
    const [dry] = await db.select().from(tagVisuals).where(eq(tagVisuals.tag, '停水'));
    expect(dry).toMatchObject({ status: 'none', kind: null });
    // Tags the tag-groups job had not looked up are looked up and kept.
    const [looked] = await db.select().from(tagWikidata).where(eq(tagWikidata.tag, '煙火'));
    expect(looked).toMatchObject({ wikidataId: null });
    const rows = await db.select({ tag: tagVisuals.tag, status: tagVisuals.status, kind: tagVisuals.kind }).from(tagVisuals);
    expect(rows.map((r) => r.tag).sort()).toEqual(['GPU', 'MLB', '停水', '台北', '煙火', '高雄', '鴻海']);
    // Checked within 30 days: not again.
    expect(await processTags(db, ['台北'], { fetchImpl, findImpl: async () => null, looseImpl })).toEqual({});
  });

  it('serves places; AI picks only after an admin confirms', async () => {
    const v = await visual('台北');
    expect(v).toMatchObject({ kind: 'place', label: '台北市' });
    const img = await app.inject({ url: v.image });
    expect(img.headers['content-type']).toBe('image/svg+xml');
    expect(img.body).toContain('<svg');
    expect((await app.inject({ url: v.large })).statusCode).toBe(200);
    expect(await visual('煙火')).toBeNull();
    expect((await app.inject({ url: '/api/v1/tags/%E7%85%99%E7%81%AB/visual-image' })).statusCode).toBe(404);
    expect((await put('煙火', { action: 'confirm' }, as('reader'))).statusCode).toBe(403);
    expect((await put('煙火', { action: 'confirm' }, as('admin', false))).statusCode).toBe(403);
    expect((await put('煙火', { action: 'confirm' })).statusCode).toBe(200);
    expect(await visual('煙火')).toMatchObject({ kind: 'emoji', emoji: '🎆', image: null });
    // The home cloud's list: Taiwan places as where they are, emoji as themselves; review picks left out.
    const all = (await app.inject({ url: '/api/v1/tag-visuals' })).json().visuals;
    expect(all['台北'].image).toContain('size=large');
    expect(all['煙火']).toEqual({ kind: 'emoji', image: null, emoji: '🎆' });
    expect(all['停水']).toBeUndefined();
  });

  it('lets admins pick a candidate, set an emoji, upload a logo and hide, and logs it', async () => {
    // Picking a candidate shows it.
    expect((await put('MLB', { rank: 9 })).statusCode).toBe(404);
    expect((await put('MLB', { rank: 2 })).statusCode).toBe(200);
    expect(await visual('MLB')).toMatchObject({ kind: 'emoji', emoji: '⚾' });
    const page = (await app.inject({ url: '/auth/admin/tag-visuals?status=chosen&kind=emoji', headers: as('admin', false) })).json();
    const row = page.visuals.find((r: { tag: string }) => r.tag === 'MLB');
    expect(row.shownRank).toBe(2);
    expect(row.candidates.map((c: { kind: string }) => c.kind)).toEqual(['logo', 'emoji']);
    expect(page.kinds).toMatchObject({ emoji: 2 });
    // The admin's own emoji where nothing fit.
    expect((await put('停水', { emoji: '水' })).statusCode).toBe(400);
    expect((await put('停水', { icon: 'droplet' })).statusCode).toBe(400);
    expect((await put('停水', { emoji: '💧' })).statusCode).toBe(200);
    expect(await visual('停水')).toMatchObject({ kind: 'emoji', emoji: '💧' });
    expect((await app.inject({ url: '/api/v1/tag-visuals' })).json().visuals['停水']).toEqual({ kind: 'emoji', image: null, emoji: '💧' });
    // A tag with no row yet.
    const png = await sharp({ create: { width: 20, height: 10, channels: 4, background: { r: 0, g: 0, b: 200, alpha: 1 } } })
      .png()
      .toBuffer();
    const up = await app.inject({
      method: 'POST',
      url: `/auth/admin/tag-visuals/${encodeURIComponent('某公司')}/logo`,
      headers: as('admin'),
      payload: { image: png.toString('base64') },
    });
    expect(up.statusCode).toBe(200);
    const logo = await visual('某公司');
    expect(logo).toMatchObject({ kind: 'logo', source: null });
    expect((await app.inject({ url: logo.image })).headers['content-type']).toBe('image/webp');
    // A 2:1 logo tells the cloud its shape.
    expect((await app.inject({ url: '/api/v1/tag-visuals' })).json().visuals['某公司'].aspect).toBeCloseTo(2, 1);
    expect((await put('台北', { action: 'hide' })).statusCode).toBe(200);
    expect(await visual('台北')).toBeNull();
    // Re-runs leave hidden and chosen tags alone.
    expect(await processTags(db, ['台北'], { findImpl: async () => null, looseImpl: async () => [] })).toEqual({});
    const log = await db.select({ tag: tagVisualLog.tag, action: tagVisualLog.action }).from(tagVisualLog);
    expect(log.map((l) => `${l.tag} ${l.action}`).sort()).toEqual(['MLB pick', '停水 emoji', '台北 hide', '某公司 upload', '煙火 confirm']);
    const list = (await app.inject({ url: '/auth/admin/tag-visuals?status=chosen', headers: as('admin', false) })).json();
    expect(list.visuals.map((r: { tag: string }) => r.tag).sort()).toEqual(['MLB', '停水', '某公司', '煙火']);
    const one = (
      await app.inject({ url: `/auth/admin/tag-visuals?tag=${encodeURIComponent('沒有的')}`, headers: as('admin', false) })
    ).json();
    expect(one.visuals).toEqual([{ tag: '沒有的', kind: null, status: null, image: null, large: null, candidates: [] }]);
  });

  it('lets any signed-in reader upload and vote; the most votes win unless an admin locks', async () => {
    const path = (tag: string, rest = '') => `/auth/pictures/${encodeURIComponent(tag)}${rest}`;
    const state = async (tag: string, who = 'reader') => (await app.inject({ url: path(tag), headers: as(who, false) })).json();
    const png = await sharp({ create: { width: 30, height: 10, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } })
      .png()
      .toBuffer();
    const upload = (tag: string, who: string, agree = true) =>
      app.inject({ method: 'POST', url: path(tag, '/upload'), headers: as(who), payload: { image: png.toString('base64'), agree } });
    expect((await app.inject({ url: path('台股') })).statusCode).toBe(401);
    expect((await upload('台股', 'reader', false)).statusCode).toBe(400);
    // A tag with no picture at all: the reader's upload is its vote, so it shows at once.
    const up = await upload('台股', 'reader');
    expect(up.statusCode).toBe(200);
    expect(up.json()).toMatchObject({ kind: 'visual', rank: 1 });
    expect(await visual('台股')).toMatchObject({ kind: 'logo' });
    let s = await state('台股');
    expect(s).toMatchObject({ kind: 'visual', shownRank: 1, myVote: 1, locked: false, uploadsLeft: 19 });
    expect(s.candidates[0]).toMatchObject({ rank: 1, votes: 1, uploaded: true, mine: true });
    // A second upload by the admin as a reader, then the vote moves with the majority; a tie keeps what is shown.
    expect((await upload('台股', 'admin')).json().rank).toBe(2);
    s = await state('台股');
    expect(s.shownRank).toBe(1);
    const vote = (who: string, rank: number | null) =>
      app.inject({ method: 'PUT', url: path('台股', '/vote'), headers: as(who), payload: { rank } });
    expect((await vote('reader', 2)).json().shownRank).toBe(2);
    expect((await vote('reader', 9)).statusCode).toBe(404);
    // Admin lock: votes still count, the picture stays; unlock goes back to the votes.
    const lock = (rank: number | null, who = 'admin') =>
      app.inject({ method: 'PUT', url: path('台股', '/lock'), headers: as(who), payload: { rank } });
    expect((await lock(1, 'reader')).statusCode).toBe(403);
    expect((await lock(1)).statusCode).toBe(200);
    expect((await vote('reader', 2)).json().shownRank).toBe(1);
    expect(await state('台股')).toMatchObject({ locked: true, shownRank: 1 });
    expect((await lock(null)).json().shownRank).toBe(2);
    const votes = await db.select().from(tagPictureVotes).where(eq(tagPictureVotes.tag, '台股'));
    expect(votes.map((v) => v.rank).sort()).toEqual([2, 2]);
    // Re-runs leave a voted tag alone.
    expect(await processTags(db, ['台股'], { findImpl: async () => null, looseImpl: async () => [] })).toEqual({});
    // Candidate images for signed-in readers only.
    expect((await app.inject({ url: s.candidates[0].image, headers: as('reader', false) })).headers['content-type']).toBe('image/webp');
    expect((await app.inject({ url: s.candidates[0].image })).statusCode).toBe(401);
  });

  it('picks the most votes, a tie keeping what is shown', () => {
    expect(leader(new Map(), 1)).toBeNull();
    expect(leader(new Map([[1, 0]]), 1)).toBeNull();
    expect(
      leader(
        new Map([
          [1, 1],
          [2, 2],
        ]),
        1,
      ),
    ).toBe(2);
    expect(
      leader(
        new Map([
          [1, 2],
          [2, 2],
        ]),
        2,
      ),
    ).toBe(2);
    expect(
      leader(
        new Map([
          [3, 2],
          [2, 2],
        ]),
        1,
      ),
    ).toBe(2);
  });
});
