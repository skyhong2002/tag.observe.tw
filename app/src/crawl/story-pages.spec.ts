import { describe, expect, it } from 'vitest';
import type { FetchResult } from './fetch.ts';
import { carryStoryDates, fetchStoryDates, newestFirst, storiesToDate, storyFetchBudget, storyUrl } from './story-pages.ts';
import type { TopicStory } from './topic-page.ts';

const now = new Date('2026-10-04T04:00:00Z');
const s = (key: string, extra: Partial<TopicStory> = {}): TopicStory => ({ key, title: `headline ${key}`, ...extra });
const dateOf = (x: TopicStory) => (x.date ? new Date(x.date) : null);
const res = (url: string, body: string, status = 200): FetchResult => ({ url, status, body, contentType: 'text/html', ms: 1 });

describe('carryStoryDates', () => {
  it('keeps dates and dateless marks stored for the same key; this topic first, then other topics', () => {
    const mine = new Map([
      ['a.tw/1', { date: '2025-01-01T00:00:00.000Z' }],
      ['a.tw/2', { dateless: true as const }],
    ]);
    const others = new Map([
      ['a.tw/1', { date: '2020-01-01T00:00:00.000Z' }],
      ['a.tw/3', { date: '2025-03-01T00:00:00.000Z' }],
    ]);
    const out = carryStoryDates(
      [s('a.tw/1'), s('a.tw/2'), s('a.tw/3'), s('a.tw/4'), s('a.tw/5', { date: '2026-01-01T00:00:00.000Z' })],
      mine,
      others,
    );
    expect(out.map((x) => x.date ?? (x.dateless ? 'dateless' : null))).toEqual([
      '2025-01-01T00:00:00.000Z',
      'dateless',
      '2025-03-01T00:00:00.000Z',
      null,
      '2026-01-01T00:00:00.000Z',
    ]);
  });
  it('lets a date shown on the topic page win over the stored one', () => {
    const out = carryStoryDates(
      [s('a.tw/1', { date: '2026-02-02T00:00:00.000Z' })],
      new Map([['a.tw/1', { date: '2025-01-01T00:00:00.000Z' }]]),
    );
    expect(out[0].date).toBe('2026-02-02T00:00:00.000Z');
  });
});

describe('newestFirst / storiesToDate', () => {
  it('reads the list direction from known dates, else from ids, else assumes newest first', () => {
    expect(newestFirst([s('a.tw/1', { date: '2024-01-01' }), s('a.tw/2'), s('a.tw/3', { date: '2025-01-01' })], dateOf)).toBe(false);
    expect(newestFirst([s('a.tw/1', { date: '2025-01-01' }), s('a.tw/2', { date: '2024-01-01' })], dateOf)).toBe(true);
    expect(newestFirst([s('a.tw/a/1001'), s('a.tw/a/1002'), s('a.tw/a/1003')], dateOf)).toBe(false);
    expect(newestFirst([s('a.tw/x'), s('a.tw/y')], dateOf)).toBe(true);
  });
  it('picks the two newest and the oldest undated stories', () => {
    const list = ['a.tw/a/9005', 'a.tw/a/9004', 'a.tw/a/9003', 'a.tw/a/9002', 'a.tw/a/9001'].map((k) => s(k));
    expect(storiesToDate(list, dateOf).map((x) => x.key)).toEqual(['a.tw/a/9005', 'a.tw/a/9004', 'a.tw/a/9001']);
    // Oldest first (ascending ids): the newest are at the end.
    expect(storiesToDate([...list].reverse(), dateOf).map((x) => x.key)).toEqual(['a.tw/a/9005', 'a.tw/a/9004', 'a.tw/a/9001']);
  });
  it('needs nothing for a topic dated at both ends, and steps past dateless pages', () => {
    const dated = [
      s('a.tw/3', { date: '2026-03-01' }),
      s('a.tw/2', { date: '2026-02-01' }),
      s('a.tw/x'),
      s('a.tw/1', { date: '2026-01-01' }),
    ];
    expect(storiesToDate(dated, dateOf)).toEqual([]);
    const marked = [s('a.tw/4', { dateless: true }), s('a.tw/3', { date: '2026-03-01' }), s('a.tw/2'), s('a.tw/1')];
    expect(storiesToDate(marked, dateOf).map((x) => x.key)).toEqual(['a.tw/2', 'a.tw/1']);
  });
  it('gives up on a topic whose story pages never show a date', () => {
    const list = [
      s('a.tw/1', { dateless: true }),
      s('a.tw/2', { dateless: true }),
      s('a.tw/3', { dateless: true }),
      s('a.tw/4'),
      s('a.tw/5'),
    ];
    expect(storiesToDate(list, dateOf)).toEqual([]);
  });
  it('skips stories without a fetchable address', () => {
    expect(storyUrl(s('news.example.tw#123'))).toBeNull();
    expect(storyUrl(s('news.example.tw#123', { url: 'https://news.example.tw/a/123' }))).toBe('https://news.example.tw/a/123');
    expect(storyUrl(s('www.example.tw/a/1?id=2'))).toBe('https://www.example.tw/a/1?id=2');
    expect(storiesToDate([s('news.example.tw#1'), s('news.example.tw#2')], dateOf)).toEqual([]);
  });
});

