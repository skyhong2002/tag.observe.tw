// Each keyword's whole archive (tag_history): the first article that ever
// carried it and the Taipei day with the most articles. A full recount groups
// all of a tag's article_tags rows by day along tag_published; most tags take
// milliseconds, the biggest (美國, about 500,000 rows) several seconds on a
// cold buffer pool. So recounts run one tag at a time, rest about three times
// as long as the query took, and stop at the budget: tag-db was OOM-killed
// at its old 5 GB cap during the first backfill (2026-10-24).
//
// Every hour: the tags on the latest rankings that already have a row only
// recount their last two days (one batched query); keywords first seen in the
// last 90 days are copied from the vocabulary aggregate (a local SQLite file
// the vocabulary export keeps, so finding them costs tag-db nothing); then
// recounts run for new ranking tags, rows due for their weekly recount, the
// copied keywords that have no peak yet (small, so cheap), and tags that
// ever charted (tag_stats).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articleTags, jobRuns, rankingSnapshots, tagHistory, tagStats } from '../db/schema.ts';
import { rankingCategories } from '../media-categories.ts';
import { isTagNoise } from '../tag-noise.ts';
import type { RankingChart } from './ranking-compute.ts';

const DAY = 86_400_000;
const TAIPEI = 8 * 3600e3;
/** Full recounts are redone after this long. */
export const TAG_HISTORY_RECOUNT_DAYS = 7;
/** Tags per category taken from each latest ranking, in chart order. */
const RANKING_TAGS = 500;
/** New keywords: first seen within this many days, with at least this many articles. */
export const NEW_KEYWORD_DAYS = 90;
export const NEW_KEYWORD_MIN_ARTICLES = 3;

export const taipeiDay = (t: Date) => new Date(t.getTime() + TAIPEI).toISOString().slice(0, 10);

/** The busiest day; the earliest of equal days, so a later tie does not move it. */
export function peakOf(days: Array<{ day: string; n: number }>) {
  let best: { day: string; n: number } | null = null;
  for (const d of days) if (!best || d.n > best.n || (d.n === best.n && d.day < best.day)) best = d;
  return best;
}

const exact = (tag: string) => sql`${articleTags.tag} COLLATE utf8mb4_bin = ${tag}`;
const isTimeout = (e: unknown) => {
  const err = e as { errno?: number; cause?: { errno?: number } };
  return err.errno === 1969 || err.cause?.errno === 1969;
};

/** Articles per Taipei day for one exact label; days after `now` are bad dates and skipped. */
async function dayCounts(db: Db, tag: string, now: Date, timeoutSeconds: number) {
  const [rows] = (await db.execute(sql`SET STATEMENT max_statement_time=${sql.raw(String(timeoutSeconds))} FOR
    SELECT DATE_FORMAT(${articleTags.publishedAt} + INTERVAL 8 HOUR, '%Y-%m-%d') AS day, COUNT(*) AS n
    FROM ${articleTags} FORCE INDEX (tag_published)
    WHERE ${articleTags.tag} = ${tag} AND ${exact(tag)} AND ${articleTags.publishedAt} <= ${now}
    GROUP BY day`)) as unknown as [Array<{ day: string; n: number | string }>];
  return rows.map((r) => ({ day: r.day, n: Number(r.n) }));
}

/** Recount every day of one tag and store it; false when the tag has no articles left. */
export async function recountTag(db: Db, tag: string, now: Date, timeoutSeconds = 30) {
  const days = await dayCounts(db, tag, now, timeoutSeconds);
  const peak = peakOf(days);
  if (!peak) {
    await db.delete(tagHistory).where(eq(tagHistory.tag, tag));
    return false;
  }
  const edge = (order: typeof asc) =>
    db
      .select({ at: articleTags.publishedAt })
      .from(articleTags)
      .where(and(eq(articleTags.tag, tag), exact(tag), lte(articleTags.publishedAt, now)))
      .orderBy(order(articleTags.publishedAt))
      .limit(1);
  const [[first], [last]] = await Promise.all([edge(asc), edge(desc)]);
  const row = {
    firstAt: first.at,
    lastAt: last.at,
    articleCount: days.reduce((sum, d) => sum + d.n, 0),
    peakDay: peak.day,
    peakCount: peak.n,
    computedAt: now,
    updatedAt: now,
  };
  await db
    .insert(tagHistory)
    .values({ tag, ...row })
    .onDuplicateKeyUpdate({ set: row });
  return true;
}

/**
 * Add the latest days to rows counted before: one query for many tags. A day
 * that beats the stored peak replaces it; the stored peak day's own count is
 * refreshed while it is still among the recounted days.
 */
