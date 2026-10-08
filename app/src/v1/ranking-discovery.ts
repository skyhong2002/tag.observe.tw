import { and, asc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import pLimit from 'p-limit';
import type { Db } from '../db/client.ts';
import { articles, articleTags, similarityPairs } from '../db/schema.ts';
import type { BurstEntry, RankingChart } from '../jobs/ranking-compute.ts';
import { qualifyTagMedia } from '../jobs/tag-qualification.ts';

export type RankingGate = 'all' | 'early' | 'broad';
export type RankingOrder = 'burst' | 'score' | 'growth';
export const SIMILAR_DRAFT_THRESHOLD = 0.85;
const DAY = 24 * 3600e3;

export interface DiscoverySignals {
  growth: number | null;
  early: boolean;
  broad: boolean;
  earlyJump: boolean | null;
  broadJump: boolean | null;
}

/** A missing/truncated/incompatible old chart cannot prove a threshold crossing. */
export function discoverySignals(entry: BurstEntry, previous: RankingChart | null | undefined, basisId: string) {
  const qualified = qualifyTagMedia(entry.media);
  const comparable = previous?.available !== false && previous?.basis?.id === basisId;
  const old = comparable ? previous?.entries.find((e) => e.tag === entry.tag) : undefined;
  const known = comparable && (old !== undefined || previous?.truncated === false);
  const before = old ? qualifyTagMedia(old.media) : { early: false, broad: false };
  return {
    growth: entry.burst === null ? null : entry.burst - entry.normalized,
    ...qualified,
    earlyJump: !qualified.early ? false : known ? !before.early : null,
    broadJump: !qualified.broad ? false : known ? !before.broad : null,
  } satisfies DiscoverySignals;
}

/** Filter the complete stored ranking BEFORE sorting or applying the page limit. */
export function selectDiscoveryEntries<T extends { normalized: number; burst: number | null; signals: DiscoverySignals }>(
  entries: T[],
  order: RankingOrder,
  gate: RankingGate,
) {
  const eligible = entries.filter((e) => (gate === 'all' || e.signals[gate]) && (order !== 'growth' || (e.signals.growth ?? 0) > 0));
  const value = (e: T) => (order === 'growth' ? e.signals.growth : order === 'score' ? e.normalized : e.burst) ?? -Infinity;
  return eligible.sort((a, b) => value(b) - value(a) || b.normalized - a.normalized);
}

export interface FirstCollection {
  at: string;
  firstPublishedAt: string;
  recent: boolean;
}

/** Backfilled old reports must never become a newly discovered topic. */
export function firstCollection(firstCollectedAt: Date, firstPublishedAt: Date, to: Date): FirstCollection {
  const since = to.getTime() - DAY;
  return {
    at: firstCollectedAt.toISOString(),
    firstPublishedAt: firstPublishedAt.toISOString(),
    recent: firstCollectedAt.getTime() > since && firstCollectedAt <= to && firstPublishedAt.getTime() > since && firstPublishedAt <= to,
  };
}

export interface DraftEvidence {
  articles: number;
  analyzed: number;
  similarArticles: number;
  groups: number;
  threshold: number;
}

/** Connected components describe similar drafts, not independent reporting or plagiarism. */
export function summarizeDrafts(
  ids: ReadonlySet<number>,
  analyzed: ReadonlySet<number>,
  pairs: ReadonlyArray<{ aId: number; bId: number }>,
): DraftEvidence {
  const parent = new Map<number, number>();
  const root = (id: number): number => {
    let current = id;
    while (parent.has(current) && parent.get(current) !== current) current = parent.get(current)!;
    return current;
  };
  for (const { aId, bId } of pairs) {
    if (!ids.has(aId) || !ids.has(bId)) continue;
    const a = root(aId),
      b = root(bId);
    parent.set(aId, a);
    parent.set(bId, b);
    if (a !== b) parent.set(b, a);
  }
  return {
    articles: ids.size,
    analyzed: [...ids].filter((id) => analyzed.has(id)).length,
    similarArticles: parent.size,
    groups: new Set([...parent.keys()].map(root)).size,
    threshold: SIMILAR_DRAFT_THRESHOLD,
  };
}

type Evidence = { firstCollection: FirstCollection | null; drafts: DraftEvidence };
const cache = new WeakMap<Db, Map<string, { until: number; result: Promise<Map<string, Evidence>> }>>();

export function loadDiscoveryEvidence(db: Db, tags: string[], media: string[], from: Date, to: Date) {
  if (!tags.length || !media.length) return Promise.resolve(new Map<string, Evidence>());
  let saved = cache.get(db);
  if (!saved) {
    saved = new Map();
    cache.set(db, saved);
  }
  const key = JSON.stringify([[...tags].sort(), [...media].sort(), from.toISOString(), to.toISOString()]);
  const existing = saved.get(key);
  if (existing && existing.until > Date.now()) return existing.result;
  // Bound retained request results; errors are never cached.
  if (saved.size >= 32) saved.delete(saved.keys().next().value!);
  const result = readDiscoveryEvidence(db, tags, media, from, to).catch((error) => {
    saved.delete(key);
    throw error;
  });
  saved.set(key, { until: Date.now() + 60_000, result });
  return result;
}

async function readDiscoveryEvidence(db: Db, tags: string[], media: string[], from: Date, to: Date): Promise<Map<string, Evidence>> {
  const exactTag = sql<string>`${articleTags.tag} COLLATE utf8mb4_bin`;
  const firstLimit = pLimit(3);
  const [first, current, pairs] = await Promise.all([
    Promise.all(
      tags.map((tag) =>
        firstLimit(async (): Promise<[string, FirstCollection | null]> => {
          // tag_published gives one indexed seek per keyword. Do not aggregate years
          // of a popular tag's articles just to discover that it is already old.
          const [oldest] = await db
            .select({ published: articleTags.publishedAt })
            .from(articleTags)
            .innerJoin(articles, eq(articles.id, articleTags.articleId))
            .where(and(eq(articleTags.tag, tag), eq(exactTag, tag), lte(articles.crawledAt, to), lte(articleTags.publishedAt, to)))
            .orderBy(asc(articleTags.publishedAt))
            .limit(1);
          if (!oldest || oldest.published <= from) return [tag, null];
          const [recent] = await db
            .select({ collected: sql<Date>`MIN(${articles.crawledAt})` })
            .from(articleTags)
            .innerJoin(articles, eq(articles.id, articleTags.articleId))
            .where(
              and(
                eq(articleTags.tag, tag),
                eq(exactTag, tag),
                gte(articleTags.publishedAt, from),
                lte(articleTags.publishedAt, to),
                lte(articles.crawledAt, to),
              ),
            );
          return [tag, recent?.collected ? firstCollection(new Date(recent.collected), oldest.published, to) : null];
        }),
      ),
    ),
    db
      .select({ tag: exactTag, id: articles.id, analyzed: articles.similarityAt })
      .from(articleTags)
      .innerJoin(articles, eq(articles.id, articleTags.articleId))
      .where(
        and(
          inArray(articleTags.tag, tags),
          inArray(articles.media, media),
          eq(articles.source, 'own'),
          gte(articleTags.publishedAt, from),
          lt(articleTags.publishedAt, to),
          lte(articles.crawledAt, to),
        ),
      ),
    db
      .select({ aId: similarityPairs.aId, bId: similarityPairs.bId })
      .from(similarityPairs)
      .where(
        and(
          gte(similarityPairs.lastPublished, from),
          lt(similarityPairs.lastPublished, to),
          gte(similarityPairs.firstPublished, from),
          lte(similarityPairs.computedAt, to),
          inArray(similarityPairs.aMedia, media),
          inArray(similarityPairs.bMedia, media),
          gte(similarityPairs.score, SIMILAR_DRAFT_THRESHOLD),
        ),
      ),
  ]);
  const firstByTag = new Map(first);
  const byTag = new Map(tags.map((tag) => [tag, new Set<number>()]));
  const analyzed = new Set<number>();
  for (const row of current) {
    byTag.get(row.tag)?.add(row.id);
    if (row.analyzed && row.analyzed <= to) analyzed.add(row.id);
  }
  return new Map(
    tags.map((tag) => [
      tag,
      {
        firstCollection: firstByTag.get(tag) ?? null,
        drafts: summarizeDrafts(byTag.get(tag)!, analyzed, pairs),
      },
    ]),
  );
}
