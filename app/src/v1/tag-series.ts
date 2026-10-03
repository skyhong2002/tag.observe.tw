import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articles, articleTags } from '../db/schema.ts';

const HOUR = 3600e3;
export interface HourlyCount {
  t: string;
  hourlyCount: number;
  average24h: number;
}

// The legacy tag_series.php Day line: this hour plus the preceding 23,
// divided by 24 (including hours with zero collected articles).
export function hourlyMovingAverage(counts: ReadonlyMap<number, number>, from: Date, to: Date): HourlyCount[] {
  const out: HourlyCount[] = [];
  let total = 0;
  for (let t = from.getTime() - 24 * HOUR; t < from.getTime(); t += HOUR) total += counts.get(t) ?? 0;
  for (let t = from.getTime(); t < to.getTime(); t += HOUR) {
    total += counts.get(t) ?? 0;
    total -= counts.get(t - 24 * HOUR) ?? 0;
    out.push({ t: new Date(t).toISOString(), hourlyCount: counts.get(t) ?? 0, average24h: total / 24 });
  }
  return out;
}

/** Dense hourly counts, with an extra 23 hours for the first displayed mean. */
export async function loadHourlyTrends(db: Db, tags: string[], media: string[], from: Date, to: Date) {
  if (!tags.length || !media.length) return new Map<string, HourlyCount[]>();
  const warmup = new Date(from.getTime() - 23 * HOUR);
  const bucket = sql<number>`FLOOR(TIMESTAMPDIFF(SECOND, ${warmup}, ${articleTags.publishedAt}) / 3600)`;
  const rows = await db
    .select({ tag: articleTags.tag, bucket, count: sql<number>`COUNT(DISTINCT ${articleTags.articleId})` })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(
      and(
        inArray(articleTags.tag, tags),
        inArray(articles.media, media),
        gte(articleTags.publishedAt, warmup),
        lt(articleTags.publishedAt, to),
      ),
    )
    .groupBy(articleTags.tag, bucket);
  const counts = new Map(tags.map((tag) => [tag, new Map<number, number>()]));
  for (const r of rows) counts.get(r.tag)?.set(warmup.getTime() + Number(r.bucket) * HOUR, Number(r.count));
  return new Map(tags.map((tag) => [tag, hourlyMovingAverage(counts.get(tag)!, from, to)]));
}

// Use completed hours: an unfinished hour would create a false drop at the end.
export function completedHourWindow(now: Date, hours: number) {
  const to = new Date(Math.floor(now.getTime() / HOUR) * HOUR);
  return { from: new Date(to.getTime() - hours * HOUR), to };
}
