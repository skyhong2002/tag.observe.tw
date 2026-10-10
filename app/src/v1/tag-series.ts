import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.ts';
import { articles, articleTags, rankingEntries, rankingSnapshots } from '../db/schema.ts';
import { type RankingBasis, rankingBasis } from '../jobs/ranking-basis.ts';
import { rankingCategories } from '../jobs/ranking-job.ts';

const HOUR = 3600e3;
export interface HourlyCount {
  t: string;
  hourlyCount: number | null;
  average24h: number | null;
  score?: number | null;
  count?: number | null;
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
export async function loadHourlyTrends(db: Db, tags: string[], media: string[], from: Date, to: Date, basis?: RankingBasis) {
  if (basis) media = basis.media;
  if (!tags.length || !media.length) return new Map<string, HourlyCount[]>();
  const warmup = new Date(from.getTime() - 23 * HOUR);
  const bucket = sql<number>`FLOOR(TIMESTAMPDIFF(SECOND, ${warmup}, ${articleTags.publishedAt}) / 3600)`;
  // The indexed lookup uses the DB's case-insensitive collation. Keep distinct
  // stored spellings separate when aggregating, matching ranking's JS tag keys.
  const exactTag = sql<string>`${articleTags.tag} COLLATE utf8mb4_bin`;
  const rows = await db
    .select({ tag: exactTag, media: articles.media, bucket, count: sql<number>`COUNT(DISTINCT ${articleTags.articleId})` })
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
    .groupBy(exactTag, articles.media, bucket);
  const counts = new Map(tags.map((tag) => [tag, new Map<number, number>()]));
  const outlets = new Map(tags.map((tag) => [tag, new Map<string, Map<number, number>>()]));
  for (const r of rows) {
    const t = warmup.getTime() + Number(r.bucket) * HOUR;
    const total = counts.get(r.tag);
    if (!total) continue; // SQL may also match unrequested case/accent variants.
    total.set(t, (total.get(t) ?? 0) + Number(r.count));
    const byMedia = outlets.get(r.tag)!;
    if (!byMedia.has(r.media)) byMedia.set(r.media, new Map());
    byMedia.get(r.media)!.set(t, Number(r.count));
  }
  return new Map(
    tags.map((tag) => {
      const points = hourlyMovingAverage(counts.get(tag)!, from, to);
      const mediaAverages = [...outlets.get(tag)!.values()].map((c) => hourlyMovingAverage(c, from, to));
      return [
        tag,
        points.map((p, i) => {
          if (!basis) return p;
          const available = Date.parse(p.t) + HOUR >= Date.parse(basis.validFrom);
          const hourlyAvailable = Date.parse(p.t) >= Date.parse(basis.coverageFrom);
          const raw = mediaAverages.reduce((s, a) => s + 2 * (1 - 0.5 ** ((a[i].average24h ?? 0) * 24)), 0);
          return {
            ...p,
            hourlyCount: hourlyAvailable ? p.hourlyCount : null,
            average24h: available ? p.average24h : null,
            count: available ? Math.round((p.average24h ?? 0) * 24) : null,
            score: available ? (raw / basis.media.length) * 50 : null,
          };
        }),
      ];
    }),
  );
}

// Use completed hours: an unfinished hour would create a false drop at the end.
export function completedHourWindow(now: Date, hours: number) {
  const to = new Date(Math.floor(now.getTime() / HOUR) * HOUR);
  return { from: new Date(to.getTime() - hours * HOUR), to };
}

/**
 * Score rank per snapshot hour for one tag in one category, from the stored
 * hourly charts. Hours where the tag was below the stored cut-off are absent.
 */
export async function loadHourlyRanks(db: Db, tag: string, category: string, from: Date, to: Date): Promise<Map<string, number>> {
  const rows = await db
    .select({
      tag: sql<string>`${rankingEntries.tag} COLLATE utf8mb4_bin`,
      hourStart: rankingSnapshots.hourStart,
      rank: rankingEntries.rank,
    })
    .from(rankingEntries)
    .innerJoin(rankingSnapshots, eq(rankingSnapshots.id, rankingEntries.snapshotId))
    .where(
      and(
        eq(rankingEntries.tag, tag),
        eq(rankingSnapshots.category, category),
        gte(rankingSnapshots.hourStart, from),
        lt(rankingSnapshots.hourStart, to),
      ),
    );
  const out = new Map<string, number>();
  for (const r of rows) if (r.tag === tag) out.set(r.hourStart.toISOString(), r.rank);
  return out;
}

export function registerTagSeries(app: FastifyInstance, db: Db) {
  app.get<{ Params: { tag: string }; Querystring: { category?: string; hours?: string; until?: string } }>(
    '/api/v1/tags/:tag/series',
    async (request, reply) => {
      const tag = request.params.tag.slice(0, 60);
      const category = request.query.category ?? 'all';
      if (!rankingCategories()[category]) return reply.code(404).send({ error: 'unknown category' });
      const hours = request.query.hours === undefined ? 72 : Number(request.query.hours);
      const now = new Date();
      const until = request.query.until === undefined ? now : new Date(request.query.until);
      if (!Number.isInteger(hours) || hours < 1 || hours > 336) return reply.code(400).send({ error: 'bad hours' });
      if (!Number.isFinite(until.getTime()) || until > now) return reply.code(400).send({ error: 'bad until' });
      const { from, to } = completedHourWindow(until, hours);
      const basis = rankingBasis(category);
      const [trends, ranks] = await Promise.all([
        loadHourlyTrends(db, [tag], basis.media, from, to, basis),
        loadHourlyRanks(db, tag, category, from, to),
      ]);
      const points = (trends.get(tag) ?? []).map((p) => ({ ...p, rank: ranks.get(p.t) ?? null }));
      reply.header('cache-control', 'public, max-age=300');
      return {
        tag,
        category,
        hours,
        from: from.toISOString(),
        to: to.toISOString(),
        hasMore: from.getTime() > Date.parse(basis.coverageFrom),
        basis,
        points,
      };
    },
  );
}
