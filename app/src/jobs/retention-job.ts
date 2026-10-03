// Daily data retention (agreed 2026-09-29):
// - descriptions: dropped 90 days after publication
// - bodies: dropped 90 days after acquisition, including archived publications
// - never-fetched, untagged articles older than 14 days deleted (old sitemap noise)
// - ranking snapshots older than 2 years: chart and entries trimmed to top 100
// - crawl_runs / job_runs / source_probes older than 30 days deleted
import { and, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { articles, articleTags, crawlRuns, jobRuns, rankingEntries, rankingSnapshots, rejectedUrls, sourceProbes } from '../db/schema.ts';
import type { RankingChart } from './ranking-compute.ts';

const DAY = 86400e3;
const affected = (r: unknown) => (r as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;

export async function runRetentionJob(db: Db, { now = () => new Date(), log = (_o: object, _m: string) => {}, batch = 500 } = {}) {
  const t = now().getTime();
  const out: Record<string, number> = {};
  out.descriptionsCleared = affected(
    await db
      .update(articles)
      .set({ description: null })
      .where(and(lt(articles.publishedAt, new Date(t - 90 * DAY)), sql`${articles.description} IS NOT NULL`)),
  );
  out.bodiesCleared = affected(
    await db
      .update(articles)
      .set({ body: null, bodyStatus: 'expired' })
      .where(
        and(
          lt(sql`COALESCE(${articles.contentFetchedAt}, ${articles.crawledAt})`, new Date(t - 90 * DAY)),
          sql`${articles.body} IS NOT NULL`,
        ),
      ),
  );
  const stale = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(lt(articles.publishedAt, new Date(t - 14 * DAY)), isNull(articles.fetchedAt), sql`JSON_LENGTH(${articles.tags}) = 0`));
  out.staleArticlesDeleted = 0;
  for (let i = 0; i < stale.length; i += batch) {
    const ids = stale.slice(i, i + batch).map((r) => r.id);
    await db.delete(articleTags).where(inArray(articleTags.articleId, ids));
    out.staleArticlesDeleted += affected(await db.delete(articles).where(inArray(articles.id, ids)));
  }
  const old = await db
    .select({ id: rankingSnapshots.id, chart: rankingSnapshots.chart })
    .from(rankingSnapshots)
    .where(and(lt(rankingSnapshots.hourStart, new Date(t - 730 * DAY)), sql`JSON_LENGTH(${rankingSnapshots.chart}, '$.entries') > 100`))
    .limit(batch);
  for (const s of old) {
    const chart = JSON.parse(s.chart) as RankingChart;
    chart.entries = chart.entries.slice(0, 100);
    await db
      .update(rankingSnapshots)
      .set({ chart: JSON.stringify(chart) })
      .where(eq(rankingSnapshots.id, s.id));
    await db.delete(rankingEntries).where(and(eq(rankingEntries.snapshotId, s.id), gt(rankingEntries.rank, 100)));
  }
  out.snapshotsTrimmed = old.length;
  const cutoff = new Date(t - 30 * DAY);
  out.crawlRunsDeleted = affected(await db.delete(crawlRuns).where(lt(crawlRuns.startedAt, cutoff)));
  out.jobRunsDeleted = affected(await db.delete(jobRuns).where(lt(jobRuns.startedAt, cutoff)));
  out.probesDeleted = affected(await db.delete(sourceProbes).where(lt(sourceProbes.checkedAt, cutoff)));
  out.rejectedDeleted = affected(await db.delete(rejectedUrls).where(lt(rejectedUrls.createdAt, cutoff)));
  log(out, 'retention job finished');
  return out;
}