describe('storyFetchBudget', () => {
  it('caps the fetches per run, 議題 before 專題, each story once', () => {
    const feature = { kind: 'feature', stories: [s('a.tw/f1'), s('a.tw/f2')] };
    const topic1 = { kind: 'topic', stories: [s('a.tw/t1'), s('a.tw/shared')] };
    const topic2 = { kind: 'topic', stories: [s('a.tw/shared'), s('a.tw/t2')] };
    expect(storyFetchBudget([feature, topic1, topic2], 4).map((x) => x.key)).toEqual(['a.tw/t1', 'a.tw/shared', 'a.tw/t2', 'a.tw/f1']);
    expect(storyFetchBudget([feature, topic1], 0)).toEqual([]);
  });
  it('takes at most perMedia pages from one outlet', () => {
    const a = {
      kind: 'topic',
      media: 'cw',
      stories: [
        { key: 'cw.tw/1', title: '' },
        { key: 'cw.tw/2', title: '' },
        { key: 'cw.tw/3', title: '' },
      ],
    };
    const b = { kind: 'topic', media: 'pts', stories: [{ key: 'pts.tw/1', title: '' }] };
    expect(storyFetchBudget([a, b], 10, 2).map((x) => x.key)).toEqual(['cw.tw/1', 'cw.tw/2', 'pts.tw/1']);
  });
});

describe('fetchStoryDates', () => {
  const pages: Record<string, FetchResult | Error> = {
    'https://a.tw/meta': res('https://a.tw/meta', '<meta property="article:published_time" content="2025-05-01T10:00:00+08:00">'),
    'https://a.tw/ld': res(
      'https://a.tw/ld',
      `<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', url: 'https://a.tw/ld', datePublished: '2025-06-01T09:00:00+08:00', dateModified: '2026-10-01T09:00:00+08:00' })}</script>`,
    ),
    'https://a.tw/none': res('https://a.tw/none', '<h1>No date</h1><p>text</p>'),
    'https://a.tw/gone': res('https://a.tw/gone', '', 404),
    'https://a.tw/busy': res('https://a.tw/busy', '', 503),
    'https://a.tw/down': new Error('timeout'),
  };
  it('dates read pages, marks dateless or gone ones, and leaves unreachable ones to retry', async () => {
    const calls: Array<{ url: string; timeout?: number; retries?: number }> = [];
    const fetch = (async (url: string, opts: { timeout?: number; retries?: number } = {}) => {
      calls.push({ url, ...opts });
      const p = pages[url];
      if (p instanceof Error) throw p;
      return p;
    }) as never;
    const out = await fetchStoryDates(
      ['meta', 'ld', 'none', 'gone', 'busy', 'down'].map((k) => s(`a.tw/${k}`)),
      { fetch, now },
    );
    expect(Object.fromEntries([...out].map(([k, v]) => [k, v?.toISOString() ?? null]))).toEqual({
      'a.tw/meta': '2025-05-01T02:00:00.000Z',
      'a.tw/ld': '2025-06-01T01:00:00.000Z',
      'a.tw/none': null,
      'a.tw/gone': null,
    });
    expect(calls.every((c) => c.timeout === 15000 && c.retries === 0)).toBe(true);
  });
});
