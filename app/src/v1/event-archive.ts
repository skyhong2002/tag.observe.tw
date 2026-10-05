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

export const PERIOD_DAYS = [1, 7, 31] as const;

/** Weigh each thread by its summed hourly score in the window (the best row
 *  when a thread holds two ranks in one hour), so a story that led for days
 *  outranks one that flared for an hour. Threads re-opened for the same story
 *  show up under another id; skip one sharing at least half of the smaller
 *  major set, or the leading tag, with a heavier pick. */
export function pickPeriodThreads(
  rows: ReadonlyArray<{ threadId: number | null; hourStart: Date; score: number; rank: number }>,
  majors: ReadonlyMap<number, readonly string[]>,
  limit: number,
) {
  const hourly = new Map<number, Map<number, { score: number; rank: number }>>();
  for (const r of rows) {
    if (r.threadId == null) continue;
    const hours = hourly.get(r.threadId) ?? new Map();
    const at = hours.get(r.hourStart.getTime());
    if (!at || r.score > at.score) hours.set(r.hourStart.getTime(), { score: r.score, rank: Math.min(r.rank, at?.rank ?? r.rank) });
    else at.rank = Math.min(at.rank, r.rank);
    hourly.set(r.threadId, hours);
  }
  const ranked = [...hourly].map(([id, hours]) => {
    const v = [...hours.values()];
    return { id, weight: v.reduce((s, h) => s + h.score, 0), hours: v.length, bestRank: Math.min(...v.map((h) => h.rank)) };
  });
  ranked.sort((a, b) => b.weight - a.weight || a.id - b.id);
  const picked: typeof ranked = [];
  for (const t of ranked) {
    if (picked.length >= limit) break;
    const mine = majors.get(t.id) ?? [];
    const same = picked.some((p) => {
      const theirs = majors.get(p.id) ?? [];
      const shared = mine.filter((tag) => theirs.includes(tag)).length;
      return (
        (mine[0] !== undefined && mine[0] === theirs[0]) || (shared > 0 && shared >= Math.ceil(Math.min(mine.length, theirs.length) / 2))
      );
    });
    if (!same) picked.push(t);
  }
  return picked;
}

/** The main event threads of the last `days` days: who was on them over the
 *  whole window, and the headlines of each thread's best hour in it. */
export async function threadsInPeriod(db: Db, category: string, days: number, limit = 6, now = new Date()) {
  const to = now;
  const from = new Date(now.getTime() - days * 24 * HOUR);
  const rows = await db
    .select({ threadId: events.threadId, hourStart: eventSnapshots.hourStart, score: events.score, rank: events.rank })
    .from(events)
    .innerJoin(eventSnapshots, eq(eventSnapshots.id, events.snapshotId))
    .where(and(eq(eventSnapshots.category, category), gte(eventSnapshots.hourStart, from), lt(eventSnapshots.hourStart, to)));
  const ids = [...new Set(rows.map((r) => r.threadId).filter((id): id is number => id != null))];
  const threads =
    ids.length === 0
      ? []
      : await db
          .select({
            id: eventThreads.id,
            firstTime: eventThreads.firstTime,
            lastTime: eventThreads.lastTime,
            majorTags: eventThreads.majorTags,
            maxTag: eventThreads.maxTag,
          })
          .from(eventThreads)
          .where(inArray(eventThreads.id, ids));
  const byId = new Map(threads.map((t) => [t.id, t]));
  const picked = pickPeriodThreads(rows, new Map(threads.map((t) => [t.id, t.majorTags])), limit).filter((p) => byId.has(p.id));
  const best = new Map<number, Array<{ id?: number; title: string; url: string; image: string | null; media: string }>>();
  if (picked.length) {
    const news = await db
      .select({ threadId: events.threadId, rank: events.rank, news: events.news, majorNews: events.majorNews })
      .from(events)
      .innerJoin(eventSnapshots, eq(eventSnapshots.id, events.snapshotId))
      .where(
        and(
          inArray(
            events.threadId,
            picked.map((p) => p.id),
          ),
          gte(eventSnapshots.hourStart, from),
          lt(eventSnapshots.hourStart, to),
        ),
      )
      .orderBy(events.rank);
    for (const r of news)
      if (!best.has(r.threadId as number)) best.set(r.threadId as number, (r.majorNews.length ? r.majorNews : r.news).slice(0, 6));
  }
  const baseline = await campBaselineBetween(db, from, to);
  const coverage = await coverageBetween(
    db,
    from,
    to,
    picked.map((p) => byId.get(p.id)?.majorTags ?? []),
    baseline,
    DAY_COVERAGE_ROWS,
  );
  return {
    days,
    from: from.toISOString(),
    to: to.toISOString(),
    baseline,
    threads: picked.map((p, i) => {
      const t = byId.get(p.id) as (typeof threads)[number];
      return {
        ...t,
        weight: p.weight / 1e6,
        hours: p.hours,
        bestRank: p.bestRank,
        coverage: coverage[i],
        news: (best.get(p.id) ?? []).map((n) => ({
          id: n.id ?? null,
          media: n.media,
          camp: campOf(n.media),
          title: n.title,
          url: n.url,
          image: n.image,
        })),
      };
    }),
  };
}
