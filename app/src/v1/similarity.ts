import { and, between, eq, gte, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import baseline from '../../data/traffic-baseline.json' with { type: 'json' };
import { sourcesInGroup } from '../crawl/registry.ts';
import type { Db } from '../db/client.ts';
import { articleCitations, articleSketches, articles, similarityPairs } from '../db/schema.ts';
import { syndicationMedia } from '../jobs/similarity-job.ts';
import { outletIdentity } from '../similarity/attribution.ts';
import { METHOD } from '../similarity/compute.ts';
import { classifyRelation } from '../similarity/relation.ts';
import {
  type EvidenceFilter,
  type IndexView,
  loadArticles,
  loadEvidence,
  loadIndexView,
  type StoredPair,
  WINDOW_DAYS,
} from '../similarity/store.ts';
import type { ArticleSimilarity, SimilarityArticle, SimilarityDaily, SimilarityData } from '../similarity/types.ts';
import { taipeiDay } from './event-archive.ts';

const HOUR = 3600e3,
  DAY = 24 * HOUR,
  TPE = 8 * HOUR;
export const MAX_RANGE_DAYS = 31;
export const MAX_DAILY_DAYS = 366;
const isDay = (value: string | undefined): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && value >= '2000-01-01';
const dayStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - TPE);
// DATETIME has second precision: the last second of a Taipei day.
const dayEnd = (day: string) => new Date(dayStart(day).getTime() + DAY - 1000);
const spanDays = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;

export interface SimilarityParams {
  hours: number | null;
  days: { from: string; to: string } | null;
  from: Date;
  to: Date;
  threshold: number;
}
/** A rolling window (`hours`, 1–168) or Taipei dates (`from`/`to`, up to 31 days), and a threshold 0.5–1. */
export function similarityParams(
  query: { hours?: string; from?: string; to?: string; threshold?: string },
  now = new Date(),
): SimilarityParams | null {
  const threshold = Number(query.threshold ?? 0.65);
  if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1) return null;
  if (query.from !== undefined || query.to !== undefined) {
    const { from, to } = query;
    if (query.hours !== undefined || !isDay(from) || !isDay(to) || from > to || spanDays(from, to) > MAX_RANGE_DAYS) return null;
    return { hours: null, days: { from, to }, from: dayStart(from), to: dayEnd(to), threshold };
  }
  const hours = Number(query.hours ?? 48);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) return null;
  return { hours, days: null, from: new Date(now.getTime() - hours * HOUR), to: now, threshold };
}

// Share pending requests and expire rolling windows after one minute (the
// index runs every ten); past date ranges change only while late articles arrive.
const views = new Map<string, { at: number; ttl: number; value: Promise<IndexView> }>();
export function cachedIndexView(db: Db, params: SimilarityParams): Promise<IndexView> {
  const key = `${params.hours ?? `${params.days!.from}/${params.days!.to}`}:${params.threshold}`;
  let entry = views.get(key);
  if (!entry || Date.now() - entry.at > entry.ttl) {
    if (views.size >= 12) views.delete(views.keys().next().value as string);
    entry = { at: Date.now(), ttl: params.hours ? 60e3 : 600e3, value: loadIndexView(db, params.from, params.to, params.threshold) };
    views.set(key, entry);
    entry.value.catch(() => views.delete(key));
  }
  return entry.value;
}

export async function loadSimilarity(db: Db, params: SimilarityParams): Promise<SimilarityData> {
  const window = and(gte(articles.publishedAt, params.from), sql`${articles.publishedAt} <= ${params.to}`);
  const [counts, view] = await Promise.all([
    db
      .select({
        media: articles.media,
        total: sql<number>`COUNT(*)`,
        fetched: sql<number>`SUM(${articles.contentFetchedAt} IS NOT NULL)`,
        usable: sql<number>`SUM(${articles.bodyStatus} = 'ok' AND ${articles.body} IS NOT NULL)`,
        indexed: sql<number>`SUM(${articles.bodyStatus} = 'ok' AND ${articles.body} IS NOT NULL AND ${articles.similarityAt} IS NOT NULL)`,
        withAuthors: sql<number>`SUM(JSON_LENGTH(${articles.authors}) > 0 OR COALESCE(${articles.creator}, '') <> '')`,
      })
      .from(articles)
      .where(window)
      .groupBy(articles.media),
    cachedIndexView(db, params),
  ]);
  const active = new Set([...sourcesInGroup('news'), ...sourcesInGroup('hourly')].map((s) => s.media));
  const allMedia = new Set([...baseline.sources.map((s) => s.media), ...counts.map((s) => s.media)]);
  const coverage = [...allMedia].map((media) => {
    const c = counts.find((c) => c.media === media);
    const total = Number(c?.total ?? 0),
      fetched = Number(c?.fetched ?? 0),
      usable = Number(c?.usable ?? 0);
    return {
      media,
      name: outletIdentity(media).name,
      total,
      fetched,
      usable,
      indexed: Number(c?.indexed ?? 0),
      withAuthors: Number(c?.withAuthors ?? 0),
      missing: fetched - usable,
      pending: total - fetched,
      enabled: active.has(media),
      excludedFromStatistics: syndicationMedia.has(media),
    };
  });
  const counted = coverage.filter((c) => !c.excludedFromStatistics);
  return {
    generatedAt: new Date().toISOString(),
    hours: params.hours,
    days: params.days,
    from: params.from.toISOString(),
    to: params.to.toISOString(),
    threshold: params.threshold,
    method: METHOD,
    coverage,
    index: {
      available: counted.reduce((sum, c) => sum + c.usable, 0),
      analyzed: [...view.analyzed.values()].reduce((sum, n) => sum + n, 0),
      pending: counted.reduce((sum, c) => sum + c.usable - c.indexed, 0),
      pairs: view.pairs.length,
      groups: view.groups.length,
      citations: view.citations.length,
      windowDays: WINDOW_DAYS,
    },
    nodes: view.nodes,
    edges: view.edges,
  };
}

