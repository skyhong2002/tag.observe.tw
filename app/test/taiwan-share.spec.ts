// Taiwan share corrections (app/src/media-traffic/taiwan-share.ts) against a
// real MariaDB (TEST_DB_URL). Never point TEST_DB_URL at the production
// database: tables are truncated.
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken, type LoginStore } from '../src/auth/google-login.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { parseShare } from '../src/media-traffic/taiwan-share.ts';

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

describe('parseShare', () => {
  it('accepts 0 < share ≤ 1 to four decimals and null to clear', () => {
    expect(parseShare(0.123456)).toBe(0.1235);
    expect(parseShare(1)).toBe(1);
    expect(parseShare(null)).toBeNull();
    for (const bad of [0, -0.1, 1.01, Number.NaN, '0.5', undefined]) expect(parseShare(bad)).toBeUndefined();
  });
});

describe.skipIf(!url)('taiwan share corrections (MariaDB)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const as = (who: string | null, write = true) => ({
    ...(who ? { cookie: `tag_session=${who}` } : {}),
    ...(write ? { origin: ORIGIN } : {}),
  });
  const put = (body: unknown, headers = as('admin'), media = 'udn') =>
    app.inject({ method: 'PUT', url: `/auth/admin/media/${media}/taiwan-share`, headers, payload: body as object });

  beforeAll(async () => {
    if (/\/tag_observe$/.test(url ?? '')) throw Error('TEST_DB_URL points at the production database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    for (const t of ['media_taiwan_shares', 'media_taiwan_share_log']) await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
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

  it('lets only admins write, from the site itself, with a reason', async () => {
    expect((await put({ share: 0.5, note: 'x' }, as(null))).statusCode).toBe(401);
    expect((await put({ share: 0.5, note: 'x' }, as('reader'))).statusCode).toBe(403);
    expect((await put({ share: 0.5, note: 'x' }, as('admin', false))).statusCode).toBe(403);
    expect((await put({ share: 0.5, note: 'x' }, as('admin'), 'no-such-outlet')).statusCode).toBe(404);
    expect((await put({ share: 1.5, note: 'x' })).statusCode).toBe(400);
    expect((await put({ share: 0.5, note: '  ' })).statusCode).toBe(400);
    expect((await put({ share: 0.5, note: 'x'.repeat(256) })).statusCode).toBe(400);
  });

  it('stores, replaces and clears a correction, logging each change', async () => {
    const first = await put({ share: 0.8, note: '小網站樣本太少' });
    expect(first.statusCode).toBe(200);
    expect(first.json().override).toMatchObject({ share: 0.8, note: '小網站樣本太少' });
    expect((await put({ share: 0.75, note: '改用站方數字' })).statusCode).toBe(200);
    const shares = (await app.inject({ url: '/api/v1/media-taiwan-shares' })).json().shares;
    expect(shares).toEqual({ udn: { share: 0.75, note: '改用站方數字', updatedAt: expect.any(String) } });
    expect((await put({ share: null, note: '' })).json()).toEqual({ media: 'udn', override: null });
    expect((await app.inject({ url: '/api/v1/media-taiwan-shares' })).json().shares).toEqual({});
    const detail = (await app.inject({ url: '/auth/admin/media/udn/taiwan-share', headers: as('admin', false) })).json();
    expect(detail.override).toBeNull();
    expect(detail.log.map((row: { before: number | null; after: number | null }) => [row.before, row.after])).toEqual([
      [0.75, null],
      [0.8, 0.75],
      [null, 0.8],
    ]);
    expect(detail.log[0].email).toBe('admin@example.com');
    // Clearing again changes nothing and logs nothing.
    await put({ share: null, note: '' });
    const again = (await app.inject({ url: '/auth/admin/media/udn/taiwan-share', headers: as('admin', false) })).json();
    expect(again.log).toHaveLength(3);
  });
});
