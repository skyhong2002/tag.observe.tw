// Audit individual UDN reports that appeared in its topic directory.
// --apply keeps the old topic row as a redirect and preserves a private backup.
import { mkdirSync, writeFileSync } from 'node:fs';
import { and, eq, like } from 'drizzle-orm';
import { extractFeatureArticle } from '../app/src/crawl/feature-article.ts';
import { fetchText } from '../app/src/crawl/fetch.ts';
import { sourceByMedia } from '../app/src/crawl/registry.ts';
import { standaloneTopicListing, standaloneTopicPage } from '../app/src/crawl/topic-article.ts';
import { createDb } from '../app/src/db/client.ts';
import { articles, articleTags, topics } from '../app/src/db/schema.ts';
import { featureArticleId, indexFeatureArticle } from '../app/src/jobs/feature-article.ts';

const apply = process.argv.includes('--apply');
const { db, close } = createDb();
const backup = `/home/deck/tag-analysis-private/topic-article-reclassification-${Date.now()}`;
try {
  const rows = await db
    .select()
    .from(topics)
    .where(and(eq(topics.media, 'udn'), like(topics.url, 'https://topic.udn.com/event/%')));
  for (const row of rows) {
    const res = await fetchText(row.url, { timeout: 15000 });
    if (res.status >= 400) {
      console.log(JSON.stringify({ id: row.id, status: res.status }));
      continue;
    }
    const single =
      !row.pageStories?.length && (standaloneTopicListing(row.media, row.url, row.title) || standaloneTopicPage(res.body, row.url, 0));
    if (!single) continue;
    const detail = extractFeatureArticle(res.body, row.url, sourceByMedia('udn')?.article);
    if (apply) {
      const oldId = await featureArticleId(db, row.media, row.url);
      const old = oldId ? (await db.select().from(articles).where(eq(articles.id, oldId)))[0] : null;
      mkdirSync(backup, { recursive: true, mode: 0o700 });
      writeFileSync(`${backup}/${row.id}.json`, JSON.stringify({ topic: row, article: old }), { mode: 0o600 });
      await indexFeatureArticle(db, row, detail);
      const articleId = await featureArticleId(db, row.media, row.url);
      if (!articleId) throw Error(`Missing article for ${row.id}`);
      // Earlier extraction only kept the first <article> chapter of this template.
      await db.transaction(async (tx) => {
        if (detail.body && detail.body.length > (old?.body?.length ?? 0))
          await tx
            .update(articles)
            .set({ body: detail.body, bodySource: detail.bodySource, bodyStatus: detail.bodyStatus, contentFetchedAt: new Date() })
            .where(eq(articles.id, articleId));
        if (detail.publishedAt && old && +old.publishedAt === +old.crawledAt) {
          await tx.update(articles).set({ publishedAt: detail.publishedAt }).where(eq(articles.id, articleId));
          await tx.update(articleTags).set({ publishedAt: detail.publishedAt }).where(eq(articleTags.articleId, articleId));
        }
        await tx.update(topics).set({ kind: 'article', kindSource: 'article' }).where(eq(topics.id, row.id));
      });
    }
    console.log(
      JSON.stringify({
        id: row.id,
        title: row.title,
        kind: 'article',
        apply,
        chars: detail.body?.length ?? 0,
        articleId: await featureArticleId(db, row.media, row.url),
      }),
    );
  }
  if (apply) console.log(JSON.stringify({ backup }));
} finally {
  await close();
}
