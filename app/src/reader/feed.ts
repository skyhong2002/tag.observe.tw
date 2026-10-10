import { and, desc, eq, gte, inArray, notInArray, or, type SQL, sql } from 'drizzle-orm';
import catalog from '../../data/favicon-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articles, articleTags, events, eventThreads, userFollows } from '../db/schema.ts';
import { type FeedItem, xml } from '../feeds.ts';
import { rowJournalists } from '../journalists/aggregate.ts';
import { outletIdentity } from '../similarity/attribution.ts';
import type { Follow, FollowKind } from './validate.ts';

// 我的動態 (/my/) and the private RSS (/feeds/u/<token>.xml): the last week of
// articles carrying a followed tag, from a followed outlet or credited to a
// followed journalist, plus where each followed event stands now.

const ORIGIN = 'https://tag.observe.tw';
export const FEED_DAYS = 7;
const PER_KIND = 300;
export const FEED_LIMIT = 150;
const titles = catalog as unknown as Record<string, { title: string | null }>;
export const mediaTitle = (media: string) => titles[media]?.title ?? outletIdentity(media).name;

export type FeedArticle = {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  publishedAt: string;
  tags: string[];
  /** The follows that brought this article in. */
  matched: Follow[];
};
export type FeedEvent = {
  id: number;
  title: string;
  tags: string[];
  firstTime: string;
  lastTime: string;
  /** Still in the latest hourly event table. */
  active: boolean;
  headlines: Array<{ title: string; url: string; media: string; mediaTitle: string }>;
};
export type ReaderFeed = { days: number; follows: Follow[]; articles: FeedArticle[]; events: FeedEvent[] };

export async function loadFollows(db: Db, userId: number): Promise<Follow[]> {
  const rows = await db
    .select({ kind: userFollows.kind, target: userFollows.target })
    .from(userFollows)
    .where(eq(userFollows.userId, userId))
    .orderBy(desc(userFollows.createdAt));
  return rows.map((row) => ({ kind: row.kind as FollowKind, target: row.target }));
}

const fields = {
  id: articles.id,
  media: articles.media,
  title: articles.title,
  url: articles.url,
  publishedAt: articles.publishedAt,
  tags: articles.tags,
};
type Row = { id: number; media: string; title: string; url: string; publishedAt: Date; tags: string[] };

export async function readerFeed(db: Db, follows: Follow[], hiddenMedia: string[] = [], now = new Date()): Promise<ReaderFeed> {
  const since = new Date(now.getTime() - FEED_DAYS * 86_400e3);
  const of = (kind: FollowKind) => follows.filter((f) => f.kind === kind).map((f) => f.target);
  const [tags, media, people, threadIds] = [of('tag'), of('media'), of('journalist'), of('event').map(Number)];
  const hidden = hiddenMedia.length ? notInArray(articles.media, hiddenMedia) : undefined;
  const found = new Map<number, { row: Row; matched: Follow[] }>();
  const add = (rows: Row[], match: (row: Row) => Follow[]) => {
    for (const row of rows) {
      const matched = match(row);
      if (!row.title || !matched.length) continue;
      const entry = found.get(row.id) ?? { row, matched: [] };
      entry.matched.push(...matched.filter((m) => !entry.matched.some((e) => e.kind === m.kind && e.target === m.target)));
      found.set(row.id, entry);
    }
  };

  const [tagRows, mediaRows, peopleRows] = await Promise.all([
    tags.length
      ? db
          .selectDistinct(fields)
          .from(articleTags)
          .innerJoin(articles, eq(articles.id, articleTags.articleId))
          .where(and(inArray(articleTags.tag, tags), gte(articleTags.publishedAt, since), hidden))
          .orderBy(desc(articles.publishedAt))
          .limit(PER_KIND)
      : [],
    media.length
      ? db
          .select(fields)
          .from(articles)
          .where(and(inArray(articles.media, media), gte(articles.publishedAt, since), hidden))
          .orderBy(desc(articles.publishedAt))
          .limit(PER_KIND)
      : [],
    people.length
      ? db
          .select({ ...fields, authors: articles.authors, creator: articles.creator })
          .from(articles)
          .where(
            and(
              gte(articles.publishedAt, since),
              hidden,
              // journalistName() already refuses % _ and \, so the names are safe LIKE patterns.
              or(
                ...people.flatMap((name): SQL[] => [
                  sql`${articles.authors} LIKE ${`%${name}%`}`,
                  sql`${articles.creator} LIKE ${`%${name}%`}`,
                ]),
              ),
            ),
          )
          .orderBy(desc(articles.publishedAt))
          .limit(PER_KIND)
      : [],
  ]);
  const tagSet = new Set(tags);
  add(tagRows, (row) => row.tags.filter((t) => tagSet.has(t)).map((t) => ({ kind: 'tag', target: t })));
  add(mediaRows, (row) => [{ kind: 'media', target: row.media }]);
  add(peopleRows, (row) =>
    rowJournalists(row as Row & { authors: string[] | null; creator: string | null })
      .filter((name) => people.includes(name))
      .map((name) => ({ kind: 'journalist', target: name })),
  );

  const list = [...found.values()]
    .sort((a, b) => b.row.publishedAt.getTime() - a.row.publishedAt.getTime() || b.row.id - a.row.id)
    .slice(0, FEED_LIMIT)
    .map(
      ({ row, matched }): FeedArticle => ({
        id: row.id,
        media: row.media,
        mediaTitle: mediaTitle(row.media),
        title: row.title,
        url: row.url,
        publishedAt: row.publishedAt.toISOString(),
        tags: row.tags.slice(0, 8),
        matched,
      }),
    );
  return { days: FEED_DAYS, follows, articles: list, events: await followedEvents(db, threadIds, now) };
}

