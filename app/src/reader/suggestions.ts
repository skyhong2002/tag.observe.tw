import { and, desc, eq, gte, inArray, notInArray, or, sql } from 'drizzle-orm';
import { knownMedia } from '../admin/routes.ts';
import type { Db } from '../db/client.ts';
import { articles, articleTags, eventSnapshots, events, eventThreads, readerHistory } from '../db/schema.ts';
import { rowJournalists } from '../journalists/aggregate.ts';
import { isOwnMediaTag } from '../media-tags.ts';
import { isTagNoise } from '../tag-noise.ts';
import { campOf } from '../v1/coverage.ts';
import { loadRanking } from '../v1/routes.ts';
import { loadRelatedTags } from '../v1/tag-related.ts';
import { mediaTitle } from './feed.ts';
import type { Follow, FollowKind } from './validate.ts';

// What to follow next (GET /auth/me/suggestions, docs/login.md#推薦):
// 1. starter: today's events, rising tags and the outlets covering them, for
//    readers who follow little or nothing yet;
// 2. related: tags that travel with what the reader follows, what followed
//    journalists write about, and a followed event's main tags;
// 3. reading (only with the opt-in reading history): tags the reader keeps
//    opening, and when one camp dominates their reading, the other camp's
//    recent reports on those same tags.

export type Suggestion = Follow & { label: string; because: string };
export type StarterEvent = { id: number; title: string; tags: string[] };
export type OtherSide = {
  camp: 'blue' | 'green';
  share: number;
  articles: Array<{ id: number; media: string; mediaTitle: string; title: string; url: string; publishedAt: string; tag: string }>;
};
export type Suggestions = {
  starter: { events: StarterEvent[]; tags: Suggestion[]; media: Suggestion[] };
  related: Suggestion[];
  reading: { tags: Suggestion[]; otherSide: OtherSide | null } | null;
};

const DAY = 86_400e3;
const STARTER_MS = 5 * 60e3;
const CAMP_NAME = { blue: '藍營', green: '綠營' } as const;
// knownMedia() rebuilds its list on each call; tags are checked by the hundred.
let outletList: { at: number; media: string[] } | null = null;
const outlets = () => {
  if (!outletList || Date.now() - outletList.at > 60e3) outletList = { at: Date.now(), media: knownMedia() };
  return outletList.media;
};
const usable = (tag: string) => !isTagNoise(tag) && !outlets().some((m) => isOwnMediaTag(tag, m));
const key = (f: Follow) => `${f.kind}:${f.target}`;

type Starter = Suggestions['starter'];
let starterCache: { at: number; value: Starter } | null = null;

/** The same for everyone, so cached for a few minutes; follows are removed per reader. */
export async function loadStarter(db: Db, now = Date.now()): Promise<Starter> {
  if (starterCache && now - starterCache.at < STARTER_MS) return starterCache.value;
  const [ranking, [snapshot]] = await Promise.all([
    loadRanking(db, 'news'),
    db
      .select({ id: eventSnapshots.id })
      .from(eventSnapshots)
      .where(eq(eventSnapshots.category, 'news'))
      .orderBy(desc(eventSnapshots.hourStart))
      .limit(1),
  ]);
  const rows = snapshot
    ? await db
        .select({ threadId: events.threadId, tags: events.major, news: events.news, majorNews: events.majorNews })
        .from(events)
        .where(eq(events.snapshotId, snapshot.id))
        .orderBy(events.rank)
        .limit(8)
    : [];
  const eventList = rows
    .filter((r) => r.threadId)
    .map((r) => {
      const news = r.majorNews.length ? r.majorNews : r.news;
      return {
        id: r.threadId as number,
        title: news[0]?.title ?? r.tags.join('、'),
        tags: r.tags.slice(0, 4),
      };
    });
  // Rising: the strongest bursts among tags several outlets carry.
  const entries = (ranking?.entries ?? []).filter((e) => usable(e.tag) && Object.keys(e.media).length >= 3);
  const tags = [...entries]
    .sort((a, b) => (b.burst ?? 0) - (a.burst ?? 0))
    .slice(0, 12)
    .map((e) => ({
      kind: 'tag' as const,
      target: e.tag,
      label: `#${e.tag}`,
      because: `${Object.keys(e.media).length} 家媒體正在報導`,
    }));
  // Outlets that carry most of today's top tags, both camps and the rest.
  const volume = new Map<string, number>();
  for (const e of entries.slice(0, 40)) for (const [m, n] of Object.entries(e.media)) volume.set(m, (volume.get(m) ?? 0) + n);
  const media = [...volume]
    .filter(([m]) => outlets().includes(m))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([m]) => {
      const camp = campOf(m);
      return {
        kind: 'media' as const,
        target: m,
        label: mediaTitle(m),
        because: camp === 'blue' || camp === 'green' ? `${CAMP_NAME[camp]}，今日熱門主題報導多` : '今日熱門主題報導多',
      };
    });
  const value = { events: eventList, tags, media };
  starterCache = { at: now, value };
  return value;
}

