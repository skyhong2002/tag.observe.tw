import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import catalog from '../../data/media-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, articleTags, eventSnapshots, events, eventThreads } from '../db/schema.ts';
import { type Camp, campOf } from './coverage.ts';

const categories = catalog.categories as Record<string, string[]>;

// Extra signal for the hourly event table: how widely each event is being
// reported (outlets and camps, with blind spots), how it moved since the
// previous snapshot, and how long its thread has been running. The full
// per-outlet headline comparison stays on /events/threads/:id/coverage.

const HOUR = 3600e3;

export interface EventFeedCoverage {
  outlets: Array<{ media: string; camp: Camp }>;
  articles: number;
  camps: Record<Camp, number>;
  /** Blue/green split of the outlets on the story, 其他 excluded; null when neither wrote. */
  share: { blue: number; green: number } | null;
  /** log2 of blue-vs-green outlet ratio against the day's baseline: 0 is the
   *  usual split, +1 is twice the usual blue weight, -1 twice the green. */
  lean: number | null;
  /** Camp that wrote noticeably more than usual (|lean| >= 1 with enough outlets). */
  tilt: Camp | null;
  /** Ground.news-style blind spot: the camp that barely reported a story the
   *  other camp is on. "blue" means blue-leaning readers are not seeing it. */
  blindspot: Camp[];
}

/** The day's share of each camp, for judging whether an event's split is
 *  unusual. Outlets are those that published anything in the window. */
export interface CampBaseline {
  outlets: Record<Camp, number>;
  articles: Record<Camp, number>;
}

// Blind spot thresholds adapted from Ground.news (fewer than N sources on one
// side while the other side is clearly on it), scaled to a two-camp landscape
// with a dozen outlets each.
const BLINDSPOT_MAX_OUTLETS = 1;
const BLINDSPOT_MIN_OTHER_SIDE = 4;
const TILT_MIN_OUTLETS = 5;
const TILT_MIN_LEAN = 0.8;

export function campLean(camps: Record<Camp, number>, base: CampBaseline | null): number | null {
  if (camps.blue + camps.green === 0) return null;
  const bb = base?.outlets.blue || 1,
    bg = base?.outlets.green || 1;
  // +0.5 smoothing keeps a zero on one side finite and small samples modest.
  return Math.log2(((camps.blue + 0.5) / bb) * (bg / (camps.green + 0.5)));
}

/** Outlets that carry at least one of each event's major tags, from one
 *  shared article set. `articles` is an upper bound (an article with two of
 *  the event's tags is counted once per tag). */
export function groupFeedCoverage(
  rows: Array<{ articleId: number; media: string; tag: string }>,
  majors: ReadonlyArray<readonly string[]>,
  base: CampBaseline | null = null,
  cats?: Record<string, string[]>,
): EventFeedCoverage[] {
  const byTag = new Map<string, Array<{ articleId: number; media: string }>>();
  for (const r of rows) byTag.set(r.tag, [...(byTag.get(r.tag) ?? []), r]);
  return majors.map((major) => {
    const seen = new Set<number>();
    const perOutlet = new Map<string, number>();
    for (const tag of major) {
      for (const r of byTag.get(tag) ?? []) {
        if (seen.has(r.articleId)) continue;
        seen.add(r.articleId);
        perOutlet.set(r.media, (perOutlet.get(r.media) ?? 0) + 1);
      }
    }
    const camps: Record<Camp, number> = { blue: 0, green: 0, other: 0 };
    const outlets = [...perOutlet.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([media]) => ({ media, camp: campOf(media, cats) }));
    for (const o of outlets) camps[o.camp] += 1;
    const sides = camps.blue + camps.green;
    const share = sides ? { blue: Math.round((camps.blue / sides) * 100), green: Math.round((camps.green / sides) * 100) } : null;
    const lean = campLean(camps, base);
    const tilt: Camp | null =
      lean !== null && sides >= TILT_MIN_OUTLETS && Math.abs(lean) >= TILT_MIN_LEAN ? (lean > 0 ? 'blue' : 'green') : null;
    const blindspot: Camp[] = [];
    if (camps.blue <= BLINDSPOT_MAX_OUTLETS && camps.green >= BLINDSPOT_MIN_OTHER_SIDE) blindspot.push('blue');
    if (camps.green <= BLINDSPOT_MAX_OUTLETS && camps.blue >= BLINDSPOT_MIN_OTHER_SIDE) blindspot.push('green');
    return { outlets, articles: seen.size, camps, share, lean, tilt, blindspot };
  });
}