const mediaList = (value: string | undefined) => (value ? new Set(value.split(',').filter(Boolean).slice(0, 500)) : undefined);
export function evidenceFilter(query: Record<string, string | undefined>): EvidenceFilter | null {
  if (query.edgeRelation && !['attributed', 'same-byline', 'unattributed'].includes(query.edgeRelation)) return null;
  if (query.edgeDirected !== undefined && !['true', 'false'].includes(query.edgeDirected)) return null;
  if (query.relation && !['attributed', 'same-byline', 'unattributed'].includes(query.relation)) return null;
  const mode = query.mode ?? 'all',
    direction = query.direction ?? 'all',
    page = Number(query.page ?? 0),
    q = query.q ?? '';
  if (!['all', 'similarity', 'citation'].includes(mode) || !['all', 'outgoing', 'incoming'].includes(direction)) return null;
  if (!Number.isInteger(page) || page < 0 || page > 100_000 || q.length > 100) return null;
  let edge: EvidenceFilter['edge'];
  if (query.edgeKind !== undefined || query.source !== undefined || query.target !== undefined) {
    if ((query.edgeKind !== 'similarity' && query.edgeKind !== 'citation') || !query.source || !query.target || query.node) return null;
    edge = {
      kind: query.edgeKind,
      source: query.source,
      target: query.target,
      relation: query.edgeRelation as EvidenceFilter['relation'],
      directed: query.edgeDirected === undefined ? undefined : query.edgeDirected === 'true',
    };
  }
  return {
    mode: mode as EvidenceFilter['mode'],
    relation: query.relation as EvidenceFilter['relation'],
    direction: direction as EvidenceFilter['direction'],
    node: query.node || undefined,
    edge,
    scope: mediaList(query.scope),
    focus: mediaList(query.focus),
    query: q,
    page,
  };
}

/** Distinct articles per day and category; ties and pending dates do not imply order. */
export function dailyRelationCounts(pairs: StoredPair[], known: Map<number, SimilarityArticle>) {
  type Category = 'copied' | 'copying' | 'sameByline' | 'attributed' | 'unattributed';
  const counts = new Map<string, { day: string; media: string; category: Category; ids: Set<number> }>();
  const add = (article: SimilarityArticle, category: Category) => {
    const day = taipeiDay(new Date(article.publishedAt));
    const key = `${day}:${article.media}:${category}`;
    const row = counts.get(key) ?? { day, media: article.media, category, ids: new Set<number>() };
    row.ids.add(article.id);
    counts.set(key, row);
  };
  for (const pair of pairs) {
    const a = known.get(pair.aId),
      b = known.get(pair.bId);
    if (!a || !b || a.media === b.media) continue;
    const relation = classifyRelation(a, b);
    const category = relation.kind === 'attributed' ? 'attributed' : relation.kind === 'same-byline' ? 'sameByline' : 'unattributed';
    add(a, category);
    add(b, category);
    if (relation.kind !== 'unattributed' || relation.sharedAuthors.length) continue;
    if (relation.publication === 'a-earlier') {
      add(a, 'copied');
      add(b, 'copying');
    }
    if (relation.publication === 'b-earlier') {
      add(b, 'copied');
      add(a, 'copying');
    }
  }
  return [...counts.values()].map(({ ids, ...row }) => ({ ...row, count: ids.size }));
}

