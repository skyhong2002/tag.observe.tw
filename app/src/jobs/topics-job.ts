import { and, desc, eq, gte, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import pLimit from 'p-limit';
import { fetchText } from '../crawl/fetch.ts';
import { sourceByMedia } from '../crawl/registry.ts';
import { classifyTopic, dateFromStoryUrl } from '../crawl/topic-kind.ts';
import { looksLikeStories, type TopicStory, topicPageGroups, topicPageImage } from '../crawl/topic-page.ts';
import {
  childSelectorFor,
  fetchTopicListings,
  TOPIC_RULES,
  type TopicKind,
  type TopicSourceResult,
  topicChildren,
  topicListings,
} from '../crawl/topics.ts';
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
      const known = await knownTopicSources(db, rule.media);
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
              ...(t.kind ? { kind: t.kind, kindSource: 'rule' } : {}),
              sponsored: !!t.sponsored,
              ...storyDateFields(t.storyDates),
              // A source we never crawled before (or a page past the first)
              // lists what the outlet already had: not new this run.
              backlog: !known.has(t.source) || t.page > 1,
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
              ...(t.kind ? { kind: t.kind, kindSource: 'rule' } : {}),
              ...(t.sponsored !== undefined ? { sponsored: t.sponsored } : {}),
            })
            .where(and(eq(topics.media, rule.media), eq(topics.url, t.url)));
        // Listings that carry story dates classify their new auto items right
        // away. They only show the latest few stories, so once the topic page
        // has been read (fuller list) its classification and dates stand.
        for (const t of items) {
          if (t.kind || !t.storyDates?.length) continue;
          const { kind } = classifyTopic({ storyDates: t.storyDates, grew: false, now: started });
          await db
            .update(topics)
            .set({ kind: sql`IF(${topics.storyGrewAt} IS NULL, ${kind}, 'topic')`, kindSource: 'auto' })
            .where(and(eq(topics.media, rule.media), eq(topics.url, t.url), isNull(topics.kindSource)));
        }
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

function storyDateFields(dates: Date[] | undefined) {
  if (!dates?.length) return {};
  const times = dates.map(Number);
  return { storyFirstAt: new Date(Math.min(...times)), storyLastAt: new Date(Math.max(...times)), storyCount: dates.length };
}

