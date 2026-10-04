// Content becomes a verified NAS-backed cache after 90 days without use.
// Missing/unavailable archive storage must never cause local content deletion.
// Only contentless, unarchived own-source sitemap noise can lose its index.
// - ranking snapshots older than 2 years: chart and entries trimmed to top 100
// - crawl_runs / job_runs / source_probes older than 30 days deleted
import { and, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import {
  articleArchives,
  articleOrigins,
  articleSketches,
  articles,
  articleTags,
  crawlRuns,
  jobRuns,
  rankingEntries,
  rankingSnapshots,
  rejectedUrls,
  sourceProbes,
} from '../db/schema.ts';
import { archiveColdContent, cacheAgeForSpace } from '../nearline/content.ts';
import type { ArchiveStore } from '../nearline/store.ts';
import type { RankingChart } from './ranking-compute.ts';

const DAY = 86400e3;
const affected = (r: unknown) => (r as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;

export async function runRetentionJob(
  db: Db,
  {
    now = () => new Date(),
    log = (_o: object, _m: string) => {},
    batch = 500,
    contentBatch = 5000,
    archiveStore,
  }: {
    now?: () => Date;
    log?: (o: object, m: string) => void;
    batch?: number;
    contentBatch?: number;
    archiveStore?: ArchiveStore;
  } = {},
) {
  if (!Number.isSafeInteger(contentBatch) || contentBatch < 1 || contentBatch > 50000)
    throw new Error('Content archive batch must be 1–50000');
  const t = now().getTime();
  const out: Record<string, number> = {};
  out.contentArchived = 0;
  out.contentEvicted = 0;
  out.archiveDisabled = archiveStore ? 0 : 1;
  out.cachePressurePages = 0;
  for (let remaining = contentBatch; remaining > 0 && archiveStore; ) {
    const free = await archiveStore.localFreeBytes?.();
    const age = cacheAgeForSpace(free);
    if (free !== undefined && free < 20 * 2 ** 30) out.cachePressurePages++;
    const content = await archiveColdContent(db, archiveStore, new Date(t), Math.min(remaining, 25), age);
    out.contentArchived += content.archived;
    out.contentEvicted += content.evicted;
    remaining -= content.archived;
    if (!content.archived || !content.evicted) break;
  }
  // The sketch row stays as the record that the article was compared.
  out.sketchesCleared = affected(
    await db.execute(
      sql`UPDATE ${articleSketches} s JOIN ${articles} a ON a.id = s.article_id SET s.sketch = NULL WHERE s.sketch IS NOT NULL AND a.body IS NULL`,
    ),
  );
  out.staleArticlesDeleted = 0;
  await db.transaction(async (tx) => {
    const stale = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(
        and(
          eq(articles.source, 'own'),
          lt(articles.publishedAt, new Date(t - 14 * DAY)),
          isNull(articles.fetchedAt),
          isNull(articles.body),
          isNull(articles.description),
          sql`JSON_LENGTH(${articles.tags}) = 0`,
          sql`NOT EXISTS (SELECT 1 FROM ${articleArchives} WHERE ${articleArchives.articleId} = ${articles.id})`,
          sql`NOT EXISTS (SELECT 1 FROM ${articleOrigins} WHERE ${articleOrigins.articleId} = ${articles.id})`,
        ),
      )
      .limit(batch)
      .for('update');
    if (!stale.length) return;
    const ids = stale.map((r) => r.id);
    await tx.delete(articleTags).where(inArray(articleTags.articleId, ids));
    out.staleArticlesDeleted = affected(await tx.delete(articles).where(inArray(articles.id, ids)));
  });
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
