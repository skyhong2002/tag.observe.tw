import { and, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { tagHistory, tagStats } from '../db/schema.ts';

/** The whole archive (tag_history): first article ever and busiest Taipei day. */
export interface TagArchive {
  firstAt: Date;
  /** Null until the keyword's days have been counted (new keywords copied from the vocabulary). */
  peakDay: string | null;
  peakCount: number | null;
  computedAt: Date | null;
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

export type NewKeywordSort = 'first' | 'count' | 'peak' | 'last';
const NEW_KEYWORD_ORDER = {
  first: tagHistory.firstAt,
  count: tagHistory.articleCount,
  peak: tagHistory.peakDay,
  last: tagHistory.lastAt,
} as const;

/**
 * Keywords whose first article is at most `days` old, from tag_history
 * (jobs/tag-history-job.ts copies them hourly from the vocabulary aggregate).
 * Ranking tags counted by a recount carry the same fields, so they show up
 * here too once they are new enough.
 */
export async function loadNewKeywords(
  db: Db,
  {
    days,
    minArticles,
    sort,
    dir,
    limit,
    now = new Date(),
  }: { days: number; minArticles: number; sort: NewKeywordSort; dir: 'asc' | 'desc'; limit: number; now?: Date },
) {
  const where = and(
    gte(tagHistory.firstAt, new Date(now.getTime() - days * 86_400_000)),
    isNotNull(tagHistory.articleCount),
    gte(tagHistory.articleCount, minArticles),
  );
  const column = NEW_KEYWORD_ORDER[sort];
  const [rows, [total]] = await Promise.all([
    db
      .select({
        tag: tagHistory.tag,
        firstAt: tagHistory.firstAt,
        lastAt: tagHistory.lastAt,
        articleCount: tagHistory.articleCount,
        peakDay: tagHistory.peakDay,
        peakCount: tagHistory.peakCount,
      })
      .from(tagHistory)
      .where(where)
      // Unknown values (no peak yet) go last in either direction.
      .orderBy(sql`${column} IS NULL`, dir === 'asc' ? column : desc(column), desc(tagHistory.firstAt))
      .limit(limit),
    db
      .select({ n: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(tagHistory)
      .where(where),
  ]);
  return { total: total?.n ?? 0, keywords: rows };
}
