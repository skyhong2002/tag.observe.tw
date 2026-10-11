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
import { tagPeople, tagVisualLog, tagVisuals, tagWikidata } from '../src/db/schema.ts';
import { parseReply, prompt } from '../src/tag-visuals/ai.ts';
import { isEmoji, isIcon, searchIcons } from '../src/tag-visuals/icons.ts';
import { city, country, taiwanPlace } from '../src/tag-visuals/places.ts';
import { DARKEST, LIGHTEST, lightnessMap, oklab, orangeAt, recolourLogo } from '../src/tag-visuals/recolour.ts';
import { aiRow, processTags } from '../src/tag-visuals/run.ts';

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
    const raw = Buffer.alloc(8 * 8 * 4);
    for (let i = 0; i < 64; i++) raw.set(i < 32 ? [0, 128, 0, 255] : [255, 255, 255, i < 48 ? 255 : 0], i * 4);
    const png = await sharp(raw, { raw: { width: 8, height: 8, channels: 4 } })
      .png()
      .toBuffer();
    const out = await sharp(await recolourLogo(png, 8, 8))
      .ensureAlpha()
      .raw()
      .toBuffer();
    const px = (i: number) => [...out.subarray(i * 4, i * 4 + 4)];
    expect(px(0)[0]).toBeGreaterThan(px(0)[2] + 100); // green became orange
    // WebP is lossy: near white.
    for (const c of px(40).slice(0, 3)) expect(c).toBeGreaterThan(235);
    expect(px(60)[3]).toBe(0);
  });
});

describe('AI picks', () => {
  it('keeps only real emoji and known icons', () => {
    expect(isEmoji('🎆')).toBe(true);
    expect(isEmoji('🇹🇼')).toBe(true);
    expect(isEmoji('🎆🎆')).toBe(false);
    expect(isEmoji('火')).toBe(false);
    expect(isIcon('flame')).toBe(true);
    expect(searchIcons('flame')[0]).toBe('flame');
    const picks = parseReply(
      JSON.stringify({
        tags: [
          { tag: '煙火', emoji: '🎆', icon: 'sparkles', same: null, why: '煙火' },
          { tag: '地震', emoji: '地震', icon: 'no-such-icon' },
          { tag: '別的', emoji: '🎆', icon: 'flame' },
        ],
      }),
      ['煙火', '地震'],
    );
    expect(picks.get('煙火')).toEqual({ emoji: '🎆', icon: 'sparkles', same: null, why: '煙火' });
    expect(picks.get('地震')).toEqual({ emoji: null, icon: null, same: null, why: null });
    expect(picks.has('別的')).toBe(false);
    expect(parseReply('not json', ['煙火']).size).toBe(0);
  });

  it('holds picks for review: the emoji when there is one, else the icon', () => {
    expect(aiRow({ emoji: '🎆', icon: 'sparkles', why: '煙火' }, 'm')).toMatchObject({ status: 'review', kind: 'emoji', value: '🎆' });
    expect(aiRow({ emoji: null, icon: 'flame', why: null }, 'm')).toMatchObject({ status: 'review', kind: 'icon', value: 'flame' });
    expect(aiRow(undefined, 'm')).toMatchObject({ status: 'none' });
    expect(aiRow({ emoji: null, icon: 'cpu', why: '晶片' }, 'm', true).note).toBe('Wikidata 項目不符・晶片・AI（m）');
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
    return name ? { id: 1, sub: name, email: accounts[name].email, name, picture: null } : null;
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
    for (const t of ['tag_visuals', 'tag_visual_log', 'tag_people', 'tag_wikidata']) await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
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
          { tag: '煙火', emoji: '🎆', icon: 'sparkles', why: '就是煙火' },
          { tag: '停水', emoji: null, icon: 'droplet-off', why: '供水中斷' },
          { tag: 'MLB', emoji: null, icon: 'trophy', same: true },
          { tag: 'GPU', emoji: null, icon: 'cpu', same: false, why: '顯示晶片' },
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
      status: 'auto' as const,
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
    const tally = await processTags(db, ['台北', '高雄', '煙火', '停水', '賴清德', '某人', 'MLB', 'GPU'], {
      ai: { baseUrl: 'http://ai', apiKey: 'k', model: 'm' },
      fetchImpl: spy,
      itemImpl: async (qid) => logo(qid),
    });
    expect(asked).toEqual(['煙火', '停水', 'MLB', 'GPU']);
    expect(user).toContain('Wikidata 候選：國家政治保衛總局（蘇聯機構）');
    // MLB keeps its logo; GPU's namesake is dropped for the AI's icon, held for review.
    expect(tally).toEqual({ place: 2, emoji: 1, icon: 2, logo: 1 });
    const [gpu] = await db.select().from(tagVisuals).where(eq(tagVisuals.tag, 'GPU'));
    expect(gpu).toMatchObject({ status: 'review', kind: 'icon', value: 'cpu' });
    expect(gpu.note).toContain('Wikidata 項目不符');
    const rows = await db.select({ tag: tagVisuals.tag, status: tagVisuals.status, kind: tagVisuals.kind }).from(tagVisuals);
    expect(rows.map((r) => r.tag).sort()).toEqual(['GPU', 'MLB', '停水', '台北', '煙火', '高雄']);
    // Checked within 30 days: not again.
    expect(await processTags(db, ['台北'], { fetchImpl })).toEqual({});
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

  it('lets admins set an icon or emoji, upload a logo and hide, and logs it', async () => {
    expect((await put('停水', { icon: 'nope' })).statusCode).toBe(400);
    expect((await put('停水', { emoji: '水' })).statusCode).toBe(400);
    expect((await put('停水', { icon: 'droplet' })).statusCode).toBe(200);
    const v = await visual('停水');
    expect(v).toMatchObject({ kind: 'icon', icon: 'droplet' });
    expect((await app.inject({ url: v.image })).body).toContain('stroke="currentColor"');
    const cloud = (await app.inject({ url: '/api/v1/tag-visuals' })).json().visuals['停水'];
    expect(cloud.image).toContain('tone=brand');
    expect((await app.inject({ url: cloud.image })).body).toContain('stroke="#f54900"');
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
    expect((await put('台北', { action: 'hide' })).statusCode).toBe(200);
    expect(await visual('台北')).toBeNull();
    // Re-runs leave hidden and chosen tags alone.
    expect(await processTags(db, ['台北'])).toEqual({});
    const log = await db.select({ tag: tagVisualLog.tag, action: tagVisualLog.action }).from(tagVisualLog);
    expect(log.map((l) => `${l.tag} ${l.action}`).sort()).toEqual(['停水 icon', '台北 hide', '某公司 upload', '煙火 confirm']);
    const list = (await app.inject({ url: '/auth/admin/tag-visuals?status=chosen', headers: as('admin', false) })).json();
    expect(list.visuals.map((r: { tag: string }) => r.tag).sort()).toEqual(['停水', '某公司', '煙火']);
    const one = (
      await app.inject({ url: `/auth/admin/tag-visuals?tag=${encodeURIComponent('沒有的')}`, headers: as('admin', false) })
    ).json();
    expect(one.visuals).toEqual([{ tag: '沒有的', kind: null, status: null, image: null, large: null }]);
  });
});
