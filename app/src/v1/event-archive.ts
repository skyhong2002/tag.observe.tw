import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articles, articleTags, eventSnapshots, events, eventThreads } from '../db/schema.ts';
import { rankingBasis } from '../jobs/ranking-basis.ts';
import { type Camp, campOf } from './coverage.ts';
import { campBaselineBetween, coverageBetween, hourStats } from './event-feed.ts';
import { loadHourlyTrends } from './tag-series.ts';

// Event archive: every thread active on a Taipei day, and one thread's hourly
// trend (fixed-cohort major-tag scores plus all-source reports per camp).

const HOUR = 3600e3,
  TPE = 8 * HOUR;
export const taipeiDay = (d: Date) => new Date(d.getTime() + TPE).toISOString().slice(0, 10);
export const dayRange = (day: string) => {
  const from = new Date(Date.parse(`${day}T00:00:00Z`) - TPE);
  return { from, to: new Date(from.getTime() + 24 * HOUR) };
};
/** Camp coverage window for a day: the 24h ending with it, or now for today,
 *  so a finished day is its own window and today matches the live table. */
export const coverageWindow = (day: string, now: Date) => {
  const end = new Date(Math.min(dayRange(day).to.getTime(), now.getTime()));
  return { start: new Date(end.getTime() - 24 * HOUR), end };
};

export interface CampCounts {
  blue: number;
  green: number;
  other: number;
}
/** Articles per hour and camp over [from, to), one bucket per hour. */
export function bucketByHour(
  rows: Array<{ id: number; media: string; publishedAt: Date }>,
  from: Date,
  to: Date,
  cats?: Record<string, string[]>,
): Array<{ t: string } & CampCounts> {
  const n = Math.max(0, Math.ceil((to.getTime() - from.getTime()) / HOUR));
  const out = Array.from({ length: n }, (_, i) => ({ t: new Date(from.getTime() + i * HOUR).toISOString(), blue: 0, green: 0, other: 0 }));
  const seen = new Set<number>();
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const i = Math.floor((r.publishedAt.getTime() - from.getTime()) / HOUR);
    if (i < 0 || i >= n) continue;
    out[i][campOf(r.media, cats) as Camp] += 1;
  }
  return out;
}

// Coverage over a whole day can join far more tagged articles than one hour's
// table; cap generously so a busy day is not silently undercounted.
const DAY_COVERAGE_ROWS = 100000;
const TRAIL_SPAN = 24;

/** Each thread's rank over the `span` snapshot hours ending at its own `end`
 *  (oldest first), null where it was off the table. A thread that peaked the
 *  evening before still shows that run on the next day's archive. */
export function trailsEnding(
  rows: Array<{ threadId: number | null; hourStart: Date; rank: number }>,
  ends: ReadonlyMap<number, Date>,
  span = 24,
): Map<number, Array<number | null>> {
  const out = new Map<number, Array<number | null>>();
  for (const id of ends.keys())
    out.set(
      id,
      Array.from({ length: span }, () => null),
    );
  for (const r of rows) {
    const end = r.threadId == null ? undefined : ends.get(r.threadId);
    const trail = r.threadId == null ? undefined : out.get(r.threadId);
    if (!end || !trail) continue;
    const i = span - 1 - Math.round((end.getTime() - r.hourStart.getTime()) / HOUR);
    if (i < 0 || i >= span) continue;
    // A thread can split into several events in one hour; keep its best rank.
    trail[i] = trail[i] === null ? r.rank : Math.min(trail[i], r.rank);
  }
  return out;
}