/** Listing URLs that yielded items in an earlier topic run of this outlet. */
export async function knownTopicSources(db: Db, media: string): Promise<Set<string>> {
  const runs = await db
    .select({ detail: crawlRuns.detail })
    .from(crawlRuns)
    .where(and(eq(crawlRuns.media, media), eq(crawlRuns.stage, 'topic'), inArray(crawlRuns.status, ['ok', 'partial'])))
    .orderBy(desc(crawlRuns.startedAt))
    .limit(200);
  const known = new Set<string>();
  for (const { sources } of runs.map((r) => parseTopicDetail(r.detail)))
    for (const source of sources) if (source.items > 0) known.add(source.url);
  return known;
}
/** crawl_runs.detail of a topic run: JSON { sources } or, for a crashed run, the error text. */
export function parseTopicDetail(detail: string | null): { sources: TopicSourceResult[]; error?: string } {
  if (!detail) return { sources: [] };
  try {
    const parsed = JSON.parse(detail) as { sources?: TopicSourceResult[] };
    return { sources: Array.isArray(parsed?.sources) ? parsed.sources : [] };
  } catch {
    return { sources: [], error: detail };
  }
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
// The chosen stories' dates classify the topic (議題/專題, classifyTopic) unless
// its listing declared the kind; sub-topic links (rule.children) become rows.
// Rows never classified are refreshed even when no longer listed.
export async function refreshTopicPages(
  db: Db,
  { now = () => new Date(), limit = 60, fetch = fetchText }: { now?: () => Date; limit?: number; fetch?: typeof fetchText } = {},
) {
  const t = now().getTime();
  // Topics still without a cover go first: the page's share image fills it.
  const due = await db
    .select({
      id: topics.id,
      media: topics.media,
      url: topics.url,
      image: topics.image,
      kind: topics.kind,
      kindSource: topics.kindSource,
      backlog: topics.backlog,
      parentId: topics.parentId,
      pageStories: topics.pageStories,
      storyFirstAt: topics.storyFirstAt,
      storyLastAt: topics.storyLastAt,
      storyGrewAt: topics.storyGrewAt,
    })
    .from(topics)
    .where(
      and(
        or(gte(topics.lastSeen, new Date(t - 3 * 86400e3)), isNull(topics.kindSource)),
        or(isNull(topics.pageCheckedAt), lt(topics.pageCheckedAt, new Date(t - 6 * 3600e3))),
      ),
    )
    .orderBy(sql`${topics.image} IS NOT NULL`, sql`${topics.pageCheckedAt} IS NOT NULL`, topics.pageCheckedAt, desc(topics.lastSeen))
    .limit(limit);
  const gate = pLimit(2);
  const pages = await Promise.all(
    due.map((row) =>
      gate(async () => {
        const articleId = sourceByMedia(articleMediaOf(row.media))?.list.articleId;
        const childSelector = childSelectorFor(row.media, row.url);
        try {
          const res = await fetch(row.url, { timeout: 20000 });
          const ok = res.status < 400;
          return {
            row,
            ok,
            groups: ok ? topicPageGroups(res.body, res.url || row.url, articleId) : [],
            image: ok && !row.image ? topicPageImage(res.body, res.url || row.url) : null,
            children: ok && childSelector ? topicChildren(res.body, res.url || row.url, childSelector) : [],
          };
        } catch {
          // Unreachable: try again in 6 hours.
          return { row, ok: false, groups: [] as TopicStory[][], image: null, children: [] };
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
  // A share image that several of the outlet's topics (or its listing's
  // fallback) use is the site logo, not a cover.
  const fallbackOf = new Map(TOPIC_RULES.map((r) => [r.media, r.fallbackImage]));
  const candidates = pages.filter((p): p is typeof p & { image: string } => !!p.image && p.image !== fallbackOf.get(p.row.media));
  const shared = new Set<string>();
  const seenImage = new Map<string, number>();
  for (const p of candidates) {
    const k = `${p.row.media} ${p.image}`;
    seenImage.set(k, (seenImage.get(k) ?? 0) + 1);
    if ((seenImage.get(k) ?? 0) > 1) shared.add(k);
  }
  if (candidates.length) {
    const stored = await db
      .select({ media: topics.media, image: topics.image })
      .from(topics)
      .where(
        inArray(
          topics.image,
          candidates.map((p) => p.image),
        ),
      );
    for (const r of stored) shared.add(`${r.media} ${r.image}`);
  }
  // Outlets publish dead share images too (403 from a bucket, 404 on a
  // microsite): only a URL that actually serves an image is a cover.
  let covers = 0;
  for (const p of candidates) {
    if (shared.has(`${p.row.media} ${p.image}`)) continue;
    if (!(await servesImage(p.image, fetch))) continue;
    await db
      .update(topics)
      .set({ image: p.image.slice(0, 512) })
      .where(and(eq(topics.id, p.row.id), isNull(topics.image)));
    covers++;
  }
  // Sub-topics listed on a parent's page: kept fresh as long as the parent is.
  let children = 0;
  for (const { row, children: links } of pages) {
    if (!links.length) continue;
    const r = await db
      .insert(topics)
      .ignore()
      .values(
        links.map((c) => ({
          media: row.media,
          url: c.url,
          title: c.title,
          firstSeen: now(),
          lastSeen: now(),
          parentId: row.id,
          kind: row.kind,
          backlog: row.backlog,
        })),
      );
    children += (r as unknown as [{ affectedRows: number }])[0]?.affectedRows ?? 0;
    await db
      .update(topics)
      .set({ lastSeen: now(), parentId: sql`COALESCE(${topics.parentId}, ${row.id})` })
      .where(
        and(
          eq(topics.media, row.media),
          ne(topics.id, row.id),
          inArray(
            topics.url,
            links.map((c) => c.url),
          ),
        ),
      );
  }
  const parentIds = [...new Set(due.flatMap((r) => (r.parentId ? [r.parentId] : [])))];
  const parentKind = new Map(
    parentIds.length
      ? (await db.select({ id: topics.id, kind: topics.kind }).from(topics).where(inArray(topics.id, parentIds))).map((p) => [p.id, p.kind])
      : [],
  );
  let found = 0;
  let classified = 0;
  for (const { row, ok, groups } of pages) {
    if (!ok) {
      // Keep the stored stories; only a page we could read may change them.
      await db
        .update(topics)
        .set({ pageCheckedAt: now(), kindSource: row.kindSource ?? 'auto' })
        .where(eq(topics.id, row.id));
      continue;
    }
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
    stories = stories.slice(0, 200);
    const dates = await storyDates(db, articleMediaOf(row.media), stories);
    const first = dates.length ? new Date(Math.min(...dates.map(Number))) : row.storyFirstAt;
    const last = dates.length ? new Date(Math.max(...dates.map(Number))) : row.storyLastAt;
    // Growth: a story key we had not stored before, newer than the stored newest.
    const before = new Set((row.pageStories ?? []).map((s) => s.key));
    const grew = before.size > 0 && stories.some((s) => !before.has(s.key)) && (!row.storyLastAt || !last || +last > +row.storyLastAt);
    let kind: TopicKind | null = null;
    if (row.kindSource !== 'rule') {
      if (row.parentId) kind = stories.length ? ((parentKind.get(row.parentId) as TopicKind | undefined) ?? 'topic') : 'feature';
      else if (first && last) kind = classifyTopic({ storyDates: [first, last], grew: grew || !!row.storyGrewAt, now: now() }).kind;
      else if (!stories.length) kind = 'feature';
      // Stories without any known date: leave the kind as it is.
      if (kind) classified++;
    }
    await db
      .update(topics)
      .set({
        pageStories: stories,
        pageCheckedAt: now(),
        storyCount: stories.length || sql`${topics.storyCount}`,
        storyFirstAt: first,
        storyLastAt: last,
        ...(grew ? { storyGrewAt: now() } : {}),
        ...(row.kindSource !== 'rule' ? { kindSource: 'auto', ...(kind ? { kind } : {}) } : {}),
      })
      .where(eq(topics.id, row.id));
  }
  return { checked: due.length, found, covers, children, classified };
}

/** Publish dates of a topic's stories: our crawled copy, else the date in the URL. */
async function storyDates(db: Db, media: string, stories: TopicStory[]): Promise<Date[]> {
  if (!stories.length) return [];
  const rows = await db
    .select({ key: articles.urlKey, at: articles.publishedAt })
    .from(articles)
    .where(
      and(
        eq(articles.media, media),
        inArray(
          articles.urlKey,
          stories.map((s) => s.key),
        ),
      ),
    );
  const crawled = new Map(rows.map((r) => [r.key, r.at]));
  return stories.flatMap((s) => {
    const at = crawled.get(s.key) ?? dateFromStoryUrl(s.key);
    return at ? [at] : [];
  });
}

/** Newest first; `topLevel` leaves out sub-topics (they are listed under their parent). */
export async function latestTopics(db: Db, media: string, limit = 30, kind: TopicKind = 'topic', { topLevel = false } = {}) {
  return db
    .select()
    .from(topics)
    .where(and(eq(topics.media, media), eq(topics.kind, kind), topLevel ? isNull(topics.parentId) : undefined))
    .orderBy(desc(topics.firstSeen), topics.id)
    .limit(limit);
}
/** Sub-topics of the given topics, of any kind. */
export async function topicChildrenOf(db: Db, parentIds: number[]) {
  if (!parentIds.length) return [];
  return db.select().from(topics).where(inArray(topics.parentId, parentIds)).orderBy(desc(topics.firstSeen), topics.id);
}
export type TopicCounts = Record<TopicKind, number>;
/** How many topics and features each outlet has listed so far (all time). */
export async function topicCountPerMedia(db: Db): Promise<Record<string, TopicCounts>> {
  const rows = await db
    .select({ media: topics.media, kind: topics.kind, count: sql<number>`COUNT(*)`.mapWith(Number) })
    .from(topics)
    .groupBy(topics.media, topics.kind);
  const out: Record<string, TopicCounts> = {};
  for (const r of rows) {
    out[r.media] ??= { topic: 0, feature: 0 };
    if (r.kind === 'topic' || r.kind === 'feature') out[r.media][r.kind] += r.count;
  }
  return out;
}
export async function latestTopicPerMedia(db: Db, perMedia = 1, kind: TopicKind = 'topic') {
  const rows = await Promise.all(TOPIC_RULES.map((rule) => latestTopics(db, rule.media, perMedia, kind)));
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
      // The run in progress has no per-source detail yet.
      const [finished] =
        latest && !latest.finishedAt
          ? await db
              .select()
              .from(crawlRuns)
              .where(and(eq(crawlRuns.media, rule.media), eq(crawlRuns.stage, 'topic'), sql`${crawlRuns.finishedAt} IS NOT NULL`))
              .orderBy(desc(crawlRuns.startedAt), desc(crawlRuns.id))
              .limit(1)
          : [latest];
      const detail = parseTopicDetail(finished?.detail ?? null);
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
          sources: detail.sources.map((s) => ({
            url: s.url,
            // Runs before kinds existed: the listing's current declaration.
            kind: s.kind ?? topicListings(rule).find((l) => l.url === s.url)?.kind ?? 'auto',
            items: s.items,
            ...(s.pages ? { pages: s.pages } : {}),
            ...(s.error ? { error: s.error } : {}),
          })),
          ...(detail.error ? { error: detail.error } : {}),
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/** 2xx and not a page or API document; CDNs label images octet-stream or "png". */
async function servesImage(url: string, fetch: typeof fetchText): Promise<boolean> {
  try {
    const res = await fetch(url, { timeout: 10000, retries: 0 });
    return res.status >= 200 && res.status < 300 && !/^(text\/|application\/(xml|json|xhtml))/i.test(res.contentType);
  } catch {
    return false;
  }
}
