import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import pLimit from 'p-limit';
import { fetchText } from '../crawl/fetch.ts';
import { sourceByMedia } from '../crawl/registry.ts';
import { looksLikeStories, type TopicStory, topicPageGroups } from '../crawl/topic-page.ts';
import { fetchTopicListings, TOPIC_RULES } from '../crawl/topics.ts';
import type { Db } from '../db/client.ts';
import { articles, crawlRuns, topics } from '../db/schema.ts';

export async function runTopicsJob(
  db: Db,
  { log = (_o: object, _m: string) => {}, now = () => new Date(), rules = TOPIC_RULES, refreshPages = true } = {},
) {
  const results: Record<string, { items: number; inserted: number; error?: string }> = {};
  for (const rule of rules) {
    const started = now();
    const [run] = await db
      .insert(crawlRuns)
      .values({ media: rule.media, stage: 'topic', startedAt: started, status: 'running' })
      .$returningId();
    try {
      const { items, sources } = await fetchTopicListings(rule);
      const failures = sources.filter((source) => source.error);
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
        // Publishers rename living topics and replace covers; retain the
        // original discovery date, but refresh the editorial metadata.
        for (const t of items)
          await db
            .update(topics)
            .set({
              title: t.title,
              image: t.image ?? sql`${topics.image}`,
              category: t.category ?? sql`${topics.category}`,
            })
            .where(and(eq(topics.media, rule.media), eq(topics.url, t.url)));
      }
      await db
        .update(crawlRuns)
        .set({
          finishedAt: now(),
          status: items.length ? (failures.length ? 'partial' : 'ok') : 'failed',
          fetched: items.length,
          inserted,
          failed: failures.length,
          detail: JSON.stringify({ sources }),
        })
        .where(eq(crawlRuns.id, run.id));
      results[rule.media] = {
        items: items.length,
        inserted,
        ...(failures.length ? { error: failures.map((s) => `${s.url}: ${s.error}`).join('; ') } : {}),
      };
    } catch (error) {
      await db
        .update(crawlRuns)
        .set({ finishedAt: now(), status: 'failed', detail: String((error as Error).message) })
        .where(eq(crawlRuns.id, run.id));
      results[rule.media] = { items: 0, inserted: 0, error: (error as Error).message };
    }
  }
  const pages = refreshPages ? await refreshTopicPages(db, { now }).catch((error) => ({ error: (error as Error).message })) : null;
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

/** Latest attempt and last fully successful check are separate: failures must
 * not silently look fresh merely because old topics are still in storage. */
export async function topicSourceChecks(db: Db, now = new Date()) {
  const entries = await Promise.all(
    TOPIC_RULES.map(async (rule) => {
      const [latest] = await db
        .select()
        .from(crawlRuns)
        .where(and(eq(crawlRuns.media, rule.media), eq(crawlRuns.stage, 'topic')))
        .orderBy(desc(crawlRuns.startedAt), desc(crawlRuns.id))
        .limit(1);
      const [success] = await db
        .select({ at: crawlRuns.finishedAt })
        .from(crawlRuns)
        .where(and(eq(crawlRuns.media, rule.media), eq(crawlRuns.stage, 'topic'), eq(crawlRuns.status, 'ok')))
        .orderBy(desc(crawlRuns.startedAt), desc(crawlRuns.id))
        .limit(1);
      return [
        rule.media,
        {
          checkedAt: latest?.finishedAt?.toISOString() ?? null,
          lastSuccessAt: success?.at?.toISOString() ?? null,
          status: latest?.status ?? 'pending',
          fetched: latest?.fetched ?? 0,
          stale: !success?.at || +now - +success.at > 3 * 3600e3,
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}
