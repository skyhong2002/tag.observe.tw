import { and, desc, eq, gte, sql } from 'drizzle-orm';
import catalog from '../../data/media-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, jobRuns, rankingEntries, rankingSnapshots } from '../db/schema.ts';
import { computeRanking, type RankingChart } from './ranking-compute.ts';

const categories = catalog.categories as Record<string, string[]>;
// 'all' merges every media list; each category uses its own list. Scores are
// normalized by the media that actually published (see computeRanking).
export const RANKING_CATEGORIES: Record<string, { media: string[] }> = {
  all: { media: [...new Set(Object.values(categories).flat())] },
  ...Object.fromEntries(Object.entries(categories).map(([name, media]) => [name, { media }])),
};
export const HOURS = 24;
export const hourStart = (d: Date) => new Date(Math.floor(d.getTime() / 3600e3) * 3600e3);

export interface TagRow {
  newsid: number;
  media: string;
  createTime: Date;
  tags: string;
  title: string | null;
  url: string | null;
  image: string | null;
}
export interface RankingJobDeps {
  db: Db;
  now?: () => Date;
  log?: (o: object, msg: string) => void;
}

// Rows produced by the Node crawlers. Tags are re-encoded to the legacy
// "[a][b]" form so computeRanking runs the identical algorithm.
export async function readOwnTagRows(db: Db, media: readonly string[], since: Date): Promise<TagRow[]> {
  const rows = await db
    .select({
      id: articles.id,
      media: articles.media,
      publishedAt: articles.publishedAt,
      tags: articles.tags,
      title: articles.title,
      url: articles.url,
      image: articles.image,
    })
    .from(articles)
    .where(
      and(
        gte(articles.publishedAt, since),
        sql`${articles.media} IN (${sql.join(
          media.map((m) => sql`${m}`),
          sql`, `,
        )})`,
        sql`JSON_LENGTH(${articles.tags}) > 0`,
      ),
    );
  return rows.map((r) => ({
    newsid: r.id,
    media: r.media,
    createTime: r.publishedAt,
    tags: r.tags.map((t) => `[${t}]`).join(''),
    title: r.title,
    url: r.url,
    image: r.image,
  }));
}

export async function runRankingJob({ db, now = () => new Date(), log = () => {} }: RankingJobDeps, only?: string[]) {
  const started = now();
  const [run] = await db.insert(jobRuns).values({ name: 'ranking', startedAt: started, status: 'running' }).$returningId();
  try {
    const since = new Date(started.getTime() - HOURS * 3600e3);
    const t0 = performance.now();
    const rows = await readOwnTagRows(db, RANKING_CATEGORIES.all.media, since);
    const readMs = Math.round(performance.now() - t0);
    log({ rows: rows.length, readMs }, 'tag rows read');
    const byMedia = new Map<string, TagRow[]>();
    for (const r of rows) {
      const list = byMedia.get(r.media) ?? [];
      list.push(r);
      byMedia.set(r.media, list);
    }
    const hour = hourStart(started);
    const results: Record<string, { entries: number; articles: number }> = {};
    for (const [category, spec] of Object.entries(RANKING_CATEGORIES)) {
      if (only && !only.includes(category)) continue;
      const t1 = performance.now();
      const source = spec.media.flatMap((m) => byMedia.get(m) ?? []);
      const chart = computeRanking(source, { hours: HOURS });
      await storeSnapshot(db, category, hour, started, chart, Math.round(performance.now() - t1) + readMs);
      results[category] = { entries: chart.entries.length, articles: chart.articleCount };
    }
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'ok', detail: JSON.stringify({ readMs, rows: rows.length, results }) })
      .where(eq(jobRuns.id, run.id));
    return { rows: rows.length, readMs, results };
  } catch (error) {
    await db
      .update(jobRuns)
      .set({ finishedAt: now(), status: 'failed', detail: String((error as Error)?.message ?? error) })
      .where(eq(jobRuns.id, run.id));
    throw error;
  }
}

export async function storeSnapshot(db: Db, category: string, hour: Date, computedAt: Date, chart: RankingChart, durationMs: number) {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: rankingSnapshots.id })
      .from(rankingSnapshots)
      .where(and(eq(rankingSnapshots.category, category), eq(rankingSnapshots.hourStart, hour)))
      .limit(1);
    let id: number;
    const values = {
      category,
      hourStart: hour,
      computedAt,
      hours: chart.hours,
      weight: chart.weight,
      mediaCount: chart.mediaCount,
      articleCount: chart.articleCount,
      durationMs,
      chart: JSON.stringify(chart),
    };
    if (existing.length) {
      id = existing[0].id;
      await tx.update(rankingSnapshots).set(values).where(eq(rankingSnapshots.id, id));
      await tx.delete(rankingEntries).where(eq(rankingEntries.snapshotId, id));
    } else {
      [{ id }] = await tx.insert(rankingSnapshots).values(values).$returningId();
    }
    for (let i = 0; i < chart.entries.length; i += 200) {
      await tx
        .insert(rankingEntries)
        .values(
          chart.entries
            .slice(i, i + 200)
            .map((e) => ({ snapshotId: id, rank: e.rank, tag: e.tag, score: Math.round(e.score * 1e6), count: e.count, media: e.media })),
        );
    }
  });
}

export async function latestSnapshot(db: Db, category: string) {
  const [row] = await db
    .select()
    .from(rankingSnapshots)
    .where(eq(rankingSnapshots.category, category))
    .orderBy(desc(rankingSnapshots.hourStart))
    .limit(1);
  return row ?? null;
}
