import { cleanEventHeadline, selectEventLead } from './event-presentation.mts';
import type { EventItem } from './event-types.mts';
import type { LiveArticle, LiveFeed, LiveStory, LiveTopic } from './liveboard.mts';
import { articleHref } from './reading.mts';

export const BOARD_LIMIT = 6;
export const FOLLOW_LIMIT = 5;
export const FOLLOW_STORAGE = 'tag-liveboard-follows-v1';
export type BoardFeed = Pick<LiveFeed, 'generatedAt' | 'articles' | 'stories' | 'topics' | 'activity'>;
export interface BoardEvents {
  hour: string;
  builtAt: string | null;
  stale?: boolean;
  events: EventItem[];
}
export interface NewsCard {
  key: string;
  title: string;
  href: string;
  media: string;
  tags: string[];
  at: string | null;
  timeLabel: string;
  eventHref?: string;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const date = (value: unknown): string | null => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null);

/** Optional body, tags and publication dates must never hide a readable headline. */
export function readArticles(value: unknown): LiveArticle[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((raw): LiveArticle[] => {
    const a = record(raw);
    if (!Number.isSafeInteger(a.id) || Number(a.id) <= 0 || typeof a.title !== 'string' || !a.title.trim()) return [];
    return [
      {
        id: Number(a.id),
        title: a.title,
        media: typeof a.media === 'string' ? a.media : '',
        mediaTitle: typeof a.mediaTitle === 'string' ? a.mediaTitle : typeof a.media === 'string' ? a.media : '來源未提供',
        url: typeof a.url === 'string' ? a.url : '',
        image: typeof a.image === 'string' ? a.image : null,
        publishedAt: date(a.publishedAt) ?? '',
        datePending: a.datePending === true,
        tags: strings(a.tags),
        text: typeof a.text === 'string' ? a.text : null,
        authors: strings(a.authors),
        camp: a.camp === 'blue' || a.camp === 'green' ? a.camp : 'other',
      },
    ];
  });
}

export function readFeed(value: unknown): BoardFeed | null {
  const data = record(value);
  const articles = readArticles(data.articles);
  if (!articles || !date(data.generatedAt)) return null;
  const stories = (Array.isArray(data.stories) ? data.stories : []).flatMap((raw): LiveStory[] => {
    const s = record(raw);
    const lead = readArticles([s.lead])?.[0];
    if (!lead || !Array.isArray(s.followers)) return [];
    const followers = s.followers.flatMap((rawFollower) => {
      const f = record(rawFollower);
      const article = readArticles([f.article])?.[0];
      if (!article || typeof f.score !== 'number' || !Number.isFinite(f.score)) return [];
      return [
        {
          article,
          score: f.score,
          containment: Number(f.containment) || 0,
          kind: String(f.kind ?? ''),
          evidence: typeof f.evidence === 'string' ? f.evidence : '',
          direct: f.direct === true,
          gapMinutes: Number(f.gapMinutes) || 0,
        },
      ];
    });
    return [
      {
        key: String(s.key ?? lead.id),
        lead,
        followers,
        computedAt: date(s.computedAt) ?? String(data.generatedAt),
        more: Number(s.more) || 0,
      },
    ];
  });
  const topics = (Array.isArray(data.topics) ? data.topics : []).flatMap((raw): LiveTopic[] => {
    const t = record(raw);
    if (!Number.isSafeInteger(t.id) || typeof t.title !== 'string' || typeof t.media !== 'string') return [];
    return [
      {
        id: Number(t.id),
        title: t.title,
        media: t.media,
        mediaTitle: String(t.mediaTitle ?? t.media),
        url: String(t.url ?? ''),
        image: null,
        kind: t.kind === 'feature' ? 'feature' : 'topic',
        isNew: t.isNew === true,
        at: date(t.at) ?? '',
        storyCount: typeof t.storyCount === 'number' ? t.storyCount : null,
        stories: (Array.isArray(t.stories) ? t.stories : []).flatMap((rawStory) => {
          const s = record(rawStory);
          return typeof s.title === 'string'
            ? [
                {
                  title: s.title,
                  url: typeof s.url === 'string' ? s.url : null,
                  date: date(s.date),
                  article: readArticles([s.article])?.[0] ?? null,
                },
              ]
            : [];
        }),
      },
    ];
  });
  const activity = record(data.activity);
  return {
    generatedAt: String(data.generatedAt),
    articles,
    stories,
    topics,
    activity: {
      running: [],
      upcoming: [],
      crawls: (Array.isArray(activity.crawls) ? activity.crawls : []).flatMap((raw) => {
        const c = record(raw);
        if (typeof c.media !== 'string' || !date(c.at)) return [];
        return [
          {
            media: c.media,
            mediaTitle: String(c.mediaTitle ?? c.media),
            stage: String(c.stage ?? ''),
            at: String(c.at),
            running: c.running === true,
            inserted: Number(c.inserted) || 0,
            failed: c.failed === true,
          },
        ];
      }),
    },
  };
}