/** Bound hydration to 31-day slices even for a full year; each own publication day belongs to one slice. */
async function loadDailyRelations(db: Db, first: string, last: string, threshold: number) {
  const result: ReturnType<typeof dailyRelationCounts> = [];
  for (let start = dayStart(first).getTime(); start <= dayEnd(last).getTime(); start += 31 * DAY) {
    const from = taipeiDay(new Date(start));
    const to = taipeiDay(new Date(Math.min(start + 31 * DAY - 1000, dayEnd(last).getTime())));
    const relationPairs = await db
      .select({
        aId: similarityPairs.aId,
        bId: similarityPairs.bId,
        aMedia: similarityPairs.aMedia,
        bMedia: similarityPairs.bMedia,
        aPublished: similarityPairs.aPublished,
        bPublished: similarityPairs.bPublished,
        score: similarityPairs.score,
        containment: similarityPairs.containment,
        shared: similarityPairs.shared,
        kind: similarityPairs.kind,
        evidence: similarityPairs.evidence,
      })
      .from(similarityPairs)
      .where(
        and(
          or(
            between(similarityPairs.aPublished, dayStart(from), dayEnd(to)),
            between(similarityPairs.bPublished, dayStart(from), dayEnd(to)),
          ),
          gte(similarityPairs.score, threshold),
        ),
      );
    const known = await loadArticles(
      db,
      relationPairs.flatMap((pair) => [pair.aId, pair.bId]),
    );
    result.push(...dailyRelationCounts(relationPairs, known).filter((row) => row.day >= from && row.day <= to));
  }
  return result;
}

export async function loadDaily(db: Db, from: string, to: string, threshold: number): Promise<SimilarityDaily> {
  const days: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY)
    days.push(new Date(t).toISOString().slice(0, 10));
  const position = new Map(days.map((day, i) => [day, i]));
  const localDay = sql<string>`DATE_FORMAT(${articleSketches.publishedAt} + INTERVAL 8 HOUR, '%Y-%m-%d')`;
  const [analyzed, pairs, citations, relations] = await Promise.all([
    db
      .select({ day: localDay, media: articleSketches.media, n: sql<number>`COUNT(*)` })
      .from(articleSketches)
      .where(between(articleSketches.publishedAt, dayStart(from), dayEnd(to)))
      .groupBy(localDay, articleSketches.media),
    db
      .select({
        day: similarityPairs.day,
        a: similarityPairs.aMedia,
        b: similarityPairs.bMedia,
        n: sql<number>`COUNT(*)`,
        identical: sql<number>`SUM(${similarityPairs.kind} = 'identical')`,
      })
      .from(similarityPairs)
      .where(and(between(similarityPairs.day, from, to), gte(similarityPairs.score, threshold)))
      .groupBy(similarityPairs.day, similarityPairs.aMedia, similarityPairs.bMedia),
    db
      .select({ day: articleCitations.day, media: articleCitations.media, source: articleCitations.source, n: sql<number>`COUNT(*)` })
      .from(articleCitations)
      .where(between(articleCitations.day, from, to))
      .groupBy(articleCitations.day, articleCitations.media, articleCitations.source),
    loadDailyRelations(db, from, to, threshold),
  ]);
  const zeros = () => days.map(() => 0);
  const totals = { articles: zeros(), pairs: zeros(), identical: zeros(), citations: zeros() };
  const perMedia = new Map<string, SimilarityDaily['media'][number]>();
  const media = (id: string) => {
    if (!perMedia.has(id))
      perMedia.set(id, {
        media: id,
        name: outletIdentity(id).name,
        articles: zeros(),
        pairs: zeros(),
        sameByline: zeros(),
        attributed: zeros(),
        unattributed: zeros(),
        copied: zeros(),
        copying: zeros(),
        citing: zeros(),
        cited: zeros(),
      });
    return perMedia.get(id)!;
  };
  for (const row of analyzed) {
    const i = position.get(row.day);
    if (i === undefined) continue;
    totals.articles[i] += Number(row.n);
    media(row.media).articles[i] += Number(row.n);
  }
  for (const row of pairs) {
    const i = position.get(String(row.day));
    if (i === undefined) continue;
    totals.pairs[i] += Number(row.n);
    totals.identical[i] += Number(row.identical ?? 0);
    media(row.a).pairs[i] += Number(row.n);
    media(row.b).pairs[i] += Number(row.n);
  }
  for (const row of relations) {
    const i = position.get(row.day);
    if (i === undefined) continue;
    media(row.media)[row.category]![i] += row.count;
  }
  for (const row of citations) {
    const i = position.get(String(row.day));
    if (i === undefined) continue;
    totals.citations[i] += Number(row.n);
    media(row.media).citing[i] += Number(row.n);
    media(row.source).cited[i] += Number(row.n);
  }
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  return {
    from,
    to,
    threshold,
    days,
    totals,
    media: [...perMedia.values()].sort(
      (a, b) => sum(b.articles) - sum(a.articles) || sum(b.cited) - sum(a.cited) || a.media.localeCompare(b.media),
    ),
  };
}