type Headline = { title: string; url: string; media: string };

export async function followedEvents(db: Db, ids: number[], now = new Date()): Promise<FeedEvent[]> {
  if (!ids.length) return [];
  const threads = await db
    .select({
      id: eventThreads.id,
      firstTime: eventThreads.firstTime,
      lastTime: eventThreads.lastTime,
      majorTags: eventThreads.majorTags,
      maxTag: eventThreads.maxTag,
    })
    .from(eventThreads)
    .where(inArray(eventThreads.id, ids));
  if (!threads.length) return [];
  // The newest hourly row of each thread carries its current headlines.
  const rows = await db
    .select({ threadId: events.threadId, id: events.id, news: events.news, majorNews: events.majorNews })
    .from(events)
    .where(
      inArray(
        events.id,
        db
          .select({ id: sql<number>`MAX(${events.id})` })
          .from(events)
          .where(
            inArray(
              events.threadId,
              threads.map((t) => t.id),
            ),
          )
          .groupBy(events.threadId),
      ),
    );
  const latest = new Map(rows.map((row) => [row.threadId as number, (row.majorNews.length ? row.majorNews : row.news) as Headline[]]));
  return threads
    .sort((a, b) => b.lastTime.getTime() - a.lastTime.getTime())
    .map((t) => {
      const tags = t.majorTags.length ? t.majorTags : t.maxTag ? [t.maxTag] : [];
      const headlines = (latest.get(t.id) ?? []).slice(0, 4).map((h) => ({ ...h, mediaTitle: mediaTitle(h.media) }));
      return {
        id: t.id,
        title: headlines[0]?.title ?? (tags.join('、') || `事件 ${t.id}`),
        tags,
        firstTime: t.firstTime.toISOString(),
        lastTime: t.lastTime.toISOString(),
        // Threads are extended hour by hour; one updated within two hours is still going.
        active: now.getTime() - t.lastTime.getTime() < 2 * 3600e3,
        headlines,
      };
    });
}

const followLabel = (f: Follow) =>
  f.kind === 'tag' ? `#${f.target}` : f.kind === 'media' ? mediaTitle(f.target) : f.kind === 'journalist' ? f.target : `事件 ${f.target}`;

/** RSS items for the private feed: one per article, one per followed event's latest state. */
export function feedRssItems(feed: ReaderFeed): FeedItem[] {
  return [
    ...feed.events.map((e) => ({
      title: `【追蹤事件】${e.title}`,
      link: `${ORIGIN}/eve/${e.id}/`,
      // A new guid each time the event moves on, so readers see the update.
      guid: `${ORIGIN}/eve/${e.id}/#${e.lastTime}`,
      pubDate: new Date(e.lastTime),
      categories: e.tags,
      description: `<ul>${e.headlines.map((h) => `<li><a href="${xml(h.url)}">【${xml(h.mediaTitle)}】${xml(h.title)}</a></li>`).join('')}</ul>`,
    })),
    ...feed.articles.map((a) => ({
      title: `【${a.mediaTitle}】${a.title}`,
      link: a.url,
      guid: `${ORIGIN}/article/${a.id}`,
      pubDate: new Date(a.publishedAt),
      categories: a.tags,
      description: xml(`追蹤：${a.matched.map(followLabel).join('、')}　標籤：${a.tags.join('、')}`),
    })),
  ];
}
