import { describe, expect, it } from 'vitest';
import type { EventItem } from '../../web/src/lib/event-types.mts';
import {
  advance,
  BURST_MIN,
  burstCard,
  type Card,
  copyTone,
  dripDelay,
  enqueue,
  eventCards,
  eventReports,
  featuredFollower,
  fitSlots,
  gapLabel,
  headlineExtras,
  headlineGrid,
  type LiveStory,
  mergeTicker,
  nextReading,
  placeInSlot,
  rankMoves,
  seedSlots,
  sharedShare,
  sharedText,
  splitSeed,
  topicCards,
} from '../../web/src/lib/liveboard.mts';
import {
  bucketByCamp,
  groupStories,
  type LiveArticle,
  type PairRow,
  parseLiveQuery,
  pickTopics,
  readableText,
} from '../src/v1/liveboard.ts';
import { jobSchedules, nextCron, nextRun } from '../src/v1/liveboard-activity.ts';

const article = (id: number, minute: number, media = `m${id}`, title = `標題${id}`): LiveArticle => ({
  id,
  media,
  mediaTitle: media,
  camp: 'other',
  title,
  url: `https://example.com/${id}`,
  image: null,
  publishedAt: new Date(Date.UTC(2026, 9, 5, 0, minute)).toISOString(),
  datePending: false,
  tags: [],
  text: null,
  authors: [],
});
const pair = (aId: number, bId: number, score: number, computedMinute = 0): PairRow => ({
  aId,
  bId,
  score,
  containment: score,
  kind: score === 1 ? 'identical' : 'high',
  evidence: '共同段落',
  computedAt: new Date(Date.UTC(2026, 9, 5, 1, computedMinute)),
});
const event = (rank: number, id: string): EventItem => ({ rank, score: 1, major: [id], tags: [], news: [], relatedEventPk: id });
const card = (kind: Card['kind'], key: string, at: number): Card =>
  kind === 'burst' ? { kind, key, at, articles: [], total: 0 } : ({ kind: 'event', key, at, reason: 'new', event: event(1, key) } as Card);

describe('liveboard API shaping', () => {
  it('joins pairs into stories led by the earliest article', () => {
    const byId = new Map([article(1, 30), article(2, 0), article(3, 45), article(4, 50)].map((a) => [a.id, a]));
    const [story] = groupStories([pair(1, 2, 0.9), pair(1, 3, 0.6), pair(2, 4, 1, 5)], byId);
    expect(story.lead.id).toBe(2);
    expect(story.computedAt).toBe('2026-10-05T01:05:00.000Z');
    // 4 and 1 copy the lead directly; 3 only matches follower 1.
    expect(story.followers.map((f) => [f.article.id, f.direct, f.gapMinutes])).toEqual([
      [4, true, 50],
      [1, true, 30],
      [3, false, 45],
    ]);
  });
  it('keeps separate stories apart and skips pairs with unknown articles', () => {
    const byId = new Map([article(1, 0), article(2, 1), article(3, 2), article(4, 3)].map((a) => [a.id, a]));
    expect(groupStories([pair(1, 2, 0.8), pair(3, 4, 0.8), pair(4, 99, 0.9)], byId)).toHaveLength(2);
  });
  it('buckets counts per camp and drops rows outside the window', () => {
    const end = Date.UTC(2026, 9, 5, 2);
    const rows = [
      { media: 'x', at: end - 3600e3, n: 2 },
      { media: 'x', at: end - 1, n: 1 },
      { media: 'x', at: end, n: 5 },
    ];
    const buckets = bucketByCamp(rows, end, 3600e3, 2);
    expect(buckets.map((b) => b.other)).toEqual([0, 3]);
    expect(buckets[0].t).toBe('2026-10-05T00:00:00.000Z');
  });
  it('validates cursors', () => {
    expect(parseLiveQuery({})).toEqual({ after: null, pairsAfter: null, readAfter: null });
    expect(parseLiveQuery({ readAfter: 'x' })).toEqual({ error: 'bad readAfter' });
    expect(parseLiveQuery({ after: '12' })).toMatchObject({ after: 12 });
    expect(parseLiveQuery({ after: '-1' })).toEqual({ error: 'bad after' });
    expect(parseLiveQuery({ pairsAfter: 'soon' })).toEqual({ error: 'bad pairsAfter' });
  });
});