export async function loadArticleSimilarity(db: Db, id: number, threshold: number): Promise<ArticleSimilarity | null> {
  const [row] = await db
    .select({ id: articles.id, similarityAt: articles.similarityAt, chars: articleSketches.chars })
    .from(articles)
    .leftJoin(articleSketches, eq(articleSketches.articleId, articles.id))
    .where(eq(articles.id, id))
    .limit(1);
  if (!row) return null;
  const pairs = await db
    .select({
      aId: similarityPairs.aId,
      bId: similarityPairs.bId,
      score: similarityPairs.score,
      containment: similarityPairs.containment,
      kind: similarityPairs.kind,
      evidence: similarityPairs.evidence,
    })
    .from(similarityPairs)
    .where(and(or(eq(similarityPairs.aId, id), eq(similarityPairs.bId, id)), gte(similarityPairs.score, threshold)));
  const others = await loadArticles(db, [id, ...pairs.map((p) => (p.aId === id ? p.bId : p.aId))]);
  return {
    articleId: id,
    threshold,
    indexedAt: row.similarityAt?.toISOString() ?? null,
    chars: row.chars ?? null,
    windowDays: WINDOW_DAYS,
    matches: pairs
      .flatMap((p) => {
        const article = others.get(p.aId === id ? p.bId : p.aId);
        return article
          ? [
              {
                article,
                relation: others.get(id) ? classifyRelation(others.get(id)!, article) : undefined,
                score: p.score,
                containment: p.containment,
                kind: p.kind === 'identical' ? ('identical' as const) : ('high' as const),
                evidence: p.evidence,
              },
            ]
          : [];
      })
      .sort((a, b) => b.score - a.score || a.article.publishedAt.localeCompare(b.article.publishedAt)),
  };
}

const PARAMS_ERROR = 'hours must be an integer 1–168, or from/to Taipei dates (YYYY-MM-DD) up to 31 days apart; threshold must be 0.5–1';
export function registerSimilarity(app: FastifyInstance, db: Db) {
  app.get<{ Querystring: Record<string, string | undefined> }>('/api/v1/similarity', async (request, reply) => {
    const params = similarityParams(request.query);
    if (!params) return reply.code(400).send({ error: PARAMS_ERROR });
    const data = await loadSimilarity(db, params);
    reply.header('cache-control', params.hours ? 'public, max-age=60' : 'public, max-age=600');
    return data;
  });
  app.get<{ Querystring: Record<string, string | undefined> }>('/api/v1/similarity/evidence', async (request, reply) => {
    const { mode, relation, node, edgeKind, edgeRelation, edgeDirected, source, target, direction, scope, focus, q, page, ...window } =
      request.query;
    const params = similarityParams(window);
    const filter = evidenceFilter({
      mode,
      relation,
      node,
      edgeKind,
      edgeRelation,
      edgeDirected,
      source,
      target,
      direction,
      scope,
      focus,
      q,
      page,
    });
    if (!params || !filter) return reply.code(400).send({ error: `${PARAMS_ERROR}; see the OpenAPI document for evidence filters` });
    const data = await loadEvidence(db, await cachedIndexView(db, params), filter);
    reply.header('cache-control', params.hours ? 'public, max-age=60' : 'public, max-age=600');
    return data;
  });
  app.get<{ Querystring: { from?: string; to?: string; threshold?: string } }>('/api/v1/similarity/daily', async (request, reply) => {
    const today = taipeiDay(new Date());
    const to = request.query.to ?? today,
      from = request.query.from ?? new Date(Date.parse(`${to}T00:00:00Z`) - 29 * DAY).toISOString().slice(0, 10);
    const threshold = Number(request.query.threshold ?? 0.65);
    if (
      !isDay(from) ||
      !isDay(to) ||
      from > to ||
      spanDays(from, to) > MAX_DAILY_DAYS ||
      !Number.isFinite(threshold) ||
      threshold < 0.5 ||
      threshold > 1
    )
      return reply.code(400).send({ error: 'from/to must be Taipei dates (YYYY-MM-DD) up to 366 days apart; threshold must be 0.5–1' });
    reply.header('cache-control', to >= today ? 'public, max-age=300' : 'public, max-age=3600');
    return loadDaily(db, from, to, threshold);
  });
  app.get<{ Params: { id: string }; Querystring: { threshold?: string } }>('/api/v1/articles/:id/similarity', async (request, reply) => {
    const id = Number(request.params.id),
      threshold = Number(request.query.threshold ?? 0.65);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isFinite(threshold) || threshold < 0.5 || threshold > 1)
      return reply.code(400).send({ error: 'id must be a positive integer; threshold must be 0.5–1' });
    const data = await loadArticleSimilarity(db, id, threshold);
    if (!data) return reply.code(404).send({ error: 'article not found' });
    reply.header('cache-control', 'public, max-age=300');
    return data;
  });
}
