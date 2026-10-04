// 延伸閱讀 (2026-10-04): for one article, other stories on the same subject —
// at other outlets and at the same outlet — plus the subject's keywords and
// the event threads it belongs to. Body-text matches are listed separately
// (/api/v1/articles/{id}/similarity) and left out here.
//
// Relatedness comes from shared tags weighted by rarity (IDF over the articles
// published within ±3 days), so 杜承哲 counts far more than 2026九合一選舉,
// plus title similarity. One or two shared tags only qualify with a similar
// title: "罹難" alone links unrelated disasters, "辛巴威" alone the same story.
import { and, between, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, articleTags, eventSnapshots, events, eventThreads, similarityPairs } from '../db/schema.ts';
import { isTagNoise } from '../tag-noise.ts';
import type { ArticleRelated, RelatedArticle } from './article-related-types.ts';

export type { ArticleRelated, RelatedArticle };

export const RELATED_WINDOW_MS = 3 * 86400e3;
export const OTHER_MEDIA_LIMIT = 8;
export const SAME_MEDIA_LIMIT = 5;
// One prolific outlet would otherwise fill the list; readers asked for other outlets' takes.
export const PER_OUTLET = 2;
const TAG_LIMIT = 20;
// Title similarity is a character-bigram Dice in 0–1; this scales it next to
// IDF weights, which are about 3 (very common tag) to 10 (one article).
const TITLE_WEIGHT = 15;
// Fewer shared tags need a closer title: two generic tags (罹難, 直升機) alone
// link a landslide to a helicopter crash.
const TWO_TAG_TITLE = 0.05;
const SINGLE_TAG_TITLE = 0.25;
const DUPLICATE_TITLE = 0.8;

const titles = catalog as Record<string, { title: string | null }>;
const mediaTitle = (media: string) => titles[media]?.title ?? media;

function bigrams(title: string) {
  const text = title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
  const out = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) out.add(text.slice(i, i + 2));
  return out;
}
export function titleSimilarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared++;
  return (2 * shared) / (a.size + b.size);
}

export interface Candidate {
  id: number;
  media: string;
  title: string;
  publishedAt: Date;
  sharedTags: string[];
}
/**
 * Rank candidates sharing tags with the article. `weight` gives each tag's
 * IDF. Keeps three or more shared tags, or fewer with a similar enough title; drops
 * near-duplicate titles (syndicated copies) after the first.
 */
export function rankRelated(
  article: { title: string; publishedAt: Date },
  candidates: Candidate[],
  weight: (tag: string) => number,
): Array<Candidate & { score: number }> {
  const own = bigrams(article.title);
  const scored = candidates
    .map((c) => {
      const grams = bigrams(c.title);
      const titleScore = titleSimilarity(own, grams);
      return { ...c, grams, titleScore, score: c.sharedTags.reduce((sum, tag) => sum + weight(tag), 0) + TITLE_WEIGHT * titleScore };
    })
    .filter(
      (c) => c.sharedTags.length >= 3 || (c.sharedTags.length === 2 && c.titleScore >= TWO_TAG_TITLE) || c.titleScore >= SINGLE_TAG_TITLE,
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        Math.abs(a.publishedAt.getTime() - article.publishedAt.getTime()) -
          Math.abs(b.publishedAt.getTime() - article.publishedAt.getTime()) ||
        a.id - b.id,
    );
  const kept: typeof scored = [];
  for (const c of scored) {
    if (titleSimilarity(own, c.grams) >= DUPLICATE_TITLE) continue;
    if (kept.some((k) => titleSimilarity(k.grams, c.grams) >= DUPLICATE_TITLE)) continue;
    kept.push(c);
  }
  return kept.map(({ grams: _grams, titleScore: _titleScore, ...c }) => c);
}

/** Keep at most `limit` items per outlet, preserving order. */
export function perOutlet<T extends { media: string }>(items: T[], limit: number): T[] {
  const seen = new Map<string, number>();
  return items.filter((item) => {
    const n = seen.get(item.media) ?? 0;
    seen.set(item.media, n + 1);
    return n < limit;
  });
}

