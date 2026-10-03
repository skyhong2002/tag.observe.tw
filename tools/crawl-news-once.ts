// Run the normal index/body pipeline for every enabled catalog crawler.
import { parseArgs } from 'node:util';
import { and, count, eq, exists, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import pLimit from 'p-limit';
import catalog from '../app/data/news-source-catalog.json' with { type: 'json' };
import { runArticles, runIndex } from '../app/src/crawl/pipeline.ts';
import { allSources, disabled } from '../app/src/crawl/registry.ts';
import { createDb } from '../app/src/db/client.ts';
import { articleDiscoveries, articles } from '../app/src/db/schema.ts';

const { values } = parseArgs({
  options: {
    media: { type: 'string', multiple: true },
    limit: { type: 'string', default: '3' },
    concurrency: { type: 'string', default: '3' },
    'retry-incomplete': { type: 'boolean', default: false },
  },
});
const limit = Number(values.limit);
const concurrency = Number(values.concurrency);
if (!Number.isInteger(limit) || limit < 1 || limit > 12 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6) {
  throw new Error('limit must be 1–12; concurrency must be 1–6');
}
const known = new Set(catalog.sources.map((source) => source.media));
const blocked = disabled();
const sources = allSources().filter(
  (source) =>
    (known.has(source.media) || values.media?.includes(source.media)) &&
    (source.discovery || source.list.autoDiscover || values.media?.includes(source.media)) &&
    source.group !== 'off' &&
    !blocked.has(source.media) &&
    (!values.media || values.media.includes(source.media)),
);
if (!sources.length) throw new Error('No enabled news crawlers match');
const { db, close } = createDb();
const gate = pLimit(concurrency);
let failures = 0;
try {
  await Promise.all(
    sources.map((source) =>
      gate(async () => {
        try {
          // A parser repair can recover rows whose previous three attempts
          // exhausted normal retries. Retain existing text while requesting a
          // fresh extraction for non-ok bodies in selected media. Archive
          // sources use acquisition age, preserving their original publication.
          if (values['retry-incomplete']) {
            await db
              .update(articles)
              .set({ contentFetchedAt: null, contentAttempts: 0 })
              .where(
                and(
                  eq(articles.media, source.media),
                  source.list.autoDiscover?.includeArchive
                    ? gte(articles.crawledAt, new Date(Date.now() - 90 * 86400e3))
                    : gte(articles.publishedAt, new Date(Date.now() - 14 * 86400e3)),
                  or(isNull(articles.bodyStatus), inArray(articles.bodyStatus, ['missing', 'short', 'blocked', 'error'])),
                ),
              );
          }
          const spec = source.list.autoDiscover
            ? { ...source, list: { ...source.list, autoDiscover: { ...source.list.autoDiscover, maxArticles: limit } } }
            : source;
          const index = await runIndex(db, spec);
          const bodies = await runArticles(db, spec, { limit });
          const [stored] = await db
            .select({ complete: count(), recent: sql<number>`SUM(${articles.publishedAt} >= ${new Date(Date.now() - 14 * 86400e3)})` })
            .from(articles)
            .where(
              and(
                source.discovery
                  ? exists(
                      db
                        .select({ id: articleDiscoveries.id })
                        .from(articleDiscoveries)
                        .where(and(eq(articleDiscoveries.articleId, articles.id), eq(articleDiscoveries.media, source.media))),
                    )
                  : eq(articles.media, source.media),
                eq(articles.bodyStatus, 'ok'),
                sql`CHAR_LENGTH(${articles.body}) > 0`,
              ),
            );
          console.log(
            JSON.stringify({
              media: source.media,
              index,
              bodies,
              completeArticles: stored.complete,
              completeRecentArticles: Number(stored.recent ?? 0),
            }),
          );
        } catch (error) {
          failures++;
          console.error(JSON.stringify({ media: source.media, error: (error as Error).message }));
        }
      }),
    ),
  );
} finally {
  await close();
}
console.log(JSON.stringify({ sources: sources.length, failures }));
if (failures) process.exitCode = 1;
