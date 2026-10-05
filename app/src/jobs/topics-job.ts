import { and, desc, eq, gte, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import pLimit from 'p-limit';
import { extractFeatureArticle } from '../crawl/feature-article.ts';
import { fetchText } from '../crawl/fetch.ts';
import { sourceByMedia } from '../crawl/registry.ts';
import { carryStoryDates, fetchStoryDates, type KnownStoryDate, storiesToDate, storyFetchBudget } from '../crawl/story-pages.ts';
import { urlKey } from '../crawl/text.ts';
import { classifyTopic, firstRunEnd, storyDate } from '../crawl/topic-kind.ts';
import { articleShapes, pickTopicStories, type TopicStory, topicPageDate, topicPageGroups, topicPageImage } from '../crawl/topic-page.ts';
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
import { indexFeatureArticle, indexMissingFeatureArticles } from './feature-article.ts';
import { articleMediaOf, indexTopicStories, mergeTopicStories } from './topic-stories.ts';

export { articleMediaOf, TOPIC_ARTICLE_MEDIA } from './topic-stories.ts';

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
  const featureIndexes = await indexMissingFeatureArticles(db);
  const pages = refreshPages ? await refreshTopicPages(db, { now }).catch((error) => ({ error: (error as Error).message })) : null;
  log({ ...results, pages, featureIndexes }, 'topics job finished');
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

// Re-read recently listed topic pages (active 議題 every 6 hours, the rest
// every 3 days) and keep each topic's own story list. Blocks repeated on the
// outlet's other topic pages ("latest news", "most read", other topics' picks)
// are site furniture: a group is skipped when over half of its links also
// appear on another topic page of the same outlet fetched in this run, among
// the stories stored for two other topics of the outlet (not the topic's
// parent or sub-topics), or are the outlet's topic pages themselves. Of the
// rest, pickTopicStories takes the one with the most stories we crawled,
// else the one that reads like headlines, leaving out tag, author and other
// navigation links and preferring dated stories and links shaped like the
// outlet's article URLs. A story is dated by our crawled copy, the topic
// page, the date stored for it by an earlier check, its URL, and — for the
// newest and oldest stories still undated — its own page (story-pages.ts,
// at most `storyFetches` pages per run). These dates classify the topic
// (議題/專題, classifyTopic) unless its listing declared the kind; a page
// without stories that is itself one article is dated by its own publish time.
// Sub-topic links (rule.children) become rows.
// Rows never classified are refreshed even when no longer listed.
export async function refreshTopicPages(
  db: Db,
  {
    now = () => new Date(),
    limit = 300,
    fetch = fetchText,
    storyFetches = 150,
  }: { now?: () => Date; limit?: number; fetch?: typeof fetchText; storyFetches?: number } = {},
) {
  const t = now().getTime();
  // 議題 still gaining stories are re-read every 6 hours so 最後更新 stays
  // current; 專題, stopped 議題 and undated pages every 3 days.
  const active = and(eq(topics.kind, 'topic'), gte(topics.storyLastAt, new Date(t - 90 * 86400e3)));
  // Legacy ID-only story keys need a fresh publisher page to recover their URLs.
  const missingUrls = sql`JSON_LENGTH(${topics.pageStories}) > COALESCE(JSON_LENGTH(JSON_EXTRACT(${topics.pageStories}, '$[*].url')), 0)`;
  // Topics still without a cover go first: the page's share image fills it.
  const due = await db
    .select({
      id: topics.id,
      media: topics.media,
      url: topics.url,
      title: topics.title,
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
        or(gte(topics.lastSeen, new Date(t - 3 * 86400e3)), isNull(topics.kindSource), missingUrls),
        or(
          isNull(topics.pageCheckedAt),
          and(active, lt(topics.pageCheckedAt, new Date(t - 6 * 3600e3))),
          lt(topics.pageCheckedAt, new Date(t - 3 * 86400e3)),
        ),
      ),
    )
    .orderBy(
      sql`NOT COALESCE(${missingUrls}, FALSE)`,
      sql`${topics.image} IS NOT NULL`,
      sql`${topics.pageCheckedAt} IS NOT NULL`,
      sql`NOT (${active})`,
      topics.pageCheckedAt,
      desc(topics.lastSeen),
    )
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
            article: ok ? extractFeatureArticle(res.body, row.url, sourceByMedia(articleMediaOf(row.media))?.article) : null,
            groups: ok ? topicPageGroups(res.body, res.url || row.url, articleId, { now: now() }) : [],
            pageDate: ok ? topicPageDate(res.body, res.url || row.url, now()) : null,
            image: ok && !row.image ? topicPageImage(res.body, res.url || row.url) : null,
            children: ok && childSelector ? topicChildren(res.body, res.url || row.url, childSelector) : [],
          };
        } catch {
          // Unreachable: try again in 6 hours.
          return { row, ok: false, article: null, groups: [] as TopicStory[][], pageDate: null, image: null, children: [] };
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
  // Earlier runs: the stories stored for the outlet's other topics. A run
  // reads few pages per outlet, so a sidebar is often on just one page here.
  const storedOn = await storedTopicKeys(db, [...new Set(pages.filter((p) => p.ok).map((p) => p.row.media))]);
  const shapes = new Map<string, Set<string>>();
  const shapesOf = async (media: string) => {
    let s = shapes.get(media);
    if (!s) {
      const rows = await db
        .select({ key: articles.urlKey })
        .from(articles)
        .where(eq(articles.media, articleMediaOf(media)))
        .orderBy(desc(articles.id))
        .limit(1000);
      s = articleShapes(rows.flatMap((r) => (r.key ? [r.key] : [])));
      shapes.set(media, s);
    }
    return s;
  };
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
  // 1. Each readable page's own stories, with the dates stored for them before.
  const plans: Array<{ row: (typeof due)[number]; stories: TopicStory[]; piece: Date | null; crawledAt: Map<string, Date> }> = [];
  for (const { row, ok, groups, pageDate } of pages) {
    if (!ok) {
      // Keep the stored stories; only a page we could read may change them.
      await db
        .update(topics)
        .set({ pageCheckedAt: now(), kindSource: row.kindSource ?? 'auto' })
        .where(eq(topics.id, row.id));
      continue;
    }
    const keys = [...new Set(groups.flat().map((s) => s.key))];
    const crawledAt = new Map(
      keys.length
        ? (
            await db
              .select({ key: articles.urlKey, at: articles.publishedAt })
              .from(articles)
              .where(and(eq(articles.media, articleMediaOf(row.media)), inArray(articles.urlKey, keys)))
          ).flatMap((r) => (r.key ? [[r.key, r.at] as const] : []))
        : [],
    );
    const stored = storedOn.get(row.media);
    const family = (id: number) => id === row.id || id === row.parentId || stored?.parentOf.get(id) === row.id;
    let stories = pickTopicStories(groups, {
      furniture: (key) =>
        (seenOn.get(`${row.media} ${key}`)?.size ?? 0) > 1 ||
        [...(stored?.rowsOf.get(key) ?? [])].filter((id) => !family(id)).length >= 2 ||
        !!stored?.topicPages.has(key),
      crawled: (key) => crawledAt.has(key),
      shapes: await shapesOf(row.media),
    });
    if (stories.length) found++;
    // Dates read earlier (on the topic page or the story's own) carry over.
    stories = carryStoryDates(stories.slice(0, 200), new Map((row.pageStories ?? []).map((s) => [s.key, s])));
    // A page without a story list that is one article: a single-piece 專題,
    // dated by its publish time. Not a 議題 (its stories may load client-side)
    // unless it has no dates at all, which makes it a 專題 anyway (below).
    const feature = row.kind === 'feature' || (row.kindSource !== 'rule' && !row.storyLastAt);
    const piece = !stories.length && feature ? pageDate : null;
    plans.push({ row, stories, piece, crawledAt });
  }
  // 2. Stories still undated at either end of their list (storiesToDate): the
  // date stored for the same story on another topic of the outlet, else its
  // own page — at most `storyFetches` per run (20 per outlet), 議題 before 專題.
  const dateOf = (p: (typeof plans)[number]) => (s: TopicStory) => storyDate(s, p.crawledAt.get(s.key), now());
  const wanted = plans.map((p) => (p.piece ? [] : storiesToDate(p.stories, dateOf(p))));
  const elsewhere = await storedStoryDates(
    db,
    plans.flatMap((p, i) => wanted[i].map((s) => ({ media: p.row.media, key: s.key }))),
  );
  for (const [i, p] of plans.entries()) {
    const other = elsewhere.get(p.row.media);
    if (!other?.size || !wanted[i].length) continue;
    p.stories = carryStoryDates(p.stories, other);
    wanted[i] = storiesToDate(p.stories, dateOf(p));
  }
  const targets = storyFetchBudget(
    plans.map((p, i) => ({ kind: p.row.kind, media: p.row.media, stories: wanted[i] })),
    storyFetches,
    20,
  );
  const read = await fetchStoryDates(targets, { fetch, now: now() });
  let storiesDated = 0;
  for (const p of plans)
    p.stories = p.stories.map((s) => {
      if (s.date || !read.has(s.key)) return s;
      const at = read.get(s.key);
      if (!at) return { ...s, dateless: true };
      storiesDated++;
      return { ...s, date: at.toISOString() };
    });
  const pageArticles = new Map(pages.map((p) => [p.row.id, p.article]));
  let featureArticles = 0;
  // 3. The topic's dates, kind and growth.
  for (const { row, stories, piece, crawledAt } of plans) {
    const dates = piece
      ? [piece]
      : stories.flatMap((s) => {
          const at = storyDate(s, crawledAt.get(s.key), now());
          return at ? [at] : [];
        });
    // Dates are recomputed in full on every check, so a story list with no
    // datable story clears them (stale values would keep a wrong 最後更新);
    // a page without any list (stories loading client-side) keeps the old ones.
    const keep = !stories.length;
    const first = dates.length ? new Date(Math.min(...dates.map(Number))) : keep ? row.storyFirstAt : null;
    const last = dates.length ? new Date(Math.max(...dates.map(Number))) : keep ? row.storyLastAt : null;
    // Growth: a story key we had not stored before, newer than the stored newest.
    const before = new Set((row.pageStories ?? []).map((s) => s.key));
    const grew = before.size > 0 && stories.some((s) => !before.has(s.key)) && (!row.storyLastAt || !last || +last > +row.storyLastAt);
    let kind: TopicKind | null = null;
    if (row.kindSource !== 'rule') {
      if (row.parentId) kind = stories.length ? ((parentKind.get(row.parentId) as TopicKind | undefined) ?? 'topic') : 'feature';
      else if (piece) kind = 'feature';
      else if (first && last) kind = classifyTopic({ storyDates: [first, last], grew: grew || !!row.storyGrewAt, now: now() }).kind;
      else if (!stories.length) kind = 'feature';
      // Stories without any known date: leave the kind as it is.
      if (kind) classified++;
    }
    await db
      .update(topics)
      .set({
        // Keep original URLs for articles the news crawler has not collected.
        pageStories: mergeTopicStories(row.pageStories ?? [], stories),
        pageCheckedAt: now(),
        storyCount: stories.length || sql`${topics.storyCount}`,
        storyFirstAt: first,
        storyLastAt: last,
        ...(grew ? { storyGrewAt: now() } : {}),
        ...(row.kindSource !== 'rule' ? { kindSource: 'auto', ...(kind ? { kind } : {}) } : {}),
      })
      .where(eq(topics.id, row.id));
    const detail = pageArticles.get(row.id);
    if ((kind ?? row.kind) === 'feature' && detail) featureArticles += await indexFeatureArticle(db, row, detail);
  }
  let indexed = 0;
  for (const { row, stories } of plans)
    indexed += await indexTopicStories(db, row.media, mergeTopicStories(row.pageStories ?? [], stories));
  return { checked: due.length, found, covers, children, classified, indexed, featureArticles, storyFetches: targets.length, storiesDated };
}

