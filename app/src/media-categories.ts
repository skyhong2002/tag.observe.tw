import { asc, count } from 'drizzle-orm';
import catalog from '../data/media-catalog.json' with { type: 'json' };
import type { Db } from './db/client.ts';
import { mediaCategoryDefs, mediaCategories as memberTable } from './db/schema.ts';

// Media labels (藍營、綠營、新聞、非主流…). Admins edit them at /admin/media/
// (app/src/admin/routes.ts), so they live in the DB; media-catalog.json only
// seeds an empty DB. Readers are synchronous, so each process (gateway,
// worker) keeps a snapshot here and refreshes it from the DB every minute and
// after every admin write. Until the first refresh the snapshot is the seed.

export const SEED_LABELS: Record<string, string> = {
  news: '新聞媒體',
  '3c': '科技與 3C',
  women: '女性網站',
  alt: '非主流媒體',
  finance: '財經',
  style: '風格',
  movie: '影視',
  health: '健康',
  sports: '運動',
  travel: '旅遊',
  notag: '無標籤媒體',
  game: '遊戲',
  adct: '專題',
  blue: '藍營傾向媒體',
  green: '綠營傾向媒體',
};
const ALL_LABEL = '所有媒體';

export type CategoryDef = { key: string; label: string; sort: number };
type Snapshot = { defs: CategoryDef[]; members: Record<string, string[]>; labels: Map<string, string> };

function snapshotOf(defs: CategoryDef[], pairs: Array<{ media: string; category: string }>): Snapshot {
  const members: Record<string, string[]> = Object.fromEntries(defs.map((d) => [d.key, []]));
  for (const { media, category } of pairs) (members[category] ??= []).push(media);
  return { defs, members, labels: new Map(defs.map((d) => [d.key, d.label])) };
}

const seedCategories = catalog.categories as Record<string, string[]>;
const seedDefs = (): CategoryDef[] => Object.keys(seedCategories).map((key, i) => ({ key, label: SEED_LABELS[key] ?? key, sort: i }));
const seedPairs = () => Object.entries(seedCategories).flatMap(([category, list]) => list.map((media) => ({ media, category })));

let snapshot = snapshotOf(seedDefs(), seedPairs());

/** Category key → member media, including labels nobody carries yet. */
export const mediaCategories = (): Record<string, string[]> => snapshot.members;
export const categoryDefs = (): CategoryDef[] => snapshot.defs;
export const categoryLabel = (key: string) => (key === 'all' ? ALL_LABEL : (snapshot.labels.get(key) ?? key));
export const categoriesOf = (media: string) => snapshot.defs.filter((d) => snapshot.members[d.key]?.includes(media)).map((d) => d.key);

/** `all` plus every label that has at least one outlet: the keys accepted
 *  by /api/v1/ranking, /api/v1/articles and the ranking/events jobs. */
export function rankingCategories(): Record<string, { media: string[] }> {
  const entries = snapshot.defs.filter((d) => snapshot.members[d.key]?.length).map((d) => [d.key, { media: snapshot.members[d.key] }]);
  return { all: { media: [...new Set(entries.flatMap(([, v]) => (v as { media: string[] }).media))] }, ...Object.fromEntries(entries) };
}

/** Seeds empty tables from media-catalog.json (INSERT IGNORE, so the gateway
 *  and worker can race), then reloads the snapshot. */
export async function refreshMediaCategories(db: Db) {
  const [{ n }] = await db.select({ n: count() }).from(mediaCategoryDefs);
  if (!n) {
    const now = new Date();
    await db
      .insert(mediaCategoryDefs)
      .ignore()
      .values(seedDefs().map((d) => ({ ...d, createdAt: now })));
    const pairs = seedPairs();
    for (let i = 0; i < pairs.length; i += 500)
      await db
        .insert(memberTable)
        .ignore()
        .values(pairs.slice(i, i + 500));
  }
  const [defs, pairs] = await Promise.all([
    db
      .select({ key: mediaCategoryDefs.key, label: mediaCategoryDefs.label, sort: mediaCategoryDefs.sort })
      .from(mediaCategoryDefs)
      .orderBy(asc(mediaCategoryDefs.sort), asc(mediaCategoryDefs.key)),
    db.select({ media: memberTable.media, category: memberTable.category }).from(memberTable).orderBy(asc(memberTable.media)),
  ]);
  snapshot = snapshotOf(defs, pairs);
}

/** Refresh now and then every `everyMs`; failures keep the last snapshot. */
export function keepMediaCategoriesFresh(db: Db, { everyMs = 60e3, warn = (_err: unknown) => {} } = {}) {
  const tick = () => refreshMediaCategories(db).catch(warn);
  const timer = setInterval(tick, everyMs);
  timer.unref();
  return { ready: tick(), stop: () => clearInterval(timer) };
}
