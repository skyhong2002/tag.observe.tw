// The /liveboard/ queue: turns each poll of /api/v1/liveboard and
// /api/v1/events into cards, keeps them in a short priority queue and replays
// recent cards when nothing new has arrived. Pure, so the root test suite can
// cover it (app/test/liveboard.spec.ts).

import type { Camp, EventItem } from './event-types.mts';
import { type CompareArticle, type CompareEvent, headlineDiff, headlineSimilarity, type TextPart } from './headline-compare.mts';

export interface LiveArticle {
  id: number;
  media: string;
  mediaTitle: string;
  camp: Camp;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  datePending: boolean;
  tags: string[];
  /** Start of the stored body, else the summary. */
  text: string | null;
  authors: string[];
}
export interface LiveFollower {
  article: LiveArticle;
  score: number;
  containment: number;
  kind: string;
  evidence: string;
  direct: boolean;
  gapMinutes: number;
}
export interface LiveStory {
  key: string;
  computedAt: string;
  lead: LiveArticle;
  followers: LiveFollower[];
  more: number;
}
export interface LiveBucket {
  t: string;
  blue: number;
  green: number;
  other: number;
}
export interface LiveFeed {
  generatedAt: string;
  cursor: { after: number | null; pairsAfter: string | null; readAfter: string | null };
  articles: LiveArticle[];
  stories: LiveStory[];
  /** Articles whose bodies came in most recently, newest first. */
  reading: LiveArticle[];
  activity: LiveActivity;
  topics: LiveTopic[];
  stats: { last60m: LiveBucket[]; hourly24: LiveBucket[]; total24h: number; activeMedia1h: number };
  visitors: { activeUsers: number; views: number; perMinute: number[] } | null;
}

export interface LiveTopic {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  image: string | null;
  kind: 'topic' | 'feature';
  isNew: boolean;
  at: string;
  storyCount: number | null;
  stories: Array<{ title: string; url: string | null; date: string | null; article: LiveArticle | null }>;
}
export interface LiveActivity {
  crawls: Array<{ media: string; mediaTitle: string; stage: string; at: string; running: boolean; inserted: number; failed: boolean }>;
  running: Array<{ job: string; since: string }>;
  upcoming: Array<{ job: string; label: string; at: string }>;
}

export type EventReason = 'top' | 'new' | 'climb';
export type Card =
  | { kind: 'event'; key: string; at: number; reason: EventReason; event: EventItem }
  | { kind: 'headline'; key: string; at: number; compare: CompareEvent; event: EventItem }
  | { kind: 'copy'; key: string; at: number; story: LiveStory; featured: LiveFollower }
  | { kind: 'burst'; key: string; at: number; articles: LiveArticle[]; total: number }
  | { kind: 'topic'; key: string; at: number; topic: LiveTopic };

const PRIORITY: Record<Card['kind'], number> = { event: 4, headline: 3, copy: 2, topic: 2, burst: 1 };
export const QUEUE_MAX = 24;
export const HISTORY_MAX = 16;
/** New articles in one poll that make a "just published" card. */
export const BURST_MIN = 6;

/** Adds unseen cards, most important kinds first, oldest first within a kind. */
export function enqueue(queue: readonly Card[], fresh: readonly Card[], seen: ReadonlySet<string>, max = QUEUE_MAX): Card[] {
  const keys = new Set(queue.map((c) => c.key));
  const added = fresh.filter((c) => {
    if (seen.has(c.key) || keys.has(c.key)) return false;
    keys.add(c.key);
    return true;
  });
  return [...queue, ...added].sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind] || a.at - b.at).slice(0, max);
}

/**
 * The next card to show and the queue/history after it. With an empty queue
 * the board replays the oldest card in its history, so a quiet hour still moves.
 */
export function advance(
  queue: readonly Card[],
  history: readonly Card[],
): { card: Card | null; queue: Card[]; history: Card[]; replay: boolean } {
  const [next, ...rest] = queue;
  if (next)
    return { card: next, queue: rest, history: [...history.filter((c) => c.key !== next.key), next].slice(-HISTORY_MAX), replay: false };
  const [oldest, ...others] = history;
  if (!oldest) return { card: null, queue: [], history: [], replay: false };
  return { card: oldest, queue: [], history: [...others, oldest], replay: true };
}

