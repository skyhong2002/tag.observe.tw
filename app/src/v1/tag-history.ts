import { and, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articles, articleTags, tagHistory, tagStats } from '../db/schema.ts';

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
    media = false,
    now = new Date(),
  }: { days: number; minArticles: number; sort: NewKeywordSort; dir: 'asc' | 'desc'; limit: number; media?: boolean; now?: Date },
) {
  const since = new Date(now.getTime() - days * 86_400_000);
  const where = and(gte(tagHistory.firstAt, since), isNotNull(tagHistory.articleCount), gte(tagHistory.articleCount, minArticles));
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
  if (!media) return { total: total?.n ?? 0, keywords: rows };
  const byTag = await cachedMediaCounts(
    db,
    rows.map((r) => r.tag),
    since,
    now,
  );
  return { total: total?.n ?? 0, keywords: rows.map((r) => ({ ...r, media: byTag.get(r.tag) ?? {} })) };
}

// Outlet counts join every article of each listed keyword: milliseconds on a
// warm buffer pool, several seconds on a cold one (2026-10-24, when the page
// timed out and was cached without its cloud). Keep results ten minutes per
// tag, keyed by the day the window starts, so each listing reads them once.
const MEDIA_TTL = 10 * 60_000;
const mediaCache = new WeakMap<Db, Map<string, { until: number; media: Record<string, number> }>>();
async function cachedMediaCounts(db: Db, tags: string[], since: Date, now: Date) {
  let saved = mediaCache.get(db);
  if (!saved) mediaCache.set(db, (saved = new Map()));
  const day = since.toISOString().slice(0, 10);
  const out = new Map<string, Record<string, number>>();
  const missing: string[] = [];
  for (const tag of tags) {
    const hit = saved.get(`${day}\n${tag}`);
    if (hit && hit.until > now.getTime()) out.set(tag, hit.media);
    else missing.push(tag);
  }
  if (!missing.length) return out;
  // The window starts at the beginning of its day so cached counts stay valid all day.
  const fresh = await mediaCounts(db, missing, new Date(`${day}T00:00:00Z`));
  if (saved.size > 20_000) saved.clear();
  for (const tag of missing) {
    const media = fresh.get(tag) ?? {};
    saved.set(`${day}\n${tag}`, { until: now.getTime() + MEDIA_TTL, media });
    out.set(tag, media);
  }
  return out;
}

/**
 * Articles per outlet for keywords first seen after `since`: every article
 * carrying them is newer than that, so tag_published bounds the read to the
 * window. Every crawled outlet counts, not only a ranking's basis.
 */
async function mediaCounts(db: Db, tags: string[], since: Date) {
  const out = new Map<string, Record<string, number>>();
  if (!tags.length) return out;
  const exact = new Set(tags);
  const exactTag = sql<string>`${articleTags.tag} COLLATE utf8mb4_bin`;
  const rows = await db
    .select({ tag: exactTag, media: articles.media, n: sql<number>`COUNT(*)`.mapWith(Number) })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(and(inArray(articleTags.tag, tags), gte(articleTags.publishedAt, since)))
    .groupBy(exactTag, articles.media);
  for (const r of rows.sort((a, b) => b.n - a.n)) {
    if (!exact.has(r.tag)) continue;
    const m = out.get(r.tag) ?? {};
    m[r.media] = r.n;
    out.set(r.tag, m);
  }
  return out;
}