export async function refreshRecentDays(db: Db, rows: Array<typeof tagHistory.$inferSelect>, now: Date) {
  if (!rows.length) return 0;
  const since = new Date(Date.parse(taipeiDay(new Date(now.getTime() - DAY))) - TAIPEI);
  const sinceDay = taipeiDay(since);
  const exactTag = sql<string>`${articleTags.tag} COLLATE utf8mb4_bin`;
  const counts = await db
    .select({
      tag: exactTag,
      day: sql<string>`DATE_FORMAT(${articleTags.publishedAt} + INTERVAL 8 HOUR, '%Y-%m-%d')`.as('day'),
      n: sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(articleTags)
    .where(
      and(
        inArray(
          articleTags.tag,
          rows.map((r) => r.tag),
        ),
        gte(articleTags.publishedAt, since),
        lte(articleTags.publishedAt, now),
      ),
    )
    .groupBy(exactTag, sql`day`);
  const byTag = new Map<string, Array<{ day: string; n: number }>>();
  for (const c of counts) byTag.set(c.tag, [...(byTag.get(c.tag) ?? []), { day: c.day, n: c.n }]);
  let changed = 0;
  for (const row of rows) {
    if (row.peakDay === null || row.peakCount === null) continue;
    const recent = peakOf(byTag.get(row.tag) ?? []);
    const stored = row.peakDay >= sinceDay ? (byTag.get(row.tag)?.find((d) => d.day === row.peakDay) ?? null) : null;
    let peak = { day: row.peakDay, n: stored?.n ?? row.peakCount };
    if (recent && (recent.n > peak.n || (recent.n === peak.n && recent.day < peak.day))) peak = recent;
    const set =
      peak.day !== row.peakDay || peak.n !== row.peakCount ? { peakDay: peak.day, peakCount: peak.n, updatedAt: now } : { updatedAt: now };
    await db.update(tagHistory).set(set).where(eq(tagHistory.tag, row.tag));
    if ('peakDay' in set) changed++;
  }
  return changed;
}

/**
 * Copy keywords first seen in the last `days` days with at least `minArticles`
 * articles from the vocabulary aggregate (app/src/vocabulary/aggregate.ts,
 * refreshed every ten minutes) into tag_history. It holds every exact label's
 * first and last article and count over the whole index. Only the covering
 * index terms_first(first_at,n,last_at) makes this cheap (about 100,000 index
 * entries for 90 days, against a minute or more through terms_last or a full
 * scan of 4.7 million rows), so without it nothing is copied. The peak is
 * left for a recount.
 */
export async function copyNewKeywords(
  db: Db,
  directory: string,
  now: Date,
  { days = NEW_KEYWORD_DAYS, minArticles = NEW_KEYWORD_MIN_ARTICLES } = {},
) {
  const path = join(directory, 'aggregate.sqlite');
  if (!existsSync(path)) return null;
  const since = new Date(now.getTime() - days * DAY).toISOString();
  const sqlite = new DatabaseSync(path, { readOnly: true });
  let rows: Array<{ tag: string; firstAt: Date; lastAt: Date; articleCount: number }>;
  try {
    if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='terms_first'").get()) return null;
    rows = sqlite
      .prepare('SELECT CAST(label AS BLOB) label_bytes,n,first_at,last_at FROM terms INDEXED BY terms_first WHERE first_at>=? AND n>=?')
      .all(since, minArticles)
      .map((r) => ({
        // Labels are read as bytes: Node's TEXT decoding stops at an embedded NUL.
        tag: Buffer.from(r.label_bytes as Uint8Array).toString('utf8'),
        firstAt: new Date(String(r.first_at)),
        lastAt: new Date(String(r.last_at)),
        articleCount: Number(r.n),
      }))
      .filter((r) => [...r.tag].length >= 2 && r.tag.length <= 60 && !isTagNoise(r.tag));
  } finally {
    sqlite.close();
  }
  for (let i = 0; i < rows.length; i += 500)
    await db
      .insert(tagHistory)
      .values(rows.slice(i, i + 500).map((r) => ({ ...r, updatedAt: now })))
      .onDuplicateKeyUpdate({
        set: {
          firstAt: sql`VALUES(first_at)`,
          lastAt: sql`VALUES(last_at)`,
          articleCount: sql`VALUES(article_count)`,
          updatedAt: sql`VALUES(updated_at)`,
        },
      });
  return rows.length;
}

/** Tags on each category's latest ranking, news first, without noise. */
export async function rankingTags(db: Db, perCategory = RANKING_TAGS) {
  const tags = new Set<string>();
  const categories = Object.keys(rankingCategories()).sort((a, b) => Number(b === 'news') - Number(a === 'news'));
  for (const category of categories) {
    const [snapshot] = await db
      .select({ chart: rankingSnapshots.chart })
      .from(rankingSnapshots)
      .where(eq(rankingSnapshots.category, category))
      .orderBy(desc(rankingSnapshots.hourStart))
      .limit(1);
    if (!snapshot) continue;
    const chart = JSON.parse(snapshot.chart) as RankingChart;
    for (const e of chart.entries.filter((x) => !isTagNoise(x.tag)).slice(0, perCategory)) tags.add(e.tag);
  }
  return [...tags];
}

export async function runTagHistoryJob(
  db: Db,
  {
    now = () => new Date(),
    log = (_o: object, _m: string) => {},
    budgetMs = 60_000,
    restMs = 500,
    timeoutSeconds = 30,
    backfill = 200,
    vocabularyDir = process.env.TAG_VOCABULARY_EXPORT_DIR,
  }: {
    now?: () => Date;
    log?: (o: object, m: string) => void;
    budgetMs?: number;
    restMs?: number;
    timeoutSeconds?: number;
    /** At most this many tag_stats tags without a row are read per run. */
    backfill?: number;
    /** The vocabulary export's private directory; without it no new keywords are copied. */
    vocabularyDir?: string;
  } = {},
) {
  const started = now();
  const [run] = await db.insert(jobRuns).values({ name: 'tag-history', startedAt: started, status: 'running' }).$returningId();
  const summary = {
    rankingTags: 0,
    refreshed: 0,
    peaksMoved: 0,
    newKeywords: null as number | null,
    counted: 0,
    recounted: 0,
    newCounted: 0,
    backfilled: 0,
    timedOut: 0,
    left: 0,
  };
  try {
    const tags = await rankingTags(db);
    summary.rankingTags = tags.length;
    const known = new Map<string, typeof tagHistory.$inferSelect>();
    for (let i = 0; i < tags.length; i += 500) {
      const chunk = tags.slice(i, i + 500);
      for (const row of await db.select().from(tagHistory).where(inArray(tagHistory.tag, chunk))) known.set(row.tag, row);
    }
    const stale = new Date(started.getTime() - TAG_HISTORY_RECOUNT_DAYS * DAY);
    const current = [...known.values()].filter((r) => r.computedAt && r.computedAt >= stale);
    for (let i = 0; i < current.length; i += 200) {
      summary.peaksMoved += await refreshRecentDays(db, current.slice(i, i + 200), now());
      summary.refreshed += Math.min(200, current.length - i);
    }
    if (vocabularyDir) summary.newKeywords = await copyNewKeywords(db, vocabularyDir, started);
    const missing = tags.filter((t) => !known.get(t)?.computedAt);
    const recount = [...known.values()].filter((r) => r.computedAt && r.computedAt < stale).map((r) => r.tag);
    const queued = new Set([...missing, ...recount]);
    const backfillTags = async () =>
      (
        await db
          .select({ tag: tagStats.tag })
          .from(tagStats)
          .leftJoin(tagHistory, sql`${tagHistory.tag} = ${tagStats.tag} COLLATE utf8mb4_bin`)
          .where(isNull(tagHistory.tag))
          .groupBy(tagStats.tag)
          .orderBy(desc(sql`MAX(${tagStats.maxCount})`))
          .limit(backfill)
      )
        .map((r) => r.tag)
        .filter((t) => !isTagNoise(t) && !queued.has(t));
    // Copied new keywords without a peak yet, busiest first.
    const uncounted = async () =>
      (
        await db
          .select({ tag: tagHistory.tag })
          .from(tagHistory)
          .where(isNull(tagHistory.computedAt))
          .orderBy(desc(tagHistory.articleCount))
          .limit(5 * backfill)
      )
        .map((r) => r.tag)
        .filter((t) => !queued.has(t));
    // Old rows that left the rankings are recounted weekly too, oldest first.
    const oldRows = async () =>
      (
        await db
          .select({ tag: tagHistory.tag })
          .from(tagHistory)
          .where(lt(tagHistory.computedAt, stale))
          .orderBy(asc(tagHistory.computedAt))
          .limit(backfill)
      )
        .map((r) => r.tag)
        .filter((t) => !queued.has(t));
    const queues: Array<['counted' | 'recounted' | 'newCounted' | 'backfilled', () => Promise<string[]> | string[]]> = [
      ['counted', () => missing],
      ['recounted', () => recount],
      ['newCounted', uncounted],
      ['backfilled', backfillTags],
      ['recounted', oldRows],
    ];
    let outOfTime = false;
    for (const [field, load] of queues) {
      const list = await load();
      for (const [i, tag] of list.entries()) {
        if (now().getTime() - started.getTime() >= budgetMs) {
          summary.left += list.length - i;
          outOfTime = true;
          break;
        }
        const at = Date.now();
        try {
          await recountTag(db, tag, now(), timeoutSeconds);
          (summary[field] as number)++;
        } catch (e) {
          if (!isTimeout(e)) throw e;
          summary.timedOut++;
          log({ tag }, 'tag history recount timed out');
        }
        await new Promise((r) => setTimeout(r, Math.min(restMs, Math.max(50, 3 * (Date.now() - at)))));
      }
      if (outOfTime) break;
    }
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'ok', detail: JSON.stringify(summary) })
      .where(eq(jobRuns.id, run.id));
    log(summary, 'tag history job finished');
    return summary;
  } catch (error) {
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'failed', detail: String((error as Error).message) })
      .where(eq(jobRuns.id, run.id));
    throw error;
  }
}