describe('liveboard queue', () => {
  it('orders by kind, then arrival, and never repeats a key', () => {
    const q = enqueue([card('burst', 'b', 1)], [card('event', 'e2', 3), card('event', 'e1', 2), card('event', 'e1', 4)], new Set(['old']));
    expect(q.map((c) => c.key)).toEqual(['e1', 'e2', 'b']);
    expect(enqueue(q, [card('event', 'old', 5)], new Set(['old']))).toHaveLength(3);
    expect(enqueue([], [card('event', 'a', 1), card('event', 'b', 2)], new Set(), 1).map((c) => c.key)).toEqual(['a']);
  });
  it('replays history when the queue runs dry', () => {
    let state = advance([card('event', 'a', 1), card('event', 'b', 2)], []);
    expect(state.card?.key).toBe('a');
    state = advance(state.queue, state.history);
    state = advance(state.queue, state.history);
    expect(state).toMatchObject({ replay: true, card: { key: 'a' } });
    expect(state.history.map((c) => c.key)).toEqual(['b', 'a']);
    expect(advance([], []).card).toBeNull();
  });
  it('turns event snapshots into new and climbing cards', () => {
    expect(eventCards(null, [event(1, 'a'), event(2, 'b'), event(3, 'c'), event(4, 'd')], 0)).toHaveLength(3);
    const cards = eventCards(
      [event(1, 'a'), event(9, 'b'), event(3, 'c')],
      [event(1, 'a'), event(5, 'b'), event(2, 'c'), event(3, 'n')],
      0,
    );
    expect(cards.map((c) => c.kind === 'event' && [c.key, c.reason])).toEqual([
      ['event:b:5', 'climb'],
      ['event:n:new', 'new'],
    ]);
  });
  it('features a retitled direct copy and labels how much was kept', () => {
    const lead = article(1, 0, 'cna', '中央社標題甲乙丙丁戊');
    const story: LiveStory = {
      key: '1',
      computedAt: '',
      lead,
      more: 0,
      followers: [
        { article: article(2, 5, 'a', lead.title), score: 0.99, containment: 1, kind: 'high', evidence: '', direct: true, gapMinutes: 5 },
        {
          article: article(3, 9, 'b', '完全不同的說法'),
          score: 0.8,
          containment: 1,
          kind: 'high',
          evidence: '',
          direct: true,
          gapMinutes: 9,
        },
        {
          article: article(4, 9, 'c', '另一種寫法啦'),
          score: 0.95,
          containment: 1,
          kind: 'high',
          evidence: '',
          direct: false,
          gapMinutes: 9,
        },
      ],
    };
    expect(featuredFollower(story)?.article.id).toBe(3);
    // A follower without body text cannot be compared, so a texted one wins.
    story.followers[0].article = { ...story.followers[0].article, text: '內文' };
    expect(featuredFollower(story)?.article.id).toBe(2);
    expect([
      copyTone({ score: 0.6, kind: 'high' }),
      copyTone({ score: 0.75, kind: 'high' }),
      copyTone({ score: 0.5, kind: 'identical' }),
    ]).toEqual(['heavy', 'light', 'same']);
  });
  it('makes one burst card per busy poll, one article per outlet first', () => {
    const list = Array.from({ length: BURST_MIN }, (_, i) => ({ ...article(i + 1, i, i % 2 ? 'a' : 'b'), text: '內文' }));
    // Articles whose text has not been read do not count.
    expect(burstCard([...list.slice(1), article(99, 0)], 0)).toBeNull();
    expect(burstCard(list.slice(1), 0)).toBeNull();
    expect(burstCard(list, 0)).toMatchObject({
      key: `burst:${BURST_MIN}`,
      total: BURST_MIN,
      articles: [{ media: 'b' }, { media: 'a' }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }],
    });
  });
  it('merges the ticker newest first without repeats', () => {
    expect(mergeTicker([article(1, 0), article(2, 0)], [article(3, 0), article(2, 0)], 2).map((a) => a.id)).toEqual([3, 2]);
  });
  it('labels publication gaps', () => {
    expect([gapLabel(0), gapLabel(7), gapLabel(60), gapLabel(125)]).toEqual(['同時', '晚 7 分', '晚 1 小時', '晚 2 小時 5 分']);
  });
});