export async function loadArticleRelated(db: Db, id: number): Promise<ArticleRelated | null> {
  const [article] = await db
    .select({ id: articles.id, media: articles.media, title: articles.title, publishedAt: articles.publishedAt, tags: articles.tags })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (!article) return null;
  const tags = [...new Set(article.tags)].filter((tag) => !isTagNoise(tag)).slice(0, TAG_LIMIT);
  const empty: ArticleRelated = {
    articleId: id,
    windowDays: RELATED_WINDOW_MS / 86400e3,
    tags: [],
    events: [],
    otherMedia: [],
    sameMedia: [],
  };
  if (!tags.length) return empty;
  const from = new Date(article.publishedAt.getTime() - RELATED_WINDOW_MS),
    to = new Date(article.publishedAt.getTime() + RELATED_WINDOW_MS);
  const [tagged, [{ total }], matched] = await Promise.all([
    db
      .select({ articleId: articleTags.articleId, tag: articleTags.tag, media: articles.media })
      .from(articleTags)
      .innerJoin(articles, eq(articles.id, articleTags.articleId))
      .where(and(inArray(articleTags.tag, tags), between(articleTags.publishedAt, from, to))),
    db
      .select({ total: sql<number>`COUNT(*)` })
      .from(articles)
      .where(between(articles.publishedAt, from, to)),
    db
      .select({ aId: similarityPairs.aId, bId: similarityPairs.bId })
      .from(similarityPairs)
      .where(or(eq(similarityPairs.aId, id), eq(similarityPairs.bId, id))),
  ]);
  const usage = new Map<string, { articles: Set<number>; media: Set<string> }>();
  const shared = new Map<number, string[]>();
  for (const row of tagged) {
    const entry = usage.get(row.tag) ?? { articles: new Set(), media: new Set() };
    entry.articles.add(row.articleId);
    entry.media.add(row.media);
    usage.set(row.tag, entry);
    if (row.articleId !== id) (shared.get(row.articleId) ?? shared.set(row.articleId, []).get(row.articleId)!).push(row.tag);
  }
  const n = Number(total);
  const weight = (tag: string) => Math.log((n + 1) / ((usage.get(tag)?.articles.size ?? 0) + 1));
  // Body matches have their own list on the page.
  for (const pair of matched) shared.delete(pair.aId === id ? pair.bId : pair.aId);

  // Pre-rank on tags alone so only promising candidates are loaded.
  const pool = [...shared]
    .map(([articleId, list]) => ({ articleId, list, score: list.reduce((sum, tag) => sum + weight(tag), 0) }))
    .sort((a, b) => b.score - a.score || b.list.length - a.list.length)
    .slice(0, 400);
  const details = pool.length
    ? await db
        .select({ id: articles.id, media: articles.media, title: articles.title, image: articles.image, publishedAt: articles.publishedAt })
        .from(articles)
        .where(
          inArray(
            articles.id,
            pool.map((c) => c.articleId),
          ),
        )
    : [];
  const images = new Map(details.map((d) => [d.id, d.image]));
  const ranked = rankRelated(
    article,
    details.map((d) => ({ id: d.id, media: d.media, title: d.title, publishedAt: d.publishedAt, sharedTags: shared.get(d.id) ?? [] })),
    weight,
  );
  const present = (c: Candidate): RelatedArticle => ({
    id: c.id,
    media: c.media,
    mediaTitle: mediaTitle(c.media),
    title: c.title,
    image: images.get(c.id) ?? null,
    publishedAt: c.publishedAt.toISOString(),
    sharedTags: [...c.sharedTags].sort((a, b) => weight(b) - weight(a)),
  });

  // Event threads around the publication whose major tags overlap, by the
  // same rarity weights; one common tag such as an election is not enough.
  const threads = await db
    .select({ id: eventThreads.id, firstTime: eventThreads.firstTime, lastTime: eventThreads.lastTime, majorTags: eventThreads.majorTags })
    .from(eventThreads)
    .where(
      and(
        gte(eventThreads.lastTime, new Date(article.publishedAt.getTime() - 86400e3)),
        lte(eventThreads.firstTime, new Date(article.publishedAt.getTime() + 86400e3)),
        sql`JSON_OVERLAPS(${eventThreads.majorTags}, ${JSON.stringify(tags)})`,
      ),
    );
  const ownTags = new Set(tags);
  const strongest = Math.max(...tags.map(weight));
  const eventMatches = threads
    .map((t) => {
      const overlap = t.majorTags.filter((tag) => ownTags.has(tag));
      return { ...t, overlap, score: overlap.reduce((sum, tag) => sum + weight(tag), 0) };
    })
    .filter((t) => t.overlap.length >= 2 || t.score >= 0.75 * strongest)
    .sort((a, b) => b.score - a.score || b.lastTime.getTime() - a.lastTime.getTime())
    .slice(0, 3);
  const eventList: ArticleRelated['events'] = [];
  for (const thread of eventMatches) {
    const [latest] = await db
      .select({ news: events.news, majorNews: events.majorNews })
      .from(events)
      .innerJoin(eventSnapshots, eq(eventSnapshots.id, events.snapshotId))
      .where(eq(events.threadId, thread.id))
      .orderBy(desc(eventSnapshots.hourStart))
      .limit(1);
    const headline = (latest?.majorNews.length ? latest.majorNews : (latest?.news ?? []))[0]?.title;
    eventList.push({
      id: thread.id,
      title: headline ?? thread.majorTags.join('、'),
      firstTime: thread.firstTime.toISOString(),
      lastTime: thread.lastTime.toISOString(),
      sharedTags: thread.overlap,
    });
  }

  return {
    ...empty,
    tags: tags.map((tag) => ({ tag, articles: usage.get(tag)?.articles.size ?? 0, media: usage.get(tag)?.media.size ?? 0 })),
    events: eventList,
    otherMedia: perOutlet(
      ranked.filter((c) => c.media !== article.media),
      PER_OUTLET,
    )
      .slice(0, OTHER_MEDIA_LIMIT)
      .map(present),
    sameMedia: ranked
      .filter((c) => c.media === article.media)
      .slice(0, SAME_MEDIA_LIMIT)
      .map(present),
  };
}

export function registerArticleRelated(app: FastifyInstance, db: Db) {
  app.get<{ Params: { id: string } }>('/api/v1/articles/:id/related', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return reply.code(400).send({ error: 'id must be a positive integer' });
    const data = await loadArticleRelated(db, id);
    if (!data) return reply.code(404).send({ error: 'article not found' });
    reply.header('cache-control', 'public, max-age=300');
    return data;
  });
}
