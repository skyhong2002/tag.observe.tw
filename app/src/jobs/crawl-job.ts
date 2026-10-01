import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import pLimit from 'p-limit';
import { type Logger, runArticles, runIndex } from '../crawl/pipeline.ts';
import { sourcesInGroup } from '../crawl/registry.ts';
import { loadTitleVocab, type TitleVocab, tagsFromTitle } from '../crawl/title-tags.ts';
import type { Db } from '../db/client.ts';
import { articles, articleTags } from '../db/schema.ts';

// Mirrors the legacy cron cadence: index.sh every 9 min (news group),
// index_hour.sh hourly, tag.sh every 19 min. Sources run concurrently but each
// media is single-flight and article fetches stay polite per host.
export async function crawlGroup(db: Db, group: 'news' | 'hourly', { log, concurrency = 6 }: { log: Logger; concurrency?: number }) {
  const gate = pLimit(concurrency);
  const results = await Promise.all(
    sourcesInGroup(group).map((spec) =>
      gate(async () => {
        try {
          const r = await runIndex(db, spec, { log });
          return { media: spec.media, ...r, errors: r.errors.length };
        } catch (error) {
          log.warn({ media: spec.media, err: (error as Error).message }, 'crawl index failed');
          return { media: spec.media, items: 0, inserted: 0, errors: 1 };
        }
      }),
    ),
  );
  return {
    group,
    sources: results.length,
    items: results.reduce((s, r) => s + r.items, 0),
    inserted: results.reduce((s, r) => s + r.inserted, 0),
    failed: results.filter((r) => r.errors && !r.items).map((r) => r.media),
  };
}

export async function crawlArticles(
  db: Db,
  { log, concurrency = 6, perMedia = 80 }: { log: Logger; concurrency?: number; perMedia?: number },
) {
  const gate = pLimit(concurrency);
  // Every active source: those without a legacy tag script only fetch
  // articles their listing left untagged (see runArticles).
  const specs = [...sourcesInGroup('news'), ...sourcesInGroup('hourly')];
  const vocab = await loadTitleVocab(db).catch((error) => {
    log.warn({ err: (error as Error).message }, 'title vocabulary unavailable');
    return null;
  });
  const results = await Promise.all(
    specs.map((spec) =>
      gate(async () => {
        try {
          return { media: spec.media, ...(await runArticles(db, spec, { log, limit: perMedia, vocab })) };
        } catch (error) {
          log.warn({ media: spec.media, err: (error as Error).message }, 'crawl articles failed');
          return { media: spec.media, fetched: 0, updated: 0, failed: 1 };
        }
      }),
    ),
  );
  const titleTagged = vocab ? await titleTagRecent(db, vocab) : 0;
  return {
    sources: specs.length,
    vocab: vocab?.size ?? 0,
    titleTagged,
    fetched: results.reduce((s, r) => s + r.fetched, 0),
    updated: results.reduce((s, r) => s + r.updated, 0),
    failed: results.reduce((s, r) => s + r.failed, 0),
  };
}

// Articles already fetched (or skipped) that still have no tags: tag from the
// title so they count in rankings and events.
export async function titleTagRecent(db: Db, vocab: TitleVocab, { hours = 72, limit = 2000 } = {}) {
  const rows = await db
    .select({ id: articles.id, title: articles.title, publishedAt: articles.publishedAt })
    .from(articles)
    .where(
      and(
        isNotNull(articles.fetchedAt),
        gte(articles.publishedAt, new Date(Date.now() - hours * 3600e3)),
        sql`JSON_LENGTH(${articles.tags}) = 0`,
        // Failed fetches were already title-tagged; keep their status for diagnosis.
        sql`${articles.fetchStatus} NOT IN ('title-none', 'error', 'failed')`,
      ),
    )
    .limit(limit);
  let tagged = 0;
  for (const r of rows) {
    const tags = tagsFromTitle(r.title, vocab);
    if (!tags.length) {
      await db.update(articles).set({ fetchStatus: 'title-none' }).where(eq(articles.id, r.id));
      continue;
    }
    await db.update(articles).set({ tags, fetchStatus: 'title' }).where(eq(articles.id, r.id));
    await db
      .insert(articleTags)
      .values(tags.map((tag) => ({ articleId: r.id, tag: tag.slice(0, 60), publishedAt: r.publishedAt })))
      .onDuplicateKeyUpdate({ set: { publishedAt: sql`VALUES(published_at)` } });
    tagged++;
  }
  return tagged;
}