describe('liveboard ticker rows', () => {
  it('replaces the longest-shown row in place', () => {
    let slots = seedSlots([article(3, 0), article(2, 0), article(1, 0)], 4);
    expect(slots.map((s) => s?.article.id ?? null)).toEqual([3, 2, 1, null]);
    let placed = placeInSlot(slots, article(4, 0), 1)!;
    expect(placed.index).toBe(3);
    slots = placed.slots;
    placed = placeInSlot(slots, article(5, 0), 2)!;
    // Article 1 (bottom of the seed) has been up longest.
    expect(placed.index).toBe(2);
    expect(placed.slots.map((s) => s?.article.id)).toEqual([3, 2, 5, 4]);
    expect(placeInSlot(placed.slots, article(5, 0), 3)).toBeNull();
  });
  it('drops the oldest rows when the screen shrinks', () => {
    const slots = seedSlots([article(3, 0), article(2, 0), article(1, 0)], 3);
    const placed = placeInSlot(slots, article(9, 0), 1)!.slots; // replaces 1 at the bottom
    expect(fitSlots(placed, 2).map((s) => s?.article.id)).toEqual([3, 9]);
    expect(fitSlots(placed, 4)).toHaveLength(4);
  });
  it('tracks keyword rank moves between fetches', () => {
    const moves = rankMoves(
      [
        { tag: 'a', rank: 1 },
        { tag: 'b', rank: 2 },
      ],
      [
        { tag: 'b', rank: 1 },
        { tag: 'c', rank: 2 },
      ],
    );
    expect([...moves]).toEqual([
      ['b', 1],
      ['c', 'new'],
    ]);
    expect(rankMoves(null, [{ tag: 'a', rank: 1 }]).get('a')).toBe(0);
  });
});

describe('liveboard text and pacing', () => {
  it('spreads a backlog over one poll, within bounds', () => {
    expect([dripDelay(6), dripDelay(0), dripDelay(100)]).toEqual([5000, 8000, 2500]);
    const { shown, pending } = splitSeed([article(1, 0), article(3, 0), article(2, 0)], 2);
    expect([shown.map((a) => a.id), pending.map((a) => a.id)]).toEqual([[1], [2, 3]]);
  });
  it('marks only long common runs as shared', () => {
    const [a, b] = sharedText('記者報導今天台北市政府宣布新政策。', '今天台北市政府宣布新政策，引發討論的');
    expect(a.filter((p) => !p.different).map((p) => p.text)).toEqual(['今天台北市政府宣布新政策']);
    expect(b.at(-1)).toEqual({ text: '，引發討論的', different: true });
    expect(sharedShare(a)).toBeGreaterThan(0.6);
    // A shared single character is not a shared passage.
    expect(sharedText('甲的乙', '丙的丁')[0].every((p) => p.different)).toBe(true);
  });
  it('lays out up to six headlines, one per outlet, pair first', () => {
    const at = '2026-10-05T00:00:00Z';
    const a = (id: number, media: string, title: string) => ({
      id,
      media,
      mediaTitle: media,
      camp: 'other' as const,
      title,
      url: '',
      publishedAt: at,
    });
    const compare = {
      id: '1',
      label: '',
      seedTitle: '',
      focusTags: [],
      political: false,
      from: at,
      to: at,
      pair: [2, 3] as [number, number],
      articles: [
        a(1, 'x', '台股大漲千點'),
        a(2, 'y', '台股收紅'),
        a(3, 'z', '台股收黑'),
        a(4, 'y', '重複媒體'),
        a(5, 'w', '加權指數'),
        a(6, 'v', '再一則'),
      ],
    };
    const grid = headlineGrid(compare, 4);
    expect(grid.map((g) => g.article.id)).toEqual([2, 3, 1, 5]);
    expect(grid[1].parts.filter((p) => p.different).map((p) => p.text)).toEqual(['黑']);
    expect(headlineExtras(compare, grid).map((x) => x.id)).toEqual([6]);
  });
  it('reads the newest unseen article, then cycles', () => {
    const list = [article(2, 0), article(1, 0)];
    expect(nextReading(list, new Set([2])).article?.id).toBe(1);
    expect(nextReading(list, new Set([1, 2]))).toMatchObject({ reset: true, article: { id: 2 } });
  });
});