export async function loadRelated(db: Db, follows: Follow[], now = new Date()): Promise<Suggestion[]> {
  const of = (kind: FollowKind) => follows.filter((f) => f.kind === kind).map((f) => f.target);
  const followed = new Set(follows.map(key));
  const out = new Map<string, Suggestion>();
  const add = (tag: string, because: string) => {
    const s: Suggestion = { kind: 'tag', target: tag, label: `#${tag}`, because };
    if (usable(tag) && !followed.has(key(s)) && !out.has(key(s))) out.set(key(s), s);
  };

  // Tags that share articles with followed tags this week.
  const tags = of('tag').slice(0, 20);
  if (tags.length) {
    const related = await loadRelatedTags(db, tags, outlets(), new Date(now.getTime() - 7 * DAY), now, 4);
    for (const [tag, list] of related) for (const r of list) if (r.count >= 3) add(r.tag, `常和 #${tag} 一起出現`);
  }
  // What followed journalists wrote about lately.
  const people = of('journalist').slice(0, 10);
  const topics = await Promise.all(people.map((name) => journalistTopics(db, name, now)));
  people.forEach((name, i) => {
    for (const t of topics[i]) add(t, `${name} 常寫`);
  });
  // A followed event's main tags outlive the event itself.
  const threads = of('event').map(Number).slice(0, 20);
  if (threads.length) {
    const rows = await db
      .select({ id: eventThreads.id, majorTags: eventThreads.majorTags })
      .from(eventThreads)
      .where(inArray(eventThreads.id, threads));
    for (const r of rows) for (const t of r.majorTags.slice(0, 3)) add(t, `事件 #${r.id} 的主要標籤`);
  }
  return [...out.values()].slice(0, 15);
}

// A name search is a LIKE scan over two weeks of articles (about two seconds),
// and a journalist's usual topics barely move within hours.
const JOURNALIST_DAYS = 14;
const JOURNALIST_MS = 6 * 3600e3;
const journalistCache = new Map<string, { at: number; tags: Promise<string[]> }>();

export function journalistTopics(db: Db, name: string, now = new Date()): Promise<string[]> {
  const hit = journalistCache.get(name);
  if (hit && now.getTime() - hit.at < JOURNALIST_MS) return hit.tags;
  if (journalistCache.size > 500) journalistCache.clear();
  const tags = db
    .select({ tags: articles.tags, authors: articles.authors, creator: articles.creator })
    .from(articles)
    .where(
      and(
        gte(articles.publishedAt, new Date(now.getTime() - JOURNALIST_DAYS * DAY)),
        // journalistName() already refuses % _ and \, so the name is a safe LIKE pattern.
        or(sql`${articles.authors} LIKE ${`%${name}%`}`, sql`${articles.creator} LIKE ${`%${name}%`}`),
      ),
    )
    .limit(500)
    .then((rows) => {
      const count = new Map<string, number>();
      for (const row of rows)
        if (rowJournalists(row).includes(name)) for (const t of new Set(row.tags)) count.set(t, (count.get(t) ?? 0) + 1);
      return [...count]
        .filter(([t, n]) => n >= 2 && usable(t))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([t]) => t);
    });
  tags.catch(() => journalistCache.delete(name));
  journalistCache.set(name, { at: now.getTime(), tags });
  return tags;
}

const READING_DAYS = 30;
const OTHER_SIDE_DAYS = 3;
/** Below this many blue+green reads the split says nothing. */
export const OTHER_SIDE_MIN_READS = 5;
/** One camp at or above this share of blue+green reads counts as one-sided. */
export const OTHER_SIDE_SHARE = 0.75;