/** Dates stored for these stories on any topic of their outlet, by outlet and key. */
export async function storedStoryDates(db: Db, wanted: Array<{ media: string; key: string }>) {
  const out = new Map<string, Map<string, KnownStoryDate>>();
  const byMedia = new Map<string, Set<string>>();
  for (const w of wanted) byMedia.set(w.media, (byMedia.get(w.media) ?? new Set()).add(w.key));
  for (const [media, keys] of byMedia) {
    const [rows] = (await db.execute(sql`
      SELECT jt.k AS story, MIN(jt.d) AS published
      FROM ${topics}, JSON_TABLE(${topics.pageStories}, '$[*]' COLUMNS (k VARCHAR(512) PATH '$.key', d VARCHAR(40) PATH '$.date')) AS jt
      WHERE ${topics.media} = ${media} AND jt.d IS NOT NULL AND jt.k IN (${sql.join(
        [...keys].map((k) => sql`${k}`),
        sql`, `,
      )})
      GROUP BY jt.k`)) as unknown as [Array<{ story: string; published: string }>];
    out.set(media, new Map(rows.map((r) => [r.story, { date: r.published }])));
  }
  return out;
}

/** Per outlet, which topic rows store each story key, each row's parent, and
 *  the url_keys of its topic pages (a link to another topic is not a story). */
