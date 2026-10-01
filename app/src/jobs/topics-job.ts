import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import pLimit from 'p-limit';
import { fetchText } from '../crawl/fetch.ts';
import { sourceByMedia } from '../crawl/registry.ts';
import { looksLikeStories, type TopicStory, topicPageGroups } from '../crawl/topic-page.ts';
import { fetchTopics, TOPIC_RULES } from '../crawl/topics.ts';
import type { Db } from '../db/client.ts';
import { articles, crawlRuns, topics } from '../db/schema.ts';

export async function runTopicsJob(db: Db, { log = (_o: object, _m: string) => {}, now = () => new Date() } = {}) {
  const results: Record<string, { items: number; inserted: number; error?: string }> = {};
  for (const rule of TOPIC_RULES) {
    const started = now();
    const [run] = await db
      .insert(crawlRuns)
      .values({ media: rule.media, stage: 'topic', startedAt: started, status: 'running' })
      .$returningId();
    try {
      const items = await fetchTopics(rule);
      let inserted = 0;
      if (items.length) {
        const r = await db
          .insert(topics)
          .ignore()
          .values(
            items.map((t) => ({
              media: rule.media,
              url: t.url,
              title: t.title,
              image: t.image,
              category: t.category,
              firstSeen: started,
              lastSeen: started,
            })),
          );
        inserted = (r as unknown as [{ affectedRows: number }])[0]?.affectedRows ?? 0;
        const seen = and(
          eq(topics.media, rule.media),
          sql`${topics.url} IN (${sql.join(
            items.map((t) => sql`${t.url}`),
            sql`, `,
          )})`,
        );
        await db.update(topics).set({ lastSeen: started }).where(seen);
        // Backfill covers for rows first stored without one (VALUES() is NULL
        // outside ON DUPLICATE KEY UPDATE, so this can't be one statement).
        for (const t of items)
          if (t.image)
            await db
              .update(topics)
              .set({ image: t.image })
              .where(and(eq(topics.media, rule.media), eq(topics.url, t.url), isNull(topics.image)));
      }
      await db
        .update(crawlRuns)
        .set({
          finishedAt: now(),
          status: items.length ? 'ok' : 'failed',
          fetched: items.length,
          inserted,
          detail: items.length ? null : 'no topic links matched',
        })
        .where(eq(crawlRuns.id, run.id));
      results[rule.media] = { items: items.length, inserted };
    } catch (error) {
      await db
        .update(crawlRuns)
        .set({ finishedAt: now(), status: 'failed', detail: String((error as Error).message) })
        .where(eq(crawlRuns.id, run.id));
      results[rule.media] = { items: 0, inserted: 0, error: (error as Error).message };
    }
  }
  const pages = await refreshTopicPages(db, { now }).catch((error) => ({ error: (error as Error).message }));
  log({ ...results, pages }, 'topics job finished');
  return results;
}

// Topic outlets whose stories are stored under another media key.
export const TOPIC_ARTICLE_MEDIA: Record<string, string> = { twreporter: 'reporter' };
export const articleMediaOf = (topicMedia: string) => TOPIC_ARTICLE_MEDIA[topicMedia] ?? topicMedia;

// Re-read recently listed topic pages every 6 hours and keep each topic's own
// story list. Blocks repeated on the outlet's other topic pages ("latest
// news", "most read", other topics' picks) are site furniture: a group is
// skipped when over half of its links also appear on another topic page of
// the same outlet fetched in this run. Of the rest, the group with the most
// stories we crawled (at least 2) wins; failing that (older stories, outlets
// we do not crawl such as 鏡報), the largest group that reads like headlines.
export async function refreshTopicPages(
  db: Db,
  { now = () => new Date(), limit = 60, fetch = fetchText }: { now?: () => Date; limit?: number; fetch?: typeof fetchText } = {},
) {
  const t = now().getTime();
  const due = await db
    .select({ id: topics.id, media: topics.media, url: topics.url })
    .from(topics)
    .where(
      and(
        gte(topics.lastSeen, new Date(t - 3 * 86400e3)),
        or(isNull(topics.pageCheckedAt), lt(topics.pageCheckedAt, new Date(t - 6 * 3600e3))),
      ),
    )
    .orderBy(sql`${topics.pageCheckedAt} IS NOT NULL`, topics.pageCheckedAt, desc(topics.lastSeen))
    .limit(limit);
  const gate = pLimit(2);
  const pages = await Promise.all(
    due.map((row) =>
      gate(async () => {
        const articleId = sourceByMedia(articleMediaOf(row.media))?.list.articleId;
        try {
          const res = await fetch(row.url, { timeout: 20000 });
          return { row, groups: res.status < 400 ? topicPageGroups(res.body, res.url || row.url, articleId) : [] };
        } catch {
          return { row, groups: [] as TopicStory[][] }; // unreachable: try again in 6 hours
        }
      }),
    ),
  );
  // Which topic pages each link appears on, per outlet.
  const seenOn = new Map<string, Set<number>>();
  for (const { row, groups } of pages)
    for (const key of new Set(groups.flat().map((s) => s.key))) {
      const k = `${row.media} ${key}`;
      seenOn.set(k, (seenOn.get(k) ?? new Set()).add(row.id));
    }
  let found = 0;
  for (const { row, groups } of pages) {
    const own = groups.filter((g) => g.filter((s) => (seenOn.get(`${row.media} ${s.key}`)?.size ?? 0) > 1).length / g.length <= 0.5);
    let stories: TopicStory[] = [];
    let best = 0;
    for (const group of own.slice(0, 8)) {
      const [{ n }] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(articles)
        .where(
          and(
            eq(articles.media, articleMediaOf(row.media)),
            inArray(
              articles.urlKey,
              group.map((s) => s.key),
            ),
          ),
        );
      if (Number(n) >= 2 && Number(n) > best) {
        best = Number(n);
        stories = group;
      }
    }
    if (!stories.length) stories = own.find(looksLikeStories) ?? [];
    if (stories.length) found++;
    await db
      .update(topics)
      .set({ pageStories: stories.slice(0, 200), pageCheckedAt: now() })
      .where(eq(topics.id, row.id));
  }
  return { checked: due.length, found };
}

export async function latestTopics(db: Db, media: string, limit = 30) {
  return db.select().from(topics).where(eq(topics.media, media)).orderBy(desc(topics.firstSeen), topics.id).limit(limit);
}
export async function latestTopicPerMedia(db: Db, perMedia = 1) {
  const rows = await Promise.all(TOPIC_RULES.map((rule) => latestTopics(db, rule.media, perMedia)));
  return Object.fromEntries(TOPIC_RULES.map((rule, i) => [rule.media, rows[i]]));
}
// When each outlet was first crawled: topics stored in that run were already
// listed before tracking began, so their first_seen is not a start date.
export async function firstRunPerMedia(db: Db) {
  const rows = await db
    .select({ media: topics.media, first: sql<Date>`MIN(${topics.firstSeen})`.mapWith(topics.firstSeen) })
    .from(topics)
    .groupBy(topics.media);
  return Object.fromEntries(rows.map((r) => [r.media, r.first]));
}
