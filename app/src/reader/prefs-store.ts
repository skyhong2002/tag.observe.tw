import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { userPrefs, users } from '../db/schema.ts';
import type { DashboardDocument, DashboardStore } from './live-observe.ts';
import type { Prefs } from './validate.ts';

export async function readAccountPrefs(db: Db, userId: number): Promise<Prefs> {
  const [row] = await db.select({ prefs: userPrefs.prefs }).from(userPrefs).where(eq(userPrefs.userId, userId));
  return (row?.prefs ?? {}) as Prefs;
}

/** Serialize every preference writer on the account, including its first save. */
export async function updateAccountPrefs(db: Db, userId: number, update: (prefs: Prefs) => Prefs | null): Promise<Prefs> {
  return db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    const [row] = await tx.select({ prefs: userPrefs.prefs }).from(userPrefs).where(eq(userPrefs.userId, userId));
    const current = (row?.prefs ?? {}) as Prefs,
      next = update(current);
    if (!next) return current;
    const at = new Date();
    await tx
      .insert(userPrefs)
      .values({ userId, prefs: next, updatedAt: at })
      .onDuplicateKeyUpdate({ set: { prefs: next, updatedAt: at } });
    return next;
  });
}

const documentOf = (prefs: Prefs): DashboardDocument | null => (prefs.liveObserve?.version === 1 ? prefs.liveObserve : null);
export function dashboardPrefsStore(db: Db): DashboardStore {
  return {
    async read(userId) {
      const prefs = await readAccountPrefs(db, userId);
      return { document: documentOf(prefs), legacy: prefs.liveboard ?? null };
    },
    async write(userId, revision, document) {
      let saved = false;
      const prefs = await updateAccountPrefs(db, userId, (current) => {
        if ((documentOf(current)?.revision ?? null) !== revision) return null;
        saved = true;
        return { ...current, liveObserve: document };
      });
      return { saved, document: documentOf(prefs) };
    },
  };
}
