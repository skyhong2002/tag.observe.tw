import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { tagHistory, tagStats } from '../db/schema.ts';

/** The whole archive (tag_history): first article ever and busiest Taipei day. */
export interface TagArchive {
  firstAt: Date;
  peakDay: string;
  peakCount: number;
  computedAt: Date;
}
/** Hourly chart record (tag_stats, kept since 2026-09-28): first charted hour and busiest 24 hours. */
export interface TagChartHistory {
  firstHour: Date;
  maxHour: Date;
  maxCount: number;
}

/** Both records for many tags; tags without a row are missing from the maps. */
export async function loadTagHistories(db: Db, tags: string[], category: string) {
  const archive = new Map<string, TagArchive>();
  const charted = new Map<string, TagChartHistory>();
  if (!tags.length) return { archive, charted };
  const [archived, stats] = await Promise.all([
    db
      .select({
        tag: tagHistory.tag,
        firstAt: tagHistory.firstAt,
        peakDay: tagHistory.peakDay,
        peakCount: tagHistory.peakCount,
        computedAt: tagHistory.computedAt,
      })
      .from(tagHistory)
      .where(inArray(tagHistory.tag, tags)),
    db
      .select({
        tag: tagStats.tag,
        level: tagStats.level,
        firstHour: tagStats.firstHour,
        maxHour: tagStats.maxHour,
        maxCount: tagStats.maxCount,
      })
      .from(tagStats)
      .where(and(eq(tagStats.category, category), inArray(tagStats.level, [2, 3]), inArray(tagStats.tag, tags))),
  ]);
  for (const { tag, ...row } of archived) archive.set(tag, row);
  // tag_stats keeps one row per case-insensitive label; like the tag page,
  // the stricter level 3 (several outlets) wins over level 2.
  const exact = new Set(tags);
  const folded = new Map(tags.map((t) => [t.toLowerCase(), t]));
  for (const { tag, level: _, ...row } of stats.sort((a, b) => a.level - b.level)) {
    const key = exact.has(tag) ? tag : folded.get(tag.toLowerCase());
    if (key) charted.set(key, row);
  }
  return { archive, charted };
}
