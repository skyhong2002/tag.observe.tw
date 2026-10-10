import { and, eq, gte, inArray, isNotNull, max, sql } from 'drizzle-orm';
import pLimit from 'p-limit';
import { type Logger, runArticles, runIndex } from '../crawl/pipeline.ts';
import { sourceByMedia, sourcesInGroup } from '../crawl/registry.ts';
import { crawlTimestamp, sourceSchedule } from '../crawl/schedule.ts';

import { loadTitleVocab, type TitleVocab, tagsFromTitle } from '../crawl/title-tags.ts';
import type { Db } from '../db/client.ts';
import { articles, articleTagEdits, articleTags, crawlRuns } from '../db/schema.ts';

export { groupPeriodMs } from '../crawl/schedule.ts';

// A group run visits its sources least-recently-indexed first and skips any
// source whose last completed index run is younger than its configured eligibility threshold.
// Changed sources enforce the full interval; unchanged sources keep the existing
// 20% tolerance so small scheduler jitter does not double their period.
// Deploys restart the worker mid-run and a full hourly pass can take
// longer than an hour; with this order the next run continues where the
// previous one stopped instead of starting over, so no source is starved.
// `signal` is the worker's shutdown signal: once aborted, sources not yet
// started are left for the next run (which the new worker enqueues on boot)
// while in-flight ones finish, so a deploy loses no source and no job.
export function orderDueSources<T extends { media: string }>(
  specs: T[],
  lastRun: Map<string, Date>,
  periodMs: number | ((spec: T) => number),
  now = new Date(),
) {
  const at = (spec: T) => lastRun.get(spec.media)?.getTime() ?? 0;
  return specs
    .filter((spec) => now.getTime() - at(spec) >= (typeof periodMs === 'number' ? periodMs : periodMs(spec)))
    .sort((a, b) => at(a) - at(b));
}

export async function lastIndexRuns(db: Db, media: string[]): Promise<Map<string, Date>> {
  if (!media.length) return new Map();
  const rows = await db
    .select({ media: crawlRuns.media, last: max(crawlRuns.startedAt) })
    .from(crawlRuns)
    .where(and(eq(crawlRuns.stage, 'index'), isNotNull(crawlRuns.finishedAt), inArray(crawlRuns.media, media)))
    .groupBy(crawlRuns.media);
  return new Map(rows.filter((r) => r.last != null).map((r) => [r.media, crawlTimestamp(r.last)!]));
}

export async function crawlGroup(
  db: Db,
  group: 'news' | 'hourly',
  { log, concurrency = 6, now = new Date(), signal }: { log: Logger; concurrency?: number; now?: Date; signal?: AbortSignal },
) {
  const gate = pLimit(concurrency);
  const all = sourcesInGroup(group);
  const lastRun = await lastIndexRuns(
    db,
    all.map((spec) => spec.media),
  ).catch((error) => {
    log.warn({ group, err: (error as Error).message }, 'crawl run history unavailable; using catalog order');
    return new Map<string, Date>();
  });
  const due = orderDueSources(all, lastRun, (spec) => sourceSchedule(spec.media, group).dueAfterMinutes * 60e3, now);
  let stopped = 0;
  const results = await Promise.all(
    due.map((spec) =>
      gate(async () => {
        if (signal?.aborted) {
          stopped++;
          return null;
        }
        try {
          const r = await runIndex(db, spec, { log });
          return { media: spec.media, ...r, errors: r.errors.length };
        } catch (error) {
          log.warn({ media: spec.media, err: (error as Error).message }, 'crawl index failed');
          return { media: spec.media, items: 0, inserted: 0, errors: 1 };
        }
      }),
    ),
  ).then((rows) => rows.filter((r) => r != null));
  if (stopped) log.warn({ group, stopped }, 'crawl index group stopped early for shutdown');
  return {
    group,
    sources: results.length,
    skipped: all.length - due.length,
    stopped,
    items: results.reduce((s, r) => s + r.items, 0),
    inserted: results.reduce((s, r) => s + r.inserted, 0),
    failed: results.filter((r) => r.errors && !r.items).map((r) => r.media),
  };
}

