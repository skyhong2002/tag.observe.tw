// Each keyword's whole archive (tag_history): the first article that ever
// carried it and the Taipei day with the most articles. A full recount groups
// all of a tag's article_tags rows by day along tag_published; most tags take
// milliseconds, the biggest (美國, about 500,000 rows) several seconds on a
// cold buffer pool. So recounts run one tag at a time with a rest between
// them and stop at the budget. Every hour the tags on the latest rankings
// that already have a row only recount their last two days (one batched
// query), new ranking tags are counted first, then tags that ever charted
// (tag_stats) are backfilled. Each row is fully recounted weekly to pick up
// late, edited or removed articles.
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
  const [first] = await db
    .select({ at: articleTags.publishedAt })
    .from(articleTags)
    .where(and(eq(articleTags.tag, tag), exact(tag)))
    .orderBy(asc(articleTags.publishedAt))
    .limit(1);
  const row = { firstAt: first.at, peakDay: peak.day, peakCount: peak.n, computedAt: now, updatedAt: now };
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
    budgetMs = 150_000,
    restMs = 200,
    timeoutSeconds = 30,
    backfill = 200,
  }: {
    now?: () => Date;
    log?: (o: object, m: string) => void;
    budgetMs?: number;
    restMs?: number;
    timeoutSeconds?: number;
    /** At most this many tag_stats tags without a row are read per run. */
    backfill?: number;
  } = {},
) {
  const started = now();
  const [run] = await db.insert(jobRuns).values({ name: 'tag-history', startedAt: started, status: 'running' }).$returningId();
  const summary = { rankingTags: 0, refreshed: 0, peaksMoved: 0, counted: 0, recounted: 0, backfilled: 0, timedOut: 0, left: 0 };
  try {
    const tags = await rankingTags(db);
    summary.rankingTags = tags.length;
    const known = new Map<string, typeof tagHistory.$inferSelect>();
    for (let i = 0; i < tags.length; i += 500) {
      const chunk = tags.slice(i, i + 500);
      for (const row of await db.select().from(tagHistory).where(inArray(tagHistory.tag, chunk))) known.set(row.tag, row);
    }
    const stale = new Date(started.getTime() - TAG_HISTORY_RECOUNT_DAYS * DAY);
    const current = [...known.values()].filter((r) => r.computedAt >= stale);
    for (let i = 0; i < current.length; i += 200) {
      summary.peaksMoved += await refreshRecentDays(db, current.slice(i, i + 200), now());
      summary.refreshed += Math.min(200, current.length - i);
    }
    const missing = tags.filter((t) => !known.has(t));
    const recount = [...known.values()].filter((r) => r.computedAt < stale).map((r) => r.tag);
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
    const queues: Array<[keyof typeof summary, () => Promise<string[]> | string[]]> = [
      ['counted', () => missing],
      ['recounted', () => recount],
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
        try {
          await recountTag(db, tag, now(), timeoutSeconds);
          summary[field]++;
        } catch (e) {
          if (!isTimeout(e)) throw e;
          summary.timedOut++;
          log({ tag }, 'tag history recount timed out');
        }
        await new Promise((r) => setTimeout(r, restMs));
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
