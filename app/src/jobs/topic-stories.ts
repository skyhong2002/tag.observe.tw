import { and, eq, inArray } from 'drizzle-orm';
import { runIndex } from '../crawl/pipeline.ts';
import { disabled, sourceByMedia } from '../crawl/registry.ts';
import type { Db } from '../db/client.ts';
import { articles, type topics } from '../db/schema.ts';

export const TOPIC_ARTICLE_MEDIA: Record<string, string> = { twreporter: 'reporter' };
export const articleMediaOf = (media: string) => TOPIC_ARTICLE_MEDIA[media] ?? media;
export type StoredStory = NonNullable<typeof topics.$inferSelect.pageStories>[number];
export interface IndexedTopicStory {
  key: string;
  title: string;
  url: string | null;
  id: number | null;
  date: string | null;
}

/** Keep previously discovered members when an outlet rotates its first page. */
export function mergeTopicStories(before: StoredStory[], current: StoredStory[]): StoredStory[] {
  const merged = new Map(before.map((s) => [s.key, s]));
  for (const story of current) merged.set(story.key, { ...merged.get(story.key), ...story });
  return [...merged.values()];
}

/** Old rows only saved a key. ID-only keys cannot reconstruct a URL. */
export function storyUrl(story: StoredStory): string | null {
  const raw = story.url ?? (!story.key.includes('#') && story.key.includes('/') ? `https://${story.key}` : null);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export async function resolveTopicStories(db: Db, media: string, stories: StoredStory[]): Promise<IndexedTopicStory[]> {
  const unique = [...new Map(stories.map((s) => [s.key, s])).values()];
  const rows = unique.length
    ? await db
        .select({
          key: articles.urlKey,
          id: articles.id,
          url: articles.url,
          title: articles.title,
          date: articles.publishedAt,
          crawledAt: articles.crawledAt,
        })
        .from(articles)
        .where(
          and(
            eq(articles.media, articleMediaOf(media)),
            inArray(
              articles.urlKey,
              unique.map((s) => s.key),
            ),
          ),
        )
    : [];
  const indexed = new Map(rows.map((r) => [r.key, r]));
  return unique
    .map((s) => {
      const article = indexed.get(s.key);
      return {
        key: s.key,
        title: article?.title || s.title,
        url: article?.url ?? storyUrl(s),
        id: article?.id ?? null,
        date: s.date ?? (article && +article.date !== +article.crawledAt ? article.date.toISOString() : null),
      };
    })
    .sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
}

/** Use the ordinary article pipeline without adding the collection name as a tag. */
export async function indexTopicStories(db: Db, media: string, stories: StoredStory[]) {
  const spec = sourceByMedia(articleMediaOf(media));
  if (!spec || spec.discovery || disabled().has(spec.media)) return 0;
  const resolved = await resolveTopicStories(db, media, stories);
  const items = resolved.flatMap((s) => {
    if (s.id || !s.url) return [];
    const date = s.date ? new Date(s.date) : undefined;
    return [{ url: s.url, title: s.title, publishedAt: date && Number.isFinite(+date) ? date : null }];
  });
  if (!items.length) return 0;
  const result = await runIndex(db, spec, { listed: { items, errors: [] } });
  return result.inserted;
}