const threadKey = (e: EventItem) => e.relatedEventPk ?? e.major.join('|');

/**
 * Events worth a card after a refresh: on the first load the top three; later,
 * threads that were not in the previous snapshot and threads that climbed at
 * least three places into the top ten.
 */
export function eventCards(prev: readonly EventItem[] | null, next: readonly EventItem[], now: number): Card[] {
  if (!prev)
    return next.slice(0, 3).map((event) => ({ kind: 'event', key: `event:${threadKey(event)}:top`, at: now, reason: 'top', event }));
  const before = new Map(prev.map((e) => [threadKey(e), e.rank]));
  const cards: Card[] = [];
  for (const event of next) {
    const was = before.get(threadKey(event));
    if (was === undefined) cards.push({ kind: 'event', key: `event:${threadKey(event)}:new`, at: now, reason: 'new', event });
    else if (event.rank <= 10 && was - event.rank >= 3)
      cards.push({ kind: 'event', key: `event:${threadKey(event)}:${event.rank}`, at: now, reason: 'climb', event });
  }
  return cards;
}

/** A headline pair for an event, when the comparison found one. */
export function headlineCard(event: EventItem, compare: CompareEvent | null, now: number): Card | null {
  if (!compare?.pair) return null;
  return { kind: 'headline', key: `headline:${compare.id}:${compare.pair.join('-')}`, at: now, compare, event };
}

export type CopyTone = 'same' | 'light' | 'heavy';
/** How much of the lead a follower kept; every stored pair already shares at least half its text. */
export const copyTone = (f: Pick<LiveFollower, 'score' | 'kind'>): CopyTone =>
  f.kind === 'identical' || f.score >= 0.9 ? 'same' : f.score >= 0.7 ? 'light' : 'heavy';
export const COPY_TONE_LABEL: Record<CopyTone, string> = { same: '幾乎照登', light: '小幅改寫', heavy: '大幅改寫' };

/**
 * The follower to put beside the lead: a direct match with body text,
 * preferring one that changed the headline (the interesting comparison), then
 * the closest copy.
 */
export function featuredFollower(story: LiveStory): LiveFollower | null {
  const direct = story.followers.filter((f) => f.direct);
  const pool = direct.length ? direct : story.followers;
  const retitled = (f: LiveFollower) => headlineSimilarity(f.article.title, story.lead.title) < 0.6;
  // Only followers with body text can be compared side by side.
  const hasText = (f: LiveFollower) => f.article.text !== null;
  return (
    [...pool].sort(
      (a, b) => Number(hasText(b)) - Number(hasText(a)) || Number(retitled(b)) - Number(retitled(a)) || b.score - a.score,
    )[0] ?? null
  );
}

export function storyCards(stories: readonly LiveStory[], now: number): Card[] {
  return stories.flatMap((story): Card[] => {
    const featured = featuredFollower(story);
    // Copies are compared by their text: both sides need it.
    if (!featured || !story.lead.text || !featured.article.text) return [];
    return [{ kind: 'copy', key: `copy:${story.lead.id}:${featured.article.id}`, at: now, story, featured }];
  });
}

/** A card per topic page that appeared or gained stories; the same update is never shown twice. */
export function topicCards(topics: readonly LiveTopic[], now: number): Card[] {
  return topics.flatMap((t): Card[] => {
    // Only stories whose text has been read; a topic with none waits for the next update.
    const stories = t.stories.filter((st) => st.article?.text);
    return stories.length ? [{ kind: 'topic', key: `topic:${t.id}:${t.at}`, at: now, topic: { ...t, stories } }] : [];
  });
}

/** One "N articles just in" card for a busy poll, one article per outlet. */
export function burstCard(all: readonly LiveArticle[], now: number): Card | null {
  const articles = all.filter((a) => a.text);
  if (articles.length < BURST_MIN) return null;
  const outlets = new Map<string, LiveArticle>();
  for (const a of articles) if (!outlets.has(a.media)) outlets.set(a.media, a);
  // One per outlet first; a batch from few outlets fills up with their other articles.
  const first = [...outlets.values()];
  const picked = [...first, ...articles.filter((a) => !first.includes(a))].slice(0, 8);
  return { kind: 'burst', key: `burst:${Math.max(...articles.map((a) => a.id))}`, at: now, articles: picked, total: articles.length };
}

