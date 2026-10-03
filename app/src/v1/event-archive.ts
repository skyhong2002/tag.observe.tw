import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articles, articleTags, eventSnapshots, events, eventThreads } from '../db/schema.ts';
import { rankingBasis } from '../jobs/ranking-basis.ts';
import { type Camp, campOf } from './coverage.ts';
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

export async function threadsOnDay(db: Db, category: string, day: string) {
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
  const best = new Map<number, { rank: number; news: Array<{ title: string; url: string; image: string | null; media: string }> }>();
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
  const days = await db
    .selectDistinct({ d: sql<string>`DATE_FORMAT(${eventSnapshots.hourStart} + INTERVAL 8 HOUR, '%Y-%m-%d')` })
    .from(eventSnapshots)
    .where(eq(eventSnapshots.category, category));
  return {
    day,
    days: days.map((r) => r.d).sort(),
    threads: threads.map((t) => ({
      ...t,
      maxScore: t.maxScore / 1e6,
      bestRank: best.get(t.id)?.rank ?? null,
      news: (best.get(t.id)?.news ?? []).map((n) => ({ title: n.title, url: n.url, image: n.image, media: n.media })),
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