export async function threadsOnDay(db: Db, category: string, day: string, now = new Date()) {
  const { from, to } = dayRange(day);
  const threads = await db
    .select({
      id: eventThreads.id,
      firstTime: eventThreads.firstTime,
      lastTime: eventThreads.lastTime,
      hours: eventThreads.hours,
      majorTags: eventThreads.majorTags,
      maxTag: eventThreads.maxTag,
      maxScore: eventThreads.maxScore,
    })
    .from(eventThreads)
    .where(and(eq(eventThreads.category, category), lt(eventThreads.firstTime, to), gte(eventThreads.lastTime, from)))
    .orderBy(desc(eventThreads.maxScore))
    .limit(300);
  // Each thread's best-ranked hour supplies its headlines.
  const best = new Map<
    number,
    { rank: number; news: Array<{ id?: number; title: string; url: string; image: string | null; media: string }> }
  >();
  const ids = threads.map((t) => t.id);
  for (let i = 0; i < ids.length; i += 100) {
    const rows = await db
      .select({ threadId: events.threadId, rank: events.rank, news: events.news, majorNews: events.majorNews })
      .from(events)
      .where(inArray(events.threadId, ids.slice(i, i + 100)));
    for (const r of rows) {
      const cur = best.get(r.threadId as number);
      if (!cur || r.rank < cur.rank)
        best.set(r.threadId as number, { rank: r.rank, news: (r.majorNews.length ? r.majorNews : r.news).slice(0, 6) });
    }
  }
  // Who covered each thread, judged against the window's camp split exactly as
  // the hourly table is.
  const { start, end } = coverageWindow(day, now);
  const [days, hours, baseline] = await Promise.all([
    db
      .selectDistinct({ d: sql<string>`DATE_FORMAT(${eventSnapshots.hourStart} + INTERVAL 8 HOUR, '%Y-%m-%d')` })
      .from(eventSnapshots)
      .where(eq(eventSnapshots.category, category)),
    db
      .select({ h: eventSnapshots.hourStart })
      .from(eventSnapshots)
      .where(and(eq(eventSnapshots.category, category), gte(eventSnapshots.hourStart, from), lt(eventSnapshots.hourStart, to)))
      .orderBy(eventSnapshots.hourStart),
    campBaselineBetween(db, start, end),
  ]);
  const dayHours = hours.map((r) => r.h);
  // Trails end at each thread's last hour on the table that day.
  const last = dayHours.at(-1);
  const ends = new Map(threads.map((t) => [t.id, last && t.lastTime > last ? last : t.lastTime]));
  const endTimes = [...ends.values()].map((d) => d.getTime());
  const trailFrom = new Date(Math.min(...endTimes, from.getTime()) - (TRAIL_SPAN - 1) * HOUR);
  const [coverage, dayStats, trails] = await Promise.all([
    coverageBetween(
      db,
      start,
      end,
      threads.map((t) => t.majorTags),
      baseline,
      DAY_COVERAGE_ROWS,
    ),
    hourStats(db, category, dayHours),
    ids.length === 0
      ? []
      : db
          .select({ threadId: events.threadId, hourStart: eventSnapshots.hourStart, rank: events.rank })
          .from(events)
          .innerJoin(eventSnapshots, eq(eventSnapshots.id, events.snapshotId))
          .where(
            and(
              eq(eventSnapshots.category, category),
              inArray(events.threadId, ids),
              gte(eventSnapshots.hourStart, trailFrom),
              lt(eventSnapshots.hourStart, to),
            ),
          ),
  ]).then(([c, s, rows]) => [c, s, trailsEnding(rows, ends, TRAIL_SPAN)] as const);
  return {
    day,
    days: days.map((r) => r.d).sort(),
    dayHours: dayHours.map((h) => h.toISOString()),
    dayStats,
    baseline,
    threads: threads.map((t, i) => ({
      ...t,
      maxScore: t.maxScore / 1e6,
      bestRank: best.get(t.id)?.rank ?? null,
      rankTrail: trails.get(t.id) ?? null,
      trailEnd: ends.get(t.id)?.toISOString() ?? null,
      coverage: coverage[i],
      news: (best.get(t.id)?.news ?? []).map((n) => ({
        id: n.id ?? null,
        media: n.media,
        camp: campOf(n.media),
        title: n.title,
        url: n.url,
        image: n.image,
      })),
    })),
  };
}

export async function threadSeries(db: Db, thread: { majorTags: string[]; firstTime: Date; lastTime: Date }, now = new Date(), pad = 12) {
  const from = new Date(thread.firstTime.getTime() - pad * HOUR);
  const to = new Date(Math.min(thread.lastTime.getTime() + (pad + 1) * HOUR, Math.floor(now.getTime() / HOUR) * HOUR));
  const tags = [...new Set(thread.majorTags.filter((t) => t.trim()))].slice(0, 6);
  const basis = rankingBasis('all');
  const trends = await loadHourlyTrends(db, tags, basis.media, from, to, basis);
  const byHour = new Map<string, Record<string, { score: number | null; rank: null }>>();
  for (const [tag, points] of trends)
    for (const p of points) {
      const at = byHour.get(p.t) ?? {};
      at[tag] = { score: p.score == null ? null : Number(p.score.toFixed(2)), rank: null };
      byHour.set(p.t, at);
    }
  const rows =
    tags.length === 0
      ? []
      : await db
          .selectDistinct({ id: articles.id, media: articles.media, publishedAt: articles.publishedAt })
          .from(articleTags)
          .innerJoin(articles, eq(articles.id, articleTags.articleId))
          .where(and(inArray(articleTags.tag, tags), gte(articleTags.publishedAt, from), lt(articleTags.publishedAt, to)));
  const counts = bucketByHour(rows, from, to);
  return {
    tags,
    basis,
    from: from.toISOString(),
    to: to.toISOString(),
    points: counts.map((c) => ({ ...c, tags: byHour.get(c.t) ?? null })),
  };
}