export async function crawlArticles(
  db: Db,
  { log, concurrency = 6, perMedia = 80, signal }: { log: Logger; concurrency?: number; perMedia?: number; signal?: AbortSignal },
) {
  const gate = pLimit(concurrency);
  // Fetch bodies for every active source, including articles already tagged by
  // their feed. runArticles gradually fills the retained 90-day backlog too.
  const specs = [...sourcesInGroup('news'), ...sourcesInGroup('hourly')];
  const vocab = await loadTitleVocab(db).catch((error) => {
    log.warn({ err: (error as Error).message }, 'title vocabulary unavailable');
    return null;
  });
  let stopped = 0;
  const results = await Promise.all(
    specs.map((spec) =>
      gate(async () => {
        if (signal?.aborted) {
          stopped++;
          return { media: spec.media, fetched: 0, updated: 0, failed: 0 };
        }
        try {
          return { media: spec.media, ...(await runArticles(db, spec, { log, limit: perMedia, vocab, signal })) };
        } catch (error) {
          log.warn({ media: spec.media, err: (error as Error).message }, 'crawl articles failed');
          return { media: spec.media, fetched: 0, updated: 0, failed: 1 };
        }
      }),
    ),
  );
  const titleTagged = vocab && !signal?.aborted ? await titleTagRecent(db, vocab) : 0;
  if (stopped) log.warn({ stopped }, 'crawl articles stopped early for shutdown');
  return {
    sources: specs.length - stopped,
    stopped,
    vocab: vocab?.size ?? 0,
    titleTagged,
    fetched: results.reduce((s, r) => s + r.fetched, 0),
    updated: results.reduce((s, r) => s + r.updated, 0),
    failed: results.reduce((s, r) => s + r.failed, 0),
  };
}

/** One outlet, one stage, on demand (/admin/media/ 「跑 index」／「跑內文抓取」),
 *  regardless of its schedule or crawl-disabled.json, like tools/crawl-once.ts. */
export async function crawlMedia(
  db: Db,
  { media, stage, limit = 80 }: { media: string; stage: 'index' | 'articles'; limit?: number },
  { log, signal }: { log: Logger; signal?: AbortSignal },
) {
  const spec = sourceByMedia(media);
  if (!spec) throw Error('unknown media ' + media);
  if (stage === 'index') {
    const r = await runIndex(db, spec, { log });
    return { media, stage, items: r.items, inserted: r.inserted, errors: r.errors.slice(0, 5) };
  }
  const vocab = await loadTitleVocab(db).catch(() => null);
  return { media, stage, ...(await runArticles(db, spec, { log, limit, vocab, signal })) };
}

// Articles already fetched (or skipped) that still have no tags: tag from the
// title so they count in rankings and events.
export async function titleTagRecent(db: Db, vocab: TitleVocab, { hours = 72, limit = 2000 } = {}) {
  const rows = await db
    .select({ id: articles.id, title: articles.title, publishedAt: articles.publishedAt })
    .from(articles)
    .where(
      and(
        eq(articles.source, 'own'),
        isNotNull(articles.fetchedAt),
        gte(articles.publishedAt, new Date(Date.now() - hours * 3600e3)),
        sql`JSON_LENGTH(${articles.tags}) = 0`,
        // Failed fetches were already title-tagged; keep their status for diagnosis.
        sql`${articles.fetchStatus} NOT IN ('title-none', 'error', 'failed')`,
        // An admin removed every tag on purpose (/admin/media/).
        sql`NOT EXISTS (SELECT 1 FROM ${articleTagEdits} WHERE ${articleTagEdits.articleId} = ${articles.id})`,
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
