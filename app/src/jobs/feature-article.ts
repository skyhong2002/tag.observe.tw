import { and, eq, inArray, sql } from 'drizzle-orm';
import type { ArticleDetail } from '../crawl/article.ts';
import { runIndex } from '../crawl/pipeline.ts';
import { disabled, sourceByMedia } from '../crawl/registry.ts';
import { urlKey } from '../crawl/text.ts';
import type { Db } from '../db/client.ts';
import { articles, topics } from '../db/schema.ts';
import { articleMediaOf } from './topic-stories.ts';

export async function indexFeatureArticle(
  db: Db,
  feature: { media: string; url: string; title: string; image: string | null },
  detail: ArticleDetail,
) {
  const spec = sourceByMedia(articleMediaOf(feature.media));
  if (!spec || spec.discovery || disabled().has(spec.media)) return 0;
  const content =
    detail.body && ['ok', 'short'].includes(detail.bodyStatus)
      ? { body: detail.body, bodyStatus: detail.bodyStatus as 'ok' | 'short', bodySource: detail.bodySource, authors: detail.authors }
      : undefined;
  const publishedAt =
    detail.publishedAt && detail.publishedAt.getFullYear() >= 2000 && +detail.publishedAt <= Date.now() + 86400e3
      ? detail.publishedAt
      : null;
  const image = detail.image ?? feature.image;
  const result = await runIndex(db, spec, {
    listed: {
      errors: [],
      items: [
        {
          url: feature.url,
          title: feature.title,
          publishedAt,
          tags: detail.tags,
          ...(image ? { image } : {}),
          ...(detail.description ? { description: detail.description } : {}),
          ...(content ? { verifiedContent: content } : {}),
        },
      ],
    },
  });
  // Existing article rows can predate the feature-page extraction.
  if (image || detail.description)
    await db
      .update(articles)
      .set({
        ...(image ? { image: detail.image ? detail.image.slice(0, 512) : sql`COALESCE(${articles.image}, ${image.slice(0, 512)})` } : {}),
        ...(detail.description ? { description: sql`COALESCE(${articles.description}, ${detail.description.slice(0, 4000)})` } : {}),
      })
      .where(and(eq(articles.media, spec.media), eq(articles.urlKey, urlKey(feature.url, spec.list.articleId))));
  return result.inserted;
}

export async function featureArticleId(db: Db, media: string, url: string): Promise<number | null> {
  const outlet = articleMediaOf(media);
  const [row] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.media, outlet), eq(articles.urlKey, urlKey(url, sourceByMedia(outlet)?.list.articleId))))
    .limit(1);
  return row?.id ?? null;
}

/** Seed every existing feature page into the ordinary body-fetch queue. */
export async function indexMissingFeatureArticles(db: Db) {
  const rows = await db
    .select({ media: topics.media, url: topics.url, title: topics.title, image: topics.image })
    .from(topics)
    .where(inArray(topics.kind, ['feature', 'article']));
  let inserted = 0;
  for (const media of new Set(rows.map((r) => r.media))) {
    const spec = sourceByMedia(articleMediaOf(media));
    if (!spec || spec.discovery || disabled().has(spec.media)) continue;
    const features = rows.filter((r) => r.media === media);
    const existing = await db
      .select({ key: articles.urlKey })
      .from(articles)
      .where(
        and(
          eq(articles.media, spec.media),
          inArray(
            articles.urlKey,
            features.map((r) => urlKey(r.url, spec.list.articleId)),
          ),
        ),
      );
    const keys = new Set(existing.map((r) => r.key));
    const items = features
      .filter((r) => !keys.has(urlKey(r.url, spec.list.articleId)))
      .map((r) => ({
        url: r.url,
        title: r.title,
        publishedAt: null,
        ...(r.image ? { image: r.image } : {}),
      }));
    if (items.length) inserted += (await runIndex(db, spec, { listed: { items, errors: [] } })).inserted;
  }
  return inserted;
}
