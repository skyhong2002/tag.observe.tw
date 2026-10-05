import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { and, asc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import pLimit from 'p-limit';
import { BODY_RETENTION_MS } from '../app/src/article-retention.ts';
import { extractArticle } from '../app/src/crawl/article.ts';
import { fetchText } from '../app/src/crawl/fetch.ts';
import { sourceByMedia } from '../app/src/crawl/registry.ts';
import { createDb } from '../app/src/db/client.ts';
import { articleCitations, articleSketches, articles, similarityPairs } from '../app/src/db/schema.ts';
import { extractAttributions } from '../app/src/similarity/attribution.ts';
import { normalizeBody } from '../app/src/similarity/compute.ts';

// Re-fetch retained JSON-LD bodies; only a complete visible DOM replacement
// qualifies. Dry-run by default. The backup is durable before each DB write.
const { values } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    backup: { type: 'string' },
    media: { type: 'string' },
    ids: { type: 'string' },
    limit: { type: 'string', default: '1000' },
    'after-id': { type: 'string', default: '0' },
  },
});
const limit = Number(values.limit);
const afterId = Number(values['after-id']);
const ids = values.ids?.split(',').map(Number);
if (ids?.some((id) => !Number.isSafeInteger(id) || id < 1)) throw Error('ids must be comma-separated positive integers');
if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000 || !Number.isSafeInteger(afterId) || afterId < 0)
  throw Error('limit must be 1–100000; after-id must be a nonnegative integer');
if (values.apply && !values.backup) throw Error('--apply requires --backup /private/path/backup.jsonl');
if (values.backup) mkdirSync(dirname(values.backup), { recursive: true, mode: 0o700 });
const selected = values.media?.split(',').filter(Boolean);
const { db, close } = createDb();
const counts = { scanned: 0, changed: 0, unchanged: 0, unavailable: 0, raced: 0 };
const gate = pLimit(12);
const hosts = new Map<string, ReturnType<typeof pLimit>>();
const throttled = new Set<string>();
try {
  const rows = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.bodySource, 'ld+json'),
        eq(articles.bodyStatus, 'ok'),
        sql`${articles.body} IS NOT NULL`,
        sql`${articles.id} > ${afterId}`,
        gte(articles.crawledAt, new Date(Date.now() - BODY_RETENTION_MS)),
        selected?.length ? inArray(articles.media, selected) : undefined,
        ids?.length ? inArray(articles.id, ids) : undefined,
      ),
    )
    .orderBy(asc(articles.id))
    .limit(limit);
  console.log(JSON.stringify({ selected: rows.length, applied: values.apply, lastId: rows.at(-1)?.id }));
  await Promise.all(
    rows.map((row) => {
      const host = new URL(row.url).hostname;
      if (!hosts.has(host)) hosts.set(host, pLimit(2));
      return hosts.get(host)!(async () => {
        await gate(async () => {
          counts.scanned++;
          try {
            if (throttled.has(host)) {
              counts.unavailable++;
              return;
            }
            const spec = sourceByMedia(row.media);
            const result = await fetchText(row.url, { userAgent: spec?.article.userAgent, timeout: 10000, retries: 0 });
            if (result.status === 429) throttled.add(host);
            if (result.status >= 400) throw Error(`HTTP ${result.status}`);
            const detail = extractArticle(result.body, row.url, spec?.article);
            if (spec?.article.provider && !new RegExp(spec.article.provider).test(detail.provider ?? '')) throw Error('provider changed');
            if (detail.bodyStatus !== 'ok' || !detail.body) throw Error(`body ${detail.bodyStatus}`);
            if (detail.bodySource === 'ld+json' || detail.body === row.body) {
              counts.unchanged++;
              return;
            }
            const proseChanged = normalizeBody(detail.body) !== normalizeBody(row.body!);
            if (values.apply) {
              appendFileSync(values.backup!, JSON.stringify({ savedAt: new Date(), article: row }) + '\n', { mode: 0o600, flush: true });
              const updated = await db.transaction(async (tx) => {
                const [result] = await tx
                  .update(articles)
                  .set({
                    body: detail.body,
                    bodySource: detail.bodySource,
                    contentFetchedAt: new Date(),
                    contentArchiveHash: null,
                    ...(proseChanged
                      ? { similarityAt: null, attributions: extractAttributions(detail.body!, row.media, detail.provider) }
                      : {}),
                  })
                  .where(
                    and(
                      eq(articles.id, row.id),
                      eq(articles.bodySource, 'ld+json'),
                      sql`BINARY ${articles.body} = BINARY ${row.body}`,
                      sql`${articles.contentFetchedAt} <=> ${row.contentFetchedAt}`,
                    ),
                  );
                if (!result.affectedRows) return false;
                if (proseChanged) {
                  await tx.delete(similarityPairs).where(or(eq(similarityPairs.aId, row.id), eq(similarityPairs.bId, row.id)));
                  await tx.delete(articleSketches).where(eq(articleSketches.articleId, row.id));
                  await tx.delete(articleCitations).where(eq(articleCitations.articleId, row.id));
                }
                return true;
              });
              if (!updated) {
                counts.raced++;
                return;
              }
            }
            counts.changed++;
            console.log(JSON.stringify({ id: row.id, media: row.media, source: detail.bodySource, proseChanged, applied: values.apply }));
          } catch (error) {
            counts.unavailable++;
            console.log(JSON.stringify({ id: row.id, media: row.media, error: (error as Error).message }));
          }
        });
        await setTimeout(250);
      });
    }),
  );
  console.log(JSON.stringify({ ...counts, applied: values.apply }));
} finally {
  await close();
}