describe('liveboard worker schedule', () => {
  // 2026-10-05 23:01 in Taipei.
  const now = Date.UTC(2026, 9, 5, 15, 1);
  it('finds the next cron minute in Taipei time', () => {
    expect(new Date(nextCron('4,34 * * * *', now)!).toISOString()).toBe('2026-10-05T15:04:00.000Z');
    expect(new Date(nextCron('15 4 * * *', now)!).toISOString()).toBe('2026-10-05T20:15:00.000Z');
    // Monday 05:30 Taipei; 10-05 is a Monday, so the next is a week later.
    expect(new Date(nextCron('30 5 * * 1', now)!).toISOString()).toBe('2026-10-11T21:30:00.000Z');
    expect(new Date(nextCron('*/15 * * * *', now)!).toISOString()).toBe('2026-10-05T15:15:00.000Z');
  });
  it('runs `every` schedules on multiples of the period and honours env overrides', () => {
    const schedules = jobSchedules({ CRAWL_NEWS_MINUTES: '5', CRAWL_ENABLED: '1' });
    const news = schedules.find((s) => s.job === 'crawl-news')!;
    expect(new Date(nextRun(news, now)!).toISOString()).toBe('2026-10-05T15:05:00.000Z');
    // A recorded start carries BullMQ's offset forward.
    expect(new Date(nextRun(news, now, now - 3 * 60e3 - 20e3)!).toISOString()).toBe('2026-10-05T15:02:40.000Z');
    expect(jobSchedules({ CRAWL_ENABLED: '0' }).some((s) => s.job.startsWith('crawl-') && s.job !== 'crawl-health')).toBe(false);
    expect(jobSchedules({}).some((s) => s.job === 'analytics')).toBe(false);
  });
});

describe('liveboard topics', () => {
  it('keeps at most two updates per outlet, newest first', () => {
    const t = (media: string, minute: number) => ({ media, at: new Date(Date.UTC(2026, 9, 5, 0, minute)).toISOString() });
    expect(pickTopics([t('a', 1), t('a', 3), t('a', 2), t('b', 0)]).map((x) => `${x.media}${x.at.slice(14, 16)}`)).toEqual([
      'a03',
      'a02',
      'b00',
    ]);
  });
  it('turns each topic update into one card', () => {
    const topic = {
      id: 7,
      media: 'cna',
      mediaTitle: '中央社',
      title: '議題',
      url: '',
      image: null,
      kind: 'topic' as const,
      isNew: false,
      at: 'x',
      storyCount: 3,
      stories: [],
    };
    expect(topicCards([topic], 0)).toEqual([]);
    const story = { title: '報導', url: null, date: null, article: { ...article(1, 0), text: '內文' } };
    const unread = { ...story, article: article(2, 0) };
    const [card] = topicCards([{ ...topic, stories: [story, unread] }], 0);
    expect(card.key).toBe('topic:7:x');
    expect(card.kind === 'topic' && card.topic.stories).toEqual([story]);
  });
});

describe('liveboard readable text', () => {
  it('keeps prose paragraphs and drops page chrome', () => {
    const chrome = '美利達\n\nOEM\n\n2026-10-05 16:11\n\n上一篇\n\n美伊戰火影響出口 豐興與台鋼鋼筋新價漲300元、後市看旺採購潮湧現';
    expect(readableText(chrome, 600)).toBeNull();
    const body =
      '記者王凱暄／綜合報導\n\n由於伺服器、高速交換器帶動高階銅箔基板需求大增，外資點名看好後續營運動能。\n  外資指出，台燿成長動能主要集中於伺服器、高速交換器。';
    expect(readableText(body, 600)).toBe(
      '由於伺服器、高速交換器帶動高階銅箔基板需求大增，外資點名看好後續營運動能。\n外資指出，台燿成長動能主要集中於伺服器、高速交換器。',
    );
    expect([...readableText(body, 10)!].length).toBe(10);
    expect(readableText(null, 10)).toBeNull();
  });
});

describe('liveboard event reports', () => {
  it('takes each outlet’s most on-topic report, summarised and newest first', () => {
    const r = (id: number, hits: number, at: string, description: string | null = 'd') => ({
      id,
      title: `t${id}`,
      url: '',
      image: null,
      publishedAt: at,
      hits,
      description,
    });
    const reports = eventReports({
      byOutlet: [
        { media: 'a', title: 'A', camp: 'blue', articles: [r(1, 1, '2026-10-05T03:00:00Z'), r(2, 2, '2026-10-05T01:00:00Z')] },
        { media: 'b', title: 'B', camp: 'green', articles: [r(3, 1, '2026-10-05T04:00:00Z', null)] },
        { media: 'c', title: 'C', camp: 'other', articles: [r(4, 1, '2026-10-05T02:00:00Z')] },
      ],
    });
    expect(reports.map((x) => x.id)).toEqual([4, 2, 3]);
    expect(reports[0]).toMatchObject({ media: 'c', mediaTitle: 'C' });
  });
});