/** The ticker: newest first, no repeats, bounded. */
export function mergeTicker(ticker: readonly LiveArticle[], fresh: readonly LiveArticle[], max = 30): LiveArticle[] {
  const ids = new Set<number>();
  return [...fresh, ...ticker]
    .filter((a) => {
      if (ids.has(a.id)) return false;
      ids.add(a.id);
      return true;
    })
    .sort((a, b) => b.id - a.id)
    .slice(0, max);
}

/** "3 分鐘前" style ages for a screen read from across the room. */
export function ago(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60e3));
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} 小時前` : `${Math.floor(hours / 24)} 天前`;
}

/** Minutes between lead and follower, as 「晚 2 小時 5 分」. */
export function gapLabel(minutes: number): string {
  if (minutes < 1) return '同時';
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return `晚 ${h ? `${h} 小時` : ''}${h && m ? ' ' : ''}${m || !h ? `${m} 分` : ''}`;
}

/** One fixed ticker row; `seq` orders arrivals so the longest-shown row is replaced first. */
export interface Slot {
  article: LiveArticle;
  seq: number;
}

/** Rows for the first paint: newest at the top, so the bottom row is the first to change. */
export function seedSlots(articles: readonly LiveArticle[], capacity: number): Array<Slot | null> {
  return Array.from({ length: capacity }, (_, i) => (articles[i] ? { article: articles[i], seq: -i } : null));
}

/** Grows or shrinks the rows; a smaller screen drops the rows that have been up longest. */
export function fitSlots(slots: ReadonlyArray<Slot | null>, capacity: number): Array<Slot | null> {
  if (slots.length <= capacity) return [...slots, ...Array<null>(capacity - slots.length).fill(null)];
  const keep = new Set(
    slots
      .filter((s): s is Slot => s !== null)
      .sort((a, b) => b.seq - a.seq)
      .slice(0, capacity),
  );
  const kept = slots.filter((s) => s !== null && keep.has(s));
  return [...kept, ...Array<null>(capacity - kept.length).fill(null)];
}

/**
 * Puts an arrival in place without moving the other rows: an empty row first,
 * otherwise the row that has been up longest. Null when it is already shown.
 */
export function placeInSlot(
  slots: ReadonlyArray<Slot | null>,
  article: LiveArticle,
  seq: number,
): { slots: Array<Slot | null>; index: number } | null {
  if (!slots.length || slots.some((s) => s?.article.id === article.id)) return null;
  let index = slots.indexOf(null);
  if (index === -1) index = slots.reduce((oldest, s, i) => (s!.seq < slots[oldest]!.seq ? i : oldest), 0);
  const next = [...slots];
  next[index] = { article, seq };
  return { slots: next, index };
}

/** Tags the current stage card is about, to light up matching keywords and events. */
export function cardTags(card: Card | null): Set<string> {
  if (!card) return new Set();
  switch (card.kind) {
    case 'event':
      return new Set([...card.event.major, ...card.event.tags.map((t) => t.tag)]);
    case 'headline':
      return new Set([...card.compare.focusTags, ...card.event.major]);
    case 'copy':
      return new Set([...card.story.lead.tags, ...card.featured.article.tags]);
    case 'burst':
      return new Set(card.articles.flatMap((a) => a.tags));
    case 'topic':
      return new Set([card.topic.title]);
  }
}

/** Rank change of each tag since the previous ranking fetch; 'new' when it was not listed. */
export function rankMoves(prev: ReadonlyArray<{ tag: string; rank: number }> | null, next: ReadonlyArray<{ tag: string; rank: number }>) {
  const before = new Map(prev?.map((e) => [e.tag, e.rank]));
  return new Map(next.map((e) => [e.tag, !prev ? 0 : before.has(e.tag) ? before.get(e.tag)! - e.rank : ('new' as const)]));
}

/** Time until the next ticker arrival: a backlog spread over one poll, between 2.5 and 8 seconds. */
export const dripDelay = (backlog: number, every = 30e3) => Math.min(8e3, Math.max(2.5e3, every / Math.max(1, backlog)));

/** The first rows on screen and the newest arrivals held back to drip in, oldest first. */
export function splitSeed(articles: readonly LiveArticle[], held: number): { shown: LiveArticle[]; pending: LiveArticle[] } {
  const newest = [...articles].sort((a, b) => b.id - a.id);
  return { shown: newest.slice(held), pending: newest.slice(0, held).reverse() };
}

const SHARED_RUN = 6;
/**
 * Two bodies with their common passages marked (different: false). Only runs
 * of at least six characters count, so scattered common words stay plain.
 */
export function sharedText(left: string, right: string, chars = 900): [TextPart[], TextPart[]] {
  const [a, b] = headlineDiff([...left].slice(0, chars).join(''), [...right].slice(0, chars).join(''), chars * 2);
  const runs = (parts: TextPart[]) => {
    const out: TextPart[] = [];
    for (const p of parts) {
      const different = p.different || [...p.text].length < SHARED_RUN;
      const last = out.at(-1);
      if (last?.different === different) last.text += p.text;
      else out.push({ text: p.text, different });
    }
    return out;
  };
  return [runs(a), runs(b)];
}

/** Share of the left text that is in shared runs, 0–1. */
export const sharedShare = (parts: readonly TextPart[]) => {
  const total = parts.reduce((n, p) => n + [...p.text].length, 0);
  return total ? parts.filter((p) => !p.different).reduce((n, p) => n + [...p.text].length, 0) / total : 0;
};

/**
 * Up to `max` headlines for one story, one per outlet: the compared pair first,
 * then the rest newest first. The first is diffed against the second, every
 * other headline against the first.
 */
export function headlineGrid(compare: CompareEvent, max = 9): Array<{ article: CompareArticle; parts: TextPart[] }> {
  const byId = new Map(compare.articles.map((a) => [a.id, a]));
  const pair = (compare.pair ?? []).map((id) => byId.get(id)).filter((a): a is CompareArticle => Boolean(a));
  const outlets = new Set(pair.map((a) => a.media));
  const rest = compare.articles.filter((a) => {
    if (outlets.has(a.media)) return false;
    outlets.add(a.media);
    return true;
  });
  const picked = [...pair, ...rest].slice(0, max);
  if (picked.length < 2) return picked.map((article) => ({ article, parts: [{ text: article.title, different: false }] }));
  const [first, second] = picked;
  return picked.map((article, i) => ({
    article,
    parts: i === 0 ? headlineDiff(first.title, second.title)[0] : headlineDiff(first.title, article.title)[1],
  }));
}

/** Other outlets' headlines beyond the grid, for a compact list. */
export function headlineExtras(compare: CompareEvent, shown: ReadonlyArray<{ article: CompareArticle }>): CompareArticle[] {
  const outlets = new Set(shown.map((s) => s.article.media));
  return compare.articles.filter((a) => {
    if (outlets.has(a.media)) return false;
    outlets.add(a.media);
    return true;
  });
}

/** The next article for the reader panel: the newest one not shown yet, else start the cycle again. */
export function nextReading(list: readonly LiveArticle[], shown: ReadonlySet<number>): { article: LiveArticle | null; reset: boolean } {
  const unseen = list.find((a) => !shown.has(a.id));
  if (unseen) return { article: unseen, reset: false };
  return { article: list[0] ?? null, reset: true };
}

/** /api/v1/events/threads/:id/coverage, the parts the event card shows. */
export interface ThreadCoverage {
  byOutlet: Array<{
    media: string;
    title: string;
    camp: Camp;
    articles: Array<{
      id: number;
      title: string;
      url: string;
      image: string | null;
      publishedAt: string;
      hits: number;
      description: string | null;
    }>;
  }>;
}
export type CoverageReport = ThreadCoverage['byOutlet'][number]['articles'][number] & { media: string; mediaTitle: string; camp: Camp };

/**
 * An event's reports for its card: each outlet's most on-topic article (most
 * major-tag hits, then newest), ones with a summary first, newest first.
 */
export function eventReports(coverage: ThreadCoverage, max = 8): CoverageReport[] {
  return coverage.byOutlet
    .flatMap((o) => {
      const best = [...o.articles].sort((a, b) => b.hits - a.hits || b.publishedAt.localeCompare(a.publishedAt))[0];
      return best ? [{ ...best, media: o.media, mediaTitle: o.title, camp: o.camp }] : [];
    })
    .sort((a, b) => Number(Boolean(b.description)) - Number(Boolean(a.description)) || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, max);
}
