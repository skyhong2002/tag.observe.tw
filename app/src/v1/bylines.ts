import { and, desc, gte, inArray, lt, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.ts';
import { articles } from '../db/schema.ts';
import { type BylineSummary, CREDIT_KINDS, type CreditEntity, type CreditKind, creditsOf } from '../journalists/credit-entities.ts';
import { isExcludedJournalist } from '../journalists/names.ts';
import { normalizeAttributions, outletIdentity } from '../similarity/attribution.ts';

export type { BylineSummary } from '../journalists/credit-entities.ts';

type CreditRow = { id: number; media: string; publishedAt: Date; authors: string[] | null; creator: string | null };

export function aggregateCredits(rows: CreditRow[]) {
  const entries = new Map<string, { entity: CreditEntity; ids: number[]; outlets: Map<string, number>; latest: Date }>();
  let credited = 0;
  for (const row of rows) {
    const entities = creditsOf(row);
    if (entities.length) credited++;
    for (const entity of entities) {
      const entry = entries.get(entity.key) ?? { entity, ids: [], outlets: new Map<string, number>(), latest: row.publishedAt };
      entry.ids.push(row.id);
      entry.outlets.set(row.media, (entry.outlets.get(row.media) ?? 0) + 1);
      entry.entity.roles = [...new Set([...entry.entity.roles, ...entity.roles])];
      if (row.publishedAt > entry.latest) entry.latest = row.publishedAt;
      entries.set(entity.key, entry);
    }
  }
  const summaries: BylineSummary[] = [...entries]
    .map(([key, entry]) => ({
      ...entry.entity,
      key,
      articles: entry.ids.length,
      latest: entry.latest.toISOString(),
      outlets: [...entry.outlets]
        .map(([media, count]) => ({ media, name: outletIdentity(media).name, count }))
        .sort((a, b) => b.count - a.count || a.media.localeCompare(b.media)),
    }))
    .sort((a, b) => b.articles - a.articles || a.name.localeCompare(b.name, 'zh-Hant'));
  return { entries, summaries, credited };
}

export function bylineParams(query: { hours?: string; page?: string; kind?: string; media?: string; q?: string }) {
  const hours = Number(query.hours ?? 48),
    page = Number(query.page ?? 0);
  if (!Number.isInteger(hours) || hours < 1 || hours > 720 || !Number.isInteger(page) || page < 0 || page > 10000) return null;
  if (query.kind && !CREDIT_KINDS.includes(query.kind as CreditKind)) return null;
  if (query.media && !/^[a-z0-9_-]{1,64}$/i.test(query.media)) return null;
  return { hours, page, kind: query.kind as CreditKind | undefined, media: query.media, q: query.q?.trim().slice(0, 120) ?? '' };
}

/** Read-only derivation from stored credits; no migration or crawler writes. */
export function registerBylines(app: FastifyInstance, db: Db) {
  const cache = new Map<number, { at: number; value: Promise<ReturnType<typeof aggregateCredits> & { generatedAt: string }> }>();
  const load = (hours: number) => {
    let entry = cache.get(hours);
    if (!entry || Date.now() - entry.at > 120000) {
      if (cache.size >= 8) cache.delete(cache.keys().next().value as number);
      const now = new Date();
      const value = db
        .select({
          id: articles.id,
          media: articles.media,
          publishedAt: articles.publishedAt,
          authors: articles.authors,
          creator: articles.creator,
        })
        .from(articles)
        .where(
          and(
            gte(articles.publishedAt, new Date(now.getTime() - hours * 3600000)),
            lt(articles.publishedAt, now),
            sql`(JSON_LENGTH(${articles.authors}) > 0 OR COALESCE(${articles.creator}, '') <> '')`,
          ),
        )
        .orderBy(desc(articles.publishedAt), desc(articles.id))
        .then((rows) => ({ ...aggregateCredits(rows), generatedAt: now.toISOString() }));
      entry = { at: Date.now(), value };
      cache.set(hours, entry);
      value.catch(() => {
        if (cache.get(hours)?.value === value) cache.delete(hours);
      });
    }
    return entry.value;
  };
  app.get<{ Querystring: { hours?: string; page?: string; kind?: string; media?: string; q?: string } }>(
    '/api/v1/bylines',
    async (request, reply) => {
      const params = bylineParams(request.query);
      if (!params) return reply.code(400).send({ error: 'invalid byline filters' });
      const data = await load(params.hours);
      const scope = data.summaries.filter(
        (entry) =>
          (entry.kind !== 'person' || !isExcludedJournalist(entry.name)) &&
          (!params.media || entry.outlets.some((outlet) => outlet.media === params.media)),
      );
      const counts = Object.fromEntries(CREDIT_KINDS.map((kind) => [kind, scope.filter((entry) => entry.kind === kind).length]));
      const filtered = scope.filter(
        (entry) =>
          (!params.kind || entry.kind === params.kind) &&
          (!params.q || entry.name.toLocaleLowerCase().includes(params.q.toLocaleLowerCase())),
      );
      const outlets = new Map<string, string>();
      for (const summary of data.summaries) for (const outlet of summary.outlets) outlets.set(outlet.media, outlet.name);
      reply.header('cache-control', 'public, max-age=120');
      return {
        generatedAt: data.generatedAt,
        hours: params.hours,
        page: params.page,
        pageSize: 50,
        total: filtered.length,
        credited: data.credited,
        counts,
        outlets: [...outlets].map(([media, name]) => ({ media, name })).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')),
        bylines: filtered.slice(params.page * 50, (params.page + 1) * 50).map((entry) => ({
          ...entry,
          articles: params.media ? (entry.outlets.find((outlet) => outlet.media === params.media)?.count ?? 0) : entry.articles,
        })),
      };
    },
  );
  app.get<{ Params: { key: string }; Querystring: { hours?: string; page?: string; media?: string } }>(
    '/api/v1/bylines/:key',
    async (request, reply) => {
      const params = bylineParams(request.query);
      if (!params || request.params.key.length > 256) return reply.code(400).send({ error: 'invalid byline key or filters' });
      const data = await load(params.hours);
      const entry = data.entries.get(request.params.key);
      const summary = data.summaries.find((item) => item.key === request.params.key);
      if (!entry || !summary || (summary.kind === 'person' && isExcludedJournalist(summary.name)))
        return reply.code(404).send({ error: 'no articles for this credit in the period' });
      const ids = entry.ids;
      // Scope the IDs in SQL when filtering by publisher; paging stays after the scope filter.
      const scoped = params.media
        ? await db
            .select({ id: articles.id })
            .from(articles)
            .where(and(inArray(articles.id, ids), sql`${articles.media} = ${params.media}`))
            .orderBy(desc(articles.publishedAt), desc(articles.id))
        : ids.map((id) => ({ id }));
      const selected = scoped.slice(params.page * 30, (params.page + 1) * 30).map((item) => item.id);
      const rows = selected.length
        ? await db
            .select({
              id: articles.id,
              media: articles.media,
              title: articles.title,
              url: articles.url,
              image: articles.image,
              publishedAt: articles.publishedAt,
              tags: articles.tags,
              authors: articles.authors,
              creator: articles.creator,
              attributions: articles.attributions,
            })
            .from(articles)
            .where(inArray(articles.id, selected))
            .orderBy(desc(articles.publishedAt), desc(articles.id))
        : [];
      reply.header('cache-control', 'public, max-age=120');
      return {
        generatedAt: data.generatedAt,
        hours: params.hours,
        page: params.page,
        pageSize: 30,
        total: scoped.length,
        byline: summary,
        articles: rows.map((row) => ({
          id: row.id,
          media: row.media,
          mediaTitle: outletIdentity(row.media).name,
          title: row.title,
          url: row.url,
          image: row.image,
          publishedAt: row.publishedAt,
          tags: row.tags,
          credits: row.authors?.length ? row.authors : row.creator ? [row.creator] : [],
          entities: creditsOf(row),
          attributions: normalizeAttributions(row.attributions ?? [], row.media),
        })),
      };
    },
  );
}