export async function storedTopicKeys(db: Db, media: string[]) {
  const out = new Map<string, { rowsOf: Map<string, Set<number>>; parentOf: Map<number, number | null>; topicPages: Set<string> }>();
  if (!media.length) return out;
  const rows = await db
    .select({
      id: topics.id,
      media: topics.media,
      url: topics.url,
      parentId: topics.parentId,
      keys: sql<unknown>`JSON_EXTRACT(${topics.pageStories}, '$[*].key')`,
    })
    .from(topics)
    .where(inArray(topics.media, media));
  for (const r of rows) {
    const m = out.get(r.media) ?? { rowsOf: new Map(), parentOf: new Map(), topicPages: new Set() };
    out.set(r.media, m);
    m.parentOf.set(r.id, r.parentId);
    m.topicPages.add(urlKey(r.url, sourceByMedia(articleMediaOf(r.media))?.list.articleId));
    const keys = typeof r.keys === 'string' ? (JSON.parse(r.keys) as unknown) : r.keys;
    if (Array.isArray(keys)) for (const k of keys) if (typeof k === 'string') m.rowsOf.set(k, (m.rowsOf.get(k) ?? new Set()).add(r.id));
  }
  return out;
}

/** 最後更新 (topicUpdatedAt) in SQL: the newest story, else first sighting
 *  unless backlog — stored backlog, or stored in the outlet's first crawl run
 *  (before `firstRunEnd`, see firstRunPerMedia). NULL when unknown. */
