import { describe, expect, it } from 'vitest';
import type { EventItem } from '../src/lib/event-types.mts';
import type { LiveArticle, LiveStory } from '../src/lib/liveboard.mts';
import {
  type BoardEvents,
  type BoardFeed,
  readArticles,
  readEvents,
  readFeed,
  readFollows,
  selectNews,
  stableCards,
} from '../src/lib/liveboard-view.mts';

const at = '2026-10-22T13:00:00Z';
const article = (id: number, title = `新聞報導第 ${id} 則`): LiveArticle => ({
  id,
  title,
  media: 'cna',
  mediaTitle: '中央社',
  url: `https://example.com/${id}`,
  image: null,
  publishedAt: at,
  datePending: false,
  tags: ['沈伯洋'],
  text: null,
  authors: [],
  camp: 'other',
});
const event = (id: number, articles = [article(id)]): EventItem => ({
  rank: id,
  score: 1,
  major: [`事件 ${id}`],
  tags: [],
  news: articles,
  relatedEventPk: String(id),
});
const events = (items: EventItem[]): BoardEvents => ({ hour: at, builtAt: at, events: items });
const feed = (articles: LiveArticle[], stories: LiveStory[] = []): BoardFeed => ({
  generatedAt: at,
  articles,
  stories,
  topics: [],
  activity: { crawls: [], running: [], upcoming: [] },
});
const story = (lead: LiveArticle, follower: LiveArticle): LiveStory => ({
  key: String(lead.id),
  computedAt: at,
  lead,
  more: 0,
  followers: [{ article: follower, score: 0.9, containment: 0.9, kind: 'similar', evidence: '', direct: true, gapMinutes: 2 }],
});

describe('general liveboard presentation', () => {
  it('uses existing event order, one representative per event, and links to the full reading page', () => {
    const result = selectNews(events([event(2), event(1), event(1)]), feed([article(3)]), { cna: { title: '中央社' } });
    expect(result.main.map((n) => n.key)).toEqual(['event:1', 'event:2', 'article:3']);
    expect(result.main[0]).toMatchObject({ href: '/article/1/', media: '中央社', eventHref: '/eve/1/', timeLabel: '事件快照' });
  });
  it('excludes listed event members, duplicate titles and known similar stories from filler/latest', () => {
    const first = article(1, '共同事件新聞標題');
    const copy = article(2, '快訊／共同事件新聞標題');
    const related = article(3, '另一媒體的不同標題但同內文');
    const result = selectNews(events([event(1, [first])]), feed([related, copy, first, article(4)], [story(first, related)]), {});
    expect(result.main.map((n) => n.key)).toEqual(['event:1', 'article:4']);
  });
  it('also deduplicates repeated event leads through existing similarity groups', () => {
    const a = article(1),
      b = article(2);
    expect(selectNews(events([event(1), event(2)]), feed([a, b], [story(a, b)]), {}).main).toHaveLength(1);
  });
  it('has bounded main and latest panels, even without events', () => {
    const result = selectNews(null, feed(Array.from({ length: 200 }, (_, i) => article(i + 1))), {});
    expect(result.main).toHaveLength(6);
    expect(result.latest).toHaveLength(3);
    expect(result.main[0].key).toBe('article:200');
  });
  it('keeps positions on rank changes and replaces only vacated slots', () => {
    const before = selectNews(events([event(1), event(2), event(3)]), null, {}).main;
    const next = selectNews(events([event(3), { ...event(2), rank: 10 }, { ...event(4), rank: 1 }]), null, {}).main;
    expect(stableCards(before, next).map((n) => n.key)).toEqual(['event:4', 'event:2', 'event:3']);
    expect(stableCards(before, [])).toEqual(before);
  });
  it('does not lose surviving cards when the result shrinks', () => {
    const before = selectNews(events([event(1), event(2), event(3)]), null, {}).main;
    expect(stableCards(before, [before[2]]).map((n) => n.key)).toEqual(['event:3']);
  });
  it('clears the latest panel when its remaining news moves into the main events', () => {
    const articles = Array.from({ length: 7 }, (_, i) => article(i + 1));
    const before = selectNews(null, feed(articles), {});
    expect(before.latest).toHaveLength(1);
    const after = selectNews(events([event(1, articles)]), feed(articles), {});
    expect(after.latest).toHaveLength(0);
    expect(stableCards(before.latest, after.latest, false)).toEqual([]);
  });
  it('remains bounded and duplicate-free across six hours of 30-second updates', () => {
    let cards = selectNews(null, feed([article(1)]), {}).main;
    for (let tick = 1; tick <= 720; tick++) {
      const incoming = Array.from({ length: 40 }, (_, i) => article(tick * 40 + i));
      const next = selectNews(null, feed([...incoming, ...incoming]), {}).main;
      cards = stableCards(cards, next);
      expect(cards).toHaveLength(6);
      expect(new Set(cards.map((n) => n.key)).size).toBe(6);
      expect(stableCards(cards, next)).toEqual(cards);
    }
  });
});

describe('incomplete responses and follow settings', () => {
  it('rejects failed/malformed envelopes and keeps valid empty snapshots distinguishable', () => {
    expect(readFeed({ error: 'unavailable' })).toBeNull();
    expect(readFeed({ generatedAt: 'bad', articles: [] })).toBeNull();
    expect(readEvents({ events: [] })).toBeNull();
    expect(readFeed({ generatedAt: at, articles: [] })?.articles).toEqual([]);
    expect(readEvents({ hour: at, events: [] })?.events).toEqual([]);
  });
  it('renders incomplete articles without inventing dates, tags or body text', () => {
    const parsed = readFeed({ generatedAt: at, articles: [{ id: 1, title: '可閱讀的新聞標題' }], stories: [null], topics: [null] });
    expect(parsed?.articles[0]).toMatchObject({ tags: [], publishedAt: '', text: null, mediaTitle: '來源未提供' });
    expect(selectNews(null, parsed, {}).main[0]).toMatchObject({ href: '/article/1/', at: null });
    expect(parsed?.stories).toEqual([]);
    expect(parsed?.topics).toEqual([]);
  });
  it('keeps a topic update whose article body is not collected yet', () => {
    const parsed = readFeed({
      generatedAt: at,
      articles: [],
      topics: [{ id: 1, media: 'cna', title: '持續更新議題', stories: [{ title: '新進報導' }] }],
    });
    expect(parsed?.topics[0].stories[0]).toMatchObject({ title: '新進報導', article: null });
  });
  it('bounds and validates persisted tag settings, keeping exact person/tag names', () => {
    expect(readFollows([' 沈伯洋 ', '沈伯洋', null, '', 'a'.repeat(61), '市長'])).toEqual(['沈伯洋', '市長']);
    expect(readFollows(Array.from({ length: 100 }, (_, i) => `Tag ${i}`))).toHaveLength(5);
    expect(readFollows({ tag: '沈伯洋' })).toEqual([]);
    expect(readArticles({ articles: [] })).toBeNull();
  });
});
