import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import noEqual from '../../data/no-equal-tags.json' with { type: 'json' };
import { loadTitleVocab, type TitleVocab, tagsFromTitle } from '../crawl/title-tags.ts';
import type { Db } from '../db/client.ts';
import { articles } from '../db/schema.ts';
import { parseContentId } from './article-content.ts';

export const KEYWORD_SAMPLE_LIMIT = 2000;
const excluded = new Set([...noEqual.tags, '國際', '生活', '政治', '財經', '兩岸', '社會', '地方', '體育', '娛樂', '科技', '新聞']);

export function mediaKeywordTerms(rows: Array<{ title: string; tags: string[] }>, vocab: TitleVocab) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const terms = new Set([...row.tags, ...tagsFromTitle(row.title, vocab, 12)].map((tag) => tag.trim()));
    for (const term of terms) {
      if (term.length < 2 || term.length > 30 || excluded.has(term) || /^\d+(?:年|月|日)?$/.test(term)) continue;
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-TW'))
    .slice(0, 50);
}

export async function loadMediaKeywords(db: Db, media: string, hours: number, vocab: TitleVocab, now = new Date()) {
  const from = new Date(now.getTime() - hours * 3600e3);
  const rows = await db
    .select({ title: articles.title, tags: articles.tags })
    .from(articles)
    .where(and(eq(articles.media, media), gte(articles.publishedAt, from), lte(articles.publishedAt, now)))
    .orderBy(desc(articles.publishedAt), desc(articles.id))
    .limit(KEYWORD_SAMPLE_LIMIT + 1);
  const sample = rows.slice(0, KEYWORD_SAMPLE_LIMIT);
  return {
    media,
    hours,
    from,
    to: now,
    sampledArticles: sample.length,
    capped: rows.length > KEYWORD_SAMPLE_LIMIT,
    terms: mediaKeywordTerms(sample, vocab),
  };
}

export function registerMediaKeywords(app: FastifyInstance, db: Db) {
  // Share the existing title vocabulary across outlets; no article bodies or
  // source requests are needed. Retry failures rather than caching them.
  let vocabulary: { expires: number; value: Promise<TitleVocab> } | null = null;
  const vocab = () => {
    if (!vocabulary || vocabulary.expires <= Date.now()) {
      const value = loadTitleVocab(db, { days: 7 }).catch((error) => {
        vocabulary = null;
        throw error;
      });
      vocabulary = { expires: Date.now() + 600e3, value };
    }
    return vocabulary.value;
  };
  app.get<{ Params: { media: string }; Querystring: { hours?: string } }>('/api/v1/media/:media/keywords', async (request, reply) => {
    const { media } = request.params;
    if (!Object.hasOwn(catalog, media)) return reply.code(404).send({ error: 'unknown media' });
    const hours = request.query.hours === undefined ? 168 : parseContentId(request.query.hours);
    if (!hours || hours > 168) return reply.code(400).send({ error: 'hours must be 1–168' });
    const result = await loadMediaKeywords(db, media, hours, await vocab());
    reply.header('cache-control', 'public, max-age=120');
    return result;
  });
}
