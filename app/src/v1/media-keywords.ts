import { and, desc, eq, gte, lt, lte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import mediaCatalog from '../../data/media-catalog.json' with { type: 'json' };
import noEqual from '../../data/no-equal-tags.json' with { type: 'json' };
import rankingBaseline from '../../data/ranking-baseline.json' with { type: 'json' };
import { excludedMedia } from '../crawl/registry.ts';
import { loadTitleVocab, type TitleVocab, tagsFromTitle } from '../crawl/title-tags.ts';
import type { Db } from '../db/client.ts';
import { articles } from '../db/schema.ts';
import { isOwnMediaTag } from '../media-tags.ts';
import { isTagNoise } from '../tag-noise.ts';
import { parseContentId } from './article-content.ts';

export const KEYWORD_SAMPLE_LIMIT = 2000;
const excluded = new Set([...noEqual.tags, '國際', '生活', '政治', '財經', '兩岸', '社會', '地方', '體育', '娛樂', '科技', '新聞']);

// Each article counts a keyword once, whether it is a stored tag or a title match.
const articleTerms = (row: { title: string; tags: string[] }, vocab: TitleVocab) =>
  new Set([...row.tags, ...tagsFromTitle(row.title, vocab, 12)].map((tag) => tag.trim()));

export function mediaKeywordTerms(rows: Array<{ title: string; tags: string[] }>, vocab: TitleVocab, media?: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const term of articleTerms(row, vocab)) {
      if (isOwnMediaTag(term, media)) continue;
      if (term.length < 2 || term.length > 30 || excluded.has(term) || isTagNoise(term) || /^\d+(?:年|月|日)?$/.test(term)) continue;
      if (!/[\p{L}\p{N}]/u.test(term)) continue;
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-TW'))
    .slice(0, 50);
}

// Peers are the ranking's baseline outlets of the outlet's own category (news
// outlets against the 44 news baseline outlets, tech sites against tech sites);
// the long tail of small and overseas outlets would make every mainstream
// topic look distinctive. Categories without a baseline compare with news.
const SKIP_GROUPS = new Set(['blue', 'green', 'adct', 'all']);
const peerGroups = Object.entries(rankingBaseline.categories as Record<string, string[]>).filter(([group]) => !SKIP_GROUPS.has(group));
const groupsOf = new Map<string, string[]>();
for (const [group, list] of peerGroups) for (const media of list) groupsOf.set(media, [...(groupsOf.get(media) ?? []), group]);
export function peerGroup(media: string) {
  const category = Object.entries(mediaCatalog.categories as Record<string, string[]>).find(
    ([key, list]) => !SKIP_GROUPS.has(key) && list.includes(media),
  )?.[0];
  return category && peerGroups.some(([group]) => group === category) ? category : 'news';
}

/** Keyword counts of each peer group over one window, counted like the cloud itself. */
export interface KeywordPool {
  articles: number;
  media: Map<string, number>;
  terms: Map<string, number>;
}
export type KeywordBaseline = Map<string, KeywordPool>;

export function keywordBaseline(
  rows: Array<{ media: string; title: string; tags: string[] }>,
  vocab: TitleVocab,
  baseline: KeywordBaseline = new Map(),
): KeywordBaseline {
  for (const row of rows) {
    const groups = groupsOf.get(row.media);
    if (!groups || excludedMedia.has(row.media)) continue;
    const terms = [...articleTerms(row, vocab)].filter((term) => term.length >= 2);
    for (const group of groups) {
      let pool = baseline.get(group);
      if (!pool) baseline.set(group, (pool = { articles: 0, media: new Map(), terms: new Map() }));
      pool.articles++;
      pool.media.set(row.media, (pool.media.get(row.media) ?? 0) + 1);
      for (const term of terms) pool.terms.set(term, (pool.terms.get(term) ?? 0) + 1);
    }
  }
  return baseline;
}

// Reads the window in 6-hour slices on the published_at index rather than
// holding a week of rows (~110k) at once.
export async function loadKeywordBaseline(db: Db, hours: number, vocab: TitleVocab, now = new Date()) {
  const from = now.getTime() - hours * 3600e3;
  const baseline: KeywordBaseline = new Map();
  for (let end = now.getTime(); end > from; end -= 6 * 3600e3) {
    const start = new Date(Math.max(from, end - 6 * 3600e3));
    const until = end === now.getTime() ? lte(articles.publishedAt, now) : lt(articles.publishedAt, new Date(end));
    const rows = await db
      .select({ media: articles.media, title: articles.title, tags: articles.tags })
      .from(articles)
      .where(and(gte(articles.publishedAt, start), until));
    keywordBaseline(rows, vocab, baseline);
  }
  return baseline;
}

// A keyword is distinctive when at least 3 of this outlet's articles use it and
// its share of them is at least DISTINCTIVE_RATIO times its share at the peers
// combined (one article added to the peers so a keyword nobody else uses still compares).
export const DISTINCTIVE_MIN_COUNT = 3;
export const DISTINCTIVE_RATIO = 3;

export function compareKeywords(
  terms: Array<{ label: string; count: number }>,
  sample: { media: string; sampledArticles: number },
  baseline: KeywordBaseline | null,
) {
  const group = peerGroup(sample.media);
  const pool = baseline?.get(group);
  const own = pool?.media.get(sample.media) ?? 0;
  const peers = pool ? pool.articles - own : 0;
  if (!pool || peers <= 0 || !sample.sampledArticles)
    return {
      comparison: null,
      terms: terms.map((t) => ({ ...t, share: t.count / Math.max(1, sample.sampledArticles), peerShare: null, distinctive: false })),
    };
  return {
    comparison: { group, articles: peers, media: [...pool.media.keys()].filter((key) => key !== sample.media).length },
    terms: terms.map((t) => {
      const share = t.count / sample.sampledArticles;
      // A capped sample scales up to the outlet's full window before it is subtracted.
      const peerCount = Math.max(0, (pool.terms.get(t.label) ?? 0) - Math.round(share * own));
      return {
        ...t,
        share,
        peerShare: peerCount / peers,
        distinctive: t.count >= DISTINCTIVE_MIN_COUNT && share >= DISTINCTIVE_RATIO * ((peerCount + 1) / (peers + 1)),
      };
    }),
  };
}

export async function loadMediaKeywords(
  db: Db,
  media: string,
  hours: number,
  vocab: TitleVocab,
  now = new Date(),
  baseline: KeywordBaseline | null = null,
) {
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
    ...compareKeywords(mediaKeywordTerms(sample, vocab, media), { media, sampledArticles: sample.length }, baseline),
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
  // The cross-outlet baseline takes a few seconds per window, so it is cached
  // for 10 minutes per window (at most 4 windows) and refreshed in the
  // background: a request waits at most 1.5 s for a cold one and otherwise
  // answers without the comparison, which the next request picks up.
  const baselines = new Map<number, { expires: number; value: Promise<KeywordBaseline | null>; ready: KeywordBaseline | null }>();
  const baseline = async (hours: number) => {
    let entry = baselines.get(hours);
    if (!entry || entry.expires <= Date.now()) {
      const next = { expires: Date.now() + 600e3, value: Promise.resolve<KeywordBaseline | null>(null), ready: entry?.ready ?? null };
      next.value = vocab()
        .then((v) => loadKeywordBaseline(db, hours, v))
        .then(
          (value) => (next.ready = value),
          (error) => {
            next.expires = 0;
            app.log.warn({ err: error, hours }, 'media keyword baseline failed');
            return next.ready;
          },
        );
      baselines.delete(hours);
      baselines.set(hours, next);
      if (baselines.size > 4) baselines.delete(baselines.keys().next().value as number);
      entry = next;
    }
    return entry.ready ?? Promise.race([entry.value, new Promise<null>((resolve) => setTimeout(resolve, 1500, null))]);
  };
  app.get<{ Params: { media: string }; Querystring: { hours?: string } }>('/api/v1/media/:media/keywords', async (request, reply) => {
    const { media } = request.params;
    if (!Object.hasOwn(catalog, media) || excludedMedia.has(media)) return reply.code(404).send({ error: 'unknown media' });
    const hours = request.query.hours === undefined ? 168 : parseContentId(request.query.hours);
    if (!hours || hours > 168) return reply.code(400).send({ error: 'hours must be 1–168' });
    const [words, comparison] = await Promise.all([vocab(), baseline(hours)]);
    const result = await loadMediaKeywords(db, media, hours, words, new Date(), comparison);
    reply.header('cache-control', 'public, max-age=120');
    return result;
  });
}