export async function loadReading(db: Db, userId: number, follows: Follow[], now = new Date()): Promise<Suggestions['reading']> {
  const rows = await db
    .select({ id: articles.id, media: articles.media, tags: articles.tags })
    .from(readerHistory)
    .innerJoin(articles, eq(articles.id, readerHistory.articleId))
    .where(and(eq(readerHistory.userId, userId), gte(readerHistory.readAt, new Date(now.getTime() - READING_DAYS * DAY))))
    .limit(2000);
  const followed = new Set(follows.filter((f) => f.kind === 'tag').map((f) => f.target));
  const count = new Map<string, number>();
  for (const r of rows) for (const t of new Set(r.tags)) if (usable(t)) count.set(t, (count.get(t) ?? 0) + 1);
  const top = [...count].sort((a, b) => b[1] - a[1]);
  const tags = top
    .filter(([t, n]) => n >= 2 && !followed.has(t))
    .slice(0, 8)
    .map(([t, n]) => ({ kind: 'tag' as const, target: t, label: `#${t}`, because: `近 ${READING_DAYS} 天讀了 ${n} 篇` }));
  return {
    tags,
    otherSide: await otherSide(
      db,
      rows,
      top.slice(0, 10).map(([t]) => t),
      now,
    ),
  };
}

export function oneSided(reads: Array<{ media: string }>): { camp: 'blue' | 'green'; share: number } | null {
  let blue = 0;
  let green = 0;
  for (const r of reads) {
    const camp = campOf(r.media);
    if (camp === 'blue') blue++;
    else if (camp === 'green') green++;
  }
  const total = blue + green;
  if (total < OTHER_SIDE_MIN_READS) return null;
  const camp = blue >= green ? 'blue' : 'green';
  const share = Math.max(blue, green) / total;
  return share >= OTHER_SIDE_SHARE ? { camp, share } : null;
}

/** The other camp's latest reports on the tags the reader reads most. */
async function otherSide(db: Db, reads: Array<{ id: number; media: string }>, topTags: string[], now: Date): Promise<OtherSide | null> {
  const skew = oneSided(reads);
  if (!skew || !topTags.length) return null;
  const want = skew.camp === 'blue' ? 'green' : 'blue';
  const camp = outlets().filter((m) => campOf(m) === want);
  if (!camp.length) return null;
  const seen = reads.map((r) => r.id);
  const rows = await db
    .selectDistinct({
      id: articles.id,
      media: articles.media,
      title: articles.title,
      url: articles.url,
      publishedAt: articles.publishedAt,
      tags: articles.tags,
    })
    .from(articleTags)
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(
      and(
        inArray(articleTags.tag, topTags),
        gte(articleTags.publishedAt, new Date(now.getTime() - OTHER_SIDE_DAYS * DAY)),
        inArray(articles.media, camp),
        seen.length ? notInArray(articles.id, seen) : undefined,
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(30);
  const picked: OtherSide['articles'] = [];
  const used = new Set<string>();
  // One report per tag first, so the list spans the reader's topics.
  for (const pass of [true, false])
    for (const r of rows) {
      const tag = topTags.find((t) => r.tags.includes(t));
      if (!tag || !r.title || picked.some((p) => p.id === r.id) || (pass && used.has(tag))) continue;
      used.add(tag);
      picked.push({
        id: r.id,
        media: r.media,
        mediaTitle: mediaTitle(r.media),
        title: r.title,
        url: r.url,
        publishedAt: r.publishedAt.toISOString(),
        tag,
      });
      if (picked.length >= 6) break;
    }
  return picked.length ? { camp: skew.camp, share: Math.round(skew.share * 100) / 100, articles: picked } : null;
}

export async function loadSuggestions(db: Db, userId: number, follows: Follow[], history: boolean): Promise<Suggestions> {
  const followed = new Set(follows.map(key));
  const [starter, related, reading] = await Promise.all([
    loadStarter(db),
    loadRelated(db, follows),
    history ? loadReading(db, userId, follows) : null,
  ]);
  const fresh = <T extends Follow>(list: T[]) => list.filter((s) => !followed.has(key(s)));
  return {
    starter: {
      events: starter.events.filter((e) => !followed.has(`event:${e.id}`)),
      tags: fresh(starter.tags),
      media: fresh(starter.media),
    },
    related,
    reading,
  };
}