const EMPTY: EventFeedCoverage = {
  outlets: [],
  articles: 0,
  camps: { blue: 0, green: 0, other: 0 },
  share: null,
  lean: null,
  tilt: null,
  blindspot: [],
};
const window = (hour: Date) => ({ from: new Date(hour.getTime() - 24 * HOUR), to: new Date(hour.getTime() + HOUR) });

/** Every outlet's article count in the event window, folded into camps. 其他
 *  is limited to the news outlets the rankings use, as on the home page. */
export async function campBaseline(db: Db, hour: Date, cats: Record<string, string[]> = categories): Promise<CampBaseline> {
  const { from, to } = window(hour);
  return campBaselineBetween(db, from, to, cats);
}

/** campBaseline over an arbitrary window, e.g. one archived day. */
export async function campBaselineBetween(
  db: Db,
  from: Date,
  to: Date,
  cats: Record<string, string[]> = categories,
): Promise<CampBaseline> {
  const rows = await db
    .select({ media: articles.media, n: sql<number>`count(*)` })
    .from(articles)
    .where(and(gte(articles.publishedAt, from), lte(articles.publishedAt, to)))
    .groupBy(articles.media);
  return foldBaseline(rows, cats);
}

export function foldBaseline(rows: Array<{ media: string; n: number }>, cats: Record<string, string[]> = categories): CampBaseline {
  const out: CampBaseline = { outlets: { blue: 0, green: 0, other: 0 }, articles: { blue: 0, green: 0, other: 0 } };
  const news = new Set(cats.news ?? []);
  for (const r of rows) {
    const camp = campOf(r.media, cats);
    if (camp === 'other' && !news.has(r.media)) continue;
    out.outlets[camp] += 1;
    out.articles[camp] += Number(r.n);
  }
  return out;
}

/** Coverage for every event of one snapshot hour. Events cluster the previous
 *  24h of reports, so that is the window. */
export async function feedCoverage(
  db: Db,
  hour: Date,
  majors: ReadonlyArray<readonly string[]>,
  base: CampBaseline | null,
): Promise<EventFeedCoverage[]> {
  const { from, to } = window(hour);
  return coverageBetween(db, from, to, majors, base);
}

/** feedCoverage over an arbitrary window, e.g. one archived day. */
export async function coverageBetween(
  db: Db,
  from: Date,
  to: Date,
  majors: ReadonlyArray<readonly string[]>,
  base: CampBaseline | null,
  limit = 20000,
): Promise<EventFeedCoverage[]> {
  const tags = [...new Set(majors.flat().filter((t) => t.trim()))];
  if (tags.length === 0) return majors.map(() => EMPTY);
  const rows = await db
    .select({ articleId: articleTags.articleId, media: articles.media, tag: articleTags.tag })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(and(inArray(articleTags.tag, tags), gte(articleTags.publishedAt, from), lte(articleTags.publishedAt, to)))
    .limit(limit);
  return groupFeedCoverage(rows, majors, base);
}

export interface PrevEvent {
  threadId: number | null;
  rank: number;
  major: string[];
}
/** Events of the snapshot at `hour` (the previous one, for rank deltas). */
export async function eventsAt(db: Db, category: string, hour: Date | null): Promise<PrevEvent[]> {
  if (!hour) return [];
  return db
    .select({ threadId: events.threadId, rank: events.rank, major: events.major })
    .from(events)
    .innerJoin(eventSnapshots, eq(eventSnapshots.id, events.snapshotId))
    .where(and(eq(eventSnapshots.category, category), eq(eventSnapshots.hourStart, hour)));
}

/** Where this event sat an hour ago. Thread ids are the primary link, but the
 *  threading job sometimes opens a fresh thread for a story that was on the
 *  table under another id, so fall back to major-tag overlap: the best-ranked
 *  previous event sharing at least half of the smaller major set, or the same
 *  leading tag (the strongest one, which names the story). */