export function updatedAtSql(firstRunEnd?: Date) {
  const fresh = firstRunEnd ? sql` AND ${topics.firstSeen} >= ${firstRunEnd}` : sql``;
  return sql`COALESCE(${topics.storyLastAt}, CASE WHEN ${topics.backlog} = 0${fresh} THEN ${topics.firstSeen} END)`;
}

/** Most recently updated first (unknown last), then newest first sighting, so
 *  the limit keeps the most recently updated; `topLevel` leaves out sub-topics
 *  (they are listed under their parent). An outlet has at most ~1,000 rows:
 *  sorting on the expression needs no index. */
export async function latestTopics(
  db: Db,
  media: string,
  limit = 30,
  kind: TopicKind = 'topic',
  { topLevel = false, firstRunEnd }: { topLevel?: boolean; firstRunEnd?: Date } = {},
) {
  return db
    .select()
    .from(topics)
    .where(and(eq(topics.media, media), eq(topics.kind, kind), topLevel ? isNull(topics.parentId) : undefined))
    .orderBy(sql`${updatedAtSql(firstRunEnd)} DESC`, desc(topics.firstSeen), topics.id)
    .limit(limit);
}
/** Every top-level 議題 and 專題 of every outlet, without the stored page
 *  stories (~4,500 rows, a few ms): the tag summary and tag/title search. */
export async function allTopLevelTopics(db: Db) {
  return db
    .select({
      id: topics.id,
      media: topics.media,
      firstSeen: topics.firstSeen,
      title: topics.title,
      url: topics.url,
      image: topics.image,
      kind: topics.kind,
      backlog: topics.backlog,
      sponsored: topics.sponsored,
      parentId: topics.parentId,
      storyFirstAt: topics.storyFirstAt,
      storyLastAt: topics.storyLastAt,
      storyCount: topics.storyCount,
    })
    .from(topics)
    .where(isNull(topics.parentId));
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
/** Each outlet's most recently updated; `firstRun` from firstRunPerMedia. */
export async function latestTopicPerMedia(db: Db, perMedia = 1, kind: TopicKind = 'topic', firstRun: Record<string, Date> = {}) {
  const rows = await Promise.all(
    TOPIC_RULES.map((rule) => {
      const first = firstRun[rule.media];
      return latestTopics(db, rule.media, perMedia, kind, { firstRunEnd: first && firstRunEnd(first) });
    }),
  );
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
