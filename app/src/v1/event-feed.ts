import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articles, articleTags, eventSnapshots, events, eventThreads } from '../db/schema.ts';
import { type Camp, campOf } from './coverage.ts';

// Extra signal for the hourly event table: how widely each event is being
// reported (outlets and camps, with blind spots), how it moved since the
// previous snapshot, and how long its thread has been running. The full
// per-outlet headline comparison stays on /events/threads/:id/coverage.

const HOUR = 3600e3;

export interface EventFeedCoverage {
  outlets: Array<{ media: string; camp: Camp }>;
  articles: number;
  camps: Record<Camp, number>;
  blindspot: Camp[];
}

/** Outlets that carry at least one of each event's major tags, from one
 *  shared article set. `articles` is an upper bound (an article with two of
 *  the event's tags is counted once per tag). */
export function groupFeedCoverage(
  rows: Array<{ articleId: number; media: string; tag: string }>,
  majors: ReadonlyArray<readonly string[]>,
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
    const blindspot: Camp[] = [];
    if (camps.blue > 0 && camps.green === 0) blindspot.push('green');
    if (camps.green > 0 && camps.blue === 0) blindspot.push('blue');
    return { outlets, articles: seen.size, camps, blindspot };
  });
}

/** Coverage for every event of one snapshot hour. Events cluster the previous
 *  24h of reports, so that is the window. */
export async function feedCoverage(db: Db, hour: Date, majors: ReadonlyArray<readonly string[]>): Promise<EventFeedCoverage[]> {
  const tags = [...new Set(majors.flat().filter((t) => t.trim()))];
  if (tags.length === 0) return majors.map(() => ({ outlets: [], articles: 0, camps: { blue: 0, green: 0, other: 0 }, blindspot: [] }));
  const rows = await db
    .select({ articleId: articleTags.articleId, media: articles.media, tag: articleTags.tag })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(
      and(
        inArray(articleTags.tag, tags),
        gte(articleTags.publishedAt, new Date(hour.getTime() - 24 * HOUR)),
        lte(articleTags.publishedAt, new Date(hour.getTime() + HOUR)),
      ),
    )
    .limit(20000);
  return groupFeedCoverage(rows, majors);
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