export function matchPrevRank(e: { threadId: number | null; major: string[] }, prev: readonly PrevEvent[]): number | null {
  if (e.threadId != null) {
    const same = prev.find((p) => p.threadId === e.threadId);
    if (same) return same.rank;
  }
  const majors = new Set(e.major);
  if (majors.size === 0) return null;
  let best: number | null = null;
  for (const p of prev) {
    const shared = p.major.filter((t) => majors.has(t)).length;
    const need = Math.ceil(Math.min(majors.size, p.major.length) / 2);
    const linked = shared >= need || (p.major[0] !== undefined && p.major[0] === e.major[0]);
    if (shared >= 1 && linked && (best === null || p.rank < best)) best = p.rank;
  }
  return best;
}

/** Hours each thread had been on the table by `hour` inclusive, so archived
 *  snapshots show the run as it stood then, not the thread's final length. */
export async function hoursSoFar(db: Db, category: string, ids: number[], hour: Date): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (ids.length === 0) return out;
  const rows = await db
    .select({ threadId: events.threadId, n: sql<number>`count(distinct ${eventSnapshots.hourStart})` })
    .from(events)
    .innerJoin(eventSnapshots, eq(eventSnapshots.id, events.snapshotId))
    .where(and(eq(eventSnapshots.category, category), inArray(events.threadId, ids), lte(eventSnapshots.hourStart, hour)))
    .groupBy(events.threadId);
  for (const r of rows) if (r.threadId != null) out.set(r.threadId, Number(r.n));
  return out;
}

/** Rank of each thread in every snapshot of the `span` hours ending at
 *  `hour` (oldest first), null where it was off the table. Lets a card show
 *  the run as a line instead of just the last step. */
export async function rankTrail(
  db: Db,
  category: string,
  ids: number[],
  hour: Date,
  span = 24,
): Promise<Map<number, Array<number | null>>> {
  const out = new Map<number, Array<number | null>>();
  if (ids.length === 0) return out;
  const from = new Date(hour.getTime() - (span - 1) * HOUR);
  const rows = await db
    .select({ threadId: events.threadId, hourStart: eventSnapshots.hourStart, rank: events.rank })
    .from(events)
    .innerJoin(eventSnapshots, eq(eventSnapshots.id, events.snapshotId))
    .where(
      and(
        eq(eventSnapshots.category, category),
        inArray(events.threadId, ids),
        gte(eventSnapshots.hourStart, from),
        lte(eventSnapshots.hourStart, hour),
      ),
    );
  for (const id of ids)
    out.set(
      id,
      Array.from({ length: span }, () => null),
    );
  for (const r of rows) {
    const trail = r.threadId == null ? undefined : out.get(r.threadId);
    const i = Math.round((r.hourStart.getTime() - from.getTime()) / HOUR);
    if (!trail || i < 0 || i >= span) continue;
    // A thread can split into several events in one hour; keep its best rank.
    trail[i] = trail[i] === null ? r.rank : Math.min(trail[i], r.rank);
  }
  return out;
}

export async function threadInfo(db: Db, ids: number[]): Promise<Map<number, { hours: number; firstTime: Date }>> {
  const out = new Map<number, { hours: number; firstTime: Date }>();
  if (ids.length === 0) return out;
  const rows = await db
    .select({ id: eventThreads.id, hours: eventThreads.hours, firstTime: eventThreads.firstTime })
    .from(eventThreads)
    .where(inArray(eventThreads.id, ids));
  for (const r of rows) out.set(r.id, { hours: r.hours, firstTime: r.firstTime });
  return out;
}

/** Top score and event count of every snapshot hour in `hours`, for the day
 *  timeline under the hour picker. */
export async function hourStats(db: Db, category: string, hours: Date[]): Promise<Array<{ hour: string; top: number; count: number }>> {
  if (hours.length === 0) return [];
  const rows = await db
    .select({ hour: eventSnapshots.hourStart, count: eventSnapshots.eventCount, top: events.score })
    .from(eventSnapshots)
    .leftJoin(events, and(eq(events.snapshotId, eventSnapshots.id), eq(events.rank, 1)))
    .where(and(eq(eventSnapshots.category, category), inArray(eventSnapshots.hourStart, hours)));
  return rows
    .map((r) => ({ hour: r.hour.toISOString(), top: (r.top ?? 0) / 1e6, count: r.count }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}
