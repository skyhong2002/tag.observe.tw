import { and, eq, inArray, sql } from 'drizzle-orm';
import type { ArticleDetail } from '../crawl/article.ts';
import { runIndex } from '../crawl/pipeline.ts';
import { disabled, sourceByMedia } from '../crawl/registry.ts';
import { urlKey } from '../crawl/text.ts';
import type { Db } from '../db/client.ts';
import { articles, articleTags, topics } from '../db/schema.ts';
import { articleMediaOf, TOPIC_ARTICLE_MEDIA } from './topic-stories.ts';

/** A feature page that shows no date of its own is dated by its earliest
 *  story; otherwise the row keeps the time it was first seen and reads as
 *  the outlet's newest article (womany /collections/, PChome /features/). */
const featureDate = (page: Date | null, storyFirstAt: Date | null | undefined) => page ?? storyFirstAt ?? null;

export async function indexFeatureArticle(
  db: Db,
  feature: { media: string; url: string; title: string; image: string | null; storyFirstAt?: Date | null },
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
          publishedAt: featureDate(publishedAt, feature.storyFirstAt),
          tags: detail.tags,
          summary: detail.summary,
          summarySource: detail.summarySource,
          ...(image ? { image } : {}),
          ...(detail.description ? { description: detail.description } : {}),
          ...(content ? { verifiedContent: content } : {}),
        },
      ],
    },
  });
  // Existing article rows can predate the feature-page extraction.
  if (image || detail.description || detail.summary)
    await db
      .update(articles)
      .set({
        ...(detail.summary ? { summary: detail.summary, summarySource: detail.summarySource } : {}),
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
        // Its own page may carry a date; dateFeatureArticles covers it if not.
        publishedAt: null,
        ...(r.image ? { image: r.image } : {}),
      }));
    if (items.length) inserted += (await runIndex(db, spec, { listed: { items, errors: [] } })).inserted;
  }
  await dateFeatureArticles(db);
  return inserted;
}

/** Feature rows still at their first-seen time after their page was read
 *  (it showed no date) take the feature's earliest story date, tags too. */
export async function dateFeatureArticles(db: Db) {
  const outlet = sql.join(
    [
      sql`CASE ${topics.media}`,
      ...Object.entries(TOPIC_ARTICLE_MEDIA).map(([m, a]) => sql`WHEN ${m} THEN ${a}`),
      sql`ELSE ${topics.media} END`,
    ],
    sql` `,
  );
  const [result] = (await db.execute(sql`
    UPDATE ${articles} a
    JOIN ${topics} ON ${topics.url} = a.url AND a.media = ${outlet}
      AND ${topics.kind} IN ('feature', 'article') AND ${topics.storyFirstAt} < a.crawled_at
    LEFT JOIN ${articleTags} t ON t.article_id = a.id
    SET a.published_at = ${topics.storyFirstAt}, t.published_at = ${topics.storyFirstAt}
    WHERE a.published_at = a.crawled_at AND a.fetched_at IS NOT NULL
  `)) as unknown as [{ affectedRows: number }];
  return result.affectedRows;
}