export function readEvents(value: unknown): BoardEvents | null {
  const data = record(value);
  if (!Array.isArray(data.events) || !date(data.hour)) return null;
  const events = data.events.flatMap((raw): EventItem[] => {
    const e = record(raw);
    if (typeof e.rank !== 'number' || !Array.isArray(e.news)) return [];
    const news = e.news.flatMap((rawNews) => {
      const n = record(rawNews);
      if (typeof n.title !== 'string' || !n.title.trim()) return [];
      return [
        {
          id: Number.isSafeInteger(n.id) && Number(n.id) > 0 ? Number(n.id) : null,
          title: n.title,
          media: String(n.media ?? ''),
          url: String(n.url ?? ''),
          image: null,
        },
      ];
    });
    // The board only needs the published event identity, order and representative headlines.
    return [
      {
        rank: e.rank,
        score: Number(e.score) || 0,
        major: strings(e.major),
        tags: [],
        news,
        relatedEventPk: typeof e.relatedEventPk === 'string' ? e.relatedEventPk : null,
      },
    ];
  });
  return { hour: String(data.hour), builtAt: date(data.builtAt), stale: data.stale === true, events };
}

export function readFollows(value: unknown): string[] {
  return [
    ...new Set(
      strings(value)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 60),
    ),
  ].slice(0, FOLLOW_LIMIT);
}

const titleKey = (s: string) =>
  cleanEventHeadline(s)
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLocaleLowerCase();
const eventKey = (e: EventItem) => `event:${e.relatedEventPk ?? [...e.major].sort().join('|')}`;
export const asNewsCard = (a: LiveArticle): NewsCard => ({
  key: `article:${a.id}`,
  title: a.title,
  href: articleHref(a),
  media: a.mediaTitle,
  tags: a.tags,
  at: date(a.publishedAt),
  timeLabel: a.datePending ? '首次收錄' : '刊登',
});

/** Presentation selection only: use existing ranked events and existing copy groups. */
export function selectNews(events: BoardEvents | null, feed: BoardFeed | null, media: Record<string, { title: string | null }>) {
  const titles = new Set<string>();
  const ids = new Set<number>();
  const groups = new Map<number, string>();
  for (const story of feed?.stories ?? []) {
    for (const a of [story.lead, ...story.followers.map((f) => f.article)]) groups.set(a.id, story.key);
  }
  const usedGroups = new Set<string>();
  const main: NewsCard[] = [];
  const known = new Map(feed?.articles.map((a) => [a.id, a]) ?? []);
  const eventKeys = new Set<string>();
  for (const e of [...(events?.events ?? [])].sort((a, b) => a.rank - b.rank)) {
    if (main.length >= BOARD_LIMIT) break;
    const lead = selectEventLead(e.news, e.major);
    const key = eventKey(e);
    if (!lead || eventKeys.has(key) || titles.has(titleKey(lead.title)) || (lead.id && ids.has(lead.id))) continue;
    if (lead.id && usedGroups.has(groups.get(lead.id) ?? '')) continue;
    eventKeys.add(key);
    for (const n of e.news) {
      if (n.id) {
        ids.add(n.id);
        const group = groups.get(n.id);
        if (group) usedGroups.add(group);
      }
      titles.add(titleKey(n.title));
    }
    const article = lead.id ? known.get(lead.id) : null;
    main.push({
      key,
      title: lead.title,
      href: articleHref(lead),
      media: media[lead.media]?.title ?? lead.media,
      tags: e.major,
      at: article?.publishedAt || events?.builtAt || events?.hour || null,
      timeLabel: article ? (article.datePending ? '首次收錄' : '刊登') : '事件快照',
      eventHref: e.relatedEventPk ? `/eve/${e.relatedEventPk}/` : undefined,
    });
  }
  const latest: NewsCard[] = [];
  for (const a of [...(feed?.articles ?? [])].sort((a, b) => b.id - a.id)) {
    const group = groups.get(a.id);
    if (ids.has(a.id) || titles.has(titleKey(a.title)) || (group && usedGroups.has(group))) continue;
    ids.add(a.id);
    titles.add(titleKey(a.title));
    if (group) usedGroups.add(group);
    const card = asNewsCard(a);
    if (main.length < BOARD_LIMIT) main.push(card);
    else if (latest.length < 3) latest.push(card);
  }
  return { main, latest };
}

/** Keep surviving cards in their slots; fill only vacated slots. Never append duplicate updates. */
export function stableCards(previous: readonly NewsCard[], next: readonly NewsCard[], keepEmpty = true): NewsCard[] {
  const unique = [...new Map(next.map((card) => [card.key, card])).values()].slice(0, BOARD_LIMIT);
  if (!unique.length) return keepEmpty ? [...previous] : [];
  const byKey = new Map(unique.map((card) => [card.key, card]));
  const slots = unique.map((_, i) => (previous[i] ? byKey.get(previous[i].key) : undefined));
  const retained = new Set(slots.flatMap((card) => (card ? [card.key] : [])));
  const incoming = unique.filter((card) => !retained.has(card.key));
  return slots.map((card) => card ?? incoming.shift()!);
}
