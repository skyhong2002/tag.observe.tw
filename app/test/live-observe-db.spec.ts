import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/client.ts';
import { userPrefs, users } from '../src/db/schema.ts';
import type { DashboardDocument } from '../src/reader/live-observe.ts';
import { dashboardPrefsStore, readAccountPrefs, updateAccountPrefs } from '../src/reader/prefs-store.ts';

const url = process.env.LIVE_SYNC_TEST_DB_URL;
// Own database only; never truncate or alter another suite's fixtures.
describe.skipIf(!url)('dashboard preference concurrency (dedicated MariaDB)', () => {
  let db: Db, close: () => Promise<void>;
  const id = 890001;
  const document = (revision: string, scale: number): DashboardDocument => ({
    version: 1,
    revision,
    updatedAt: new Date().toISOString(),
    settings: { scale },
  });
  beforeAll(async () => {
    const parsed = new URL(url || '');
    if (parsed.hostname !== '127.0.0.1' || parsed.port !== '19306' || !/^\/tag_live_sync_test$/.test(parsed.pathname))
      throw Error('use only the dedicated local sync test database');
    ({ db, close } = createDb(url));
    await migrate(db, { migrationsFolder: 'app/src/db/migrations' });
    const at = new Date();
    await db
      .insert(users)
      .values({ id, googleSub: 'live-sync-test', email: 'live-sync-test@example.invalid', createdAt: at, lastLoginAt: at })
      .onDuplicateKeyUpdate({ set: { lastLoginAt: at } });
    await db.delete(userPrefs).where(eq(userPrefs.userId, id));
  });
  afterAll(async () => {
    if (!db) return;
    await db.delete(userPrefs).where(eq(userPrefs.userId, id));
    await db.delete(users).where(eq(users.id, id));
    await close();
  });
  it('allows only one first writer and preserves independent original-site preferences', async () => {
    const store = dashboardPrefsStore(db);
    const results = await Promise.all([
      store.write(id, null, document('one', 100)),
      store.write(id, null, document('two', 120)),
      updateAccountPrefs(db, id, (current) => ({ ...current, theme: 'dark', history: true })),
    ]);
    const attempts = results.slice(0, 2) as Array<{ saved: boolean; document: DashboardDocument }>;
    expect(attempts.filter((r) => r.saved)).toHaveLength(1);
    const prefs = await readAccountPrefs(db, id);
    expect(prefs.theme).toBe('dark');
    expect(prefs.history).toBe(true);
    expect(prefs.liveObserve?.revision).toBe(attempts.find((r) => r.saved)?.document.revision);
  });
  it('competing devices with the same revision cannot silently overwrite each other', async () => {
    const store = dashboardPrefsStore(db),
      before = await store.read(id);
    const results = await Promise.all([
      store.write(id, before.document!.revision, document('three', 130)),
      store.write(id, before.document!.revision, document('four', 140)),
    ]);
    expect(results.filter((r) => r.saved)).toHaveLength(1);
    expect((await store.read(id)).document?.revision).toBe(results.find((r) => r.saved)?.document?.revision);
    expect((await readAccountPrefs(db, id)).theme).toBe('dark');
  });
});
