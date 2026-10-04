import { describe, expect, it } from 'vitest';
import { type ArticleRow, CoOccurrence, clusterEvents, hubTags, matchThread, siteTags, threadUpdate } from './events-compute.ts';
import { computeBurst, computeRanking } from './ranking-compute.ts';

const t0 = new Date('2026-09-28T08:00:00Z');
const art = (id: number, media: string, tags: string[], minutesAgo = 10): ArticleRow => ({
  id,
  media,
  publishedAt: new Date(t0.getTime() - minutesAgo * 60e3),
  url: `https://${media}.tw/${id}`,
  title: `t${id}`,
  image: null,
  tags,
});
const rows: ArticleRow[] = [
  art(1, 'a', ['核電', '公投', '台電']),
  art(2, 'b', ['核電', '公投']),
  art(3, 'c', ['核電', '公投', '經濟部']),
  art(4, 'a', ['核電', '台電']),
  art(5, 'a', ['亞運', '游泳']),
  art(6, 'b', ['亞運', '游泳', '金牌']),
  art(7, 'c', ['亞運', '金牌']),
  art(8, 'a', ['天氣']),
  art(9, 'b', ['天氣', '颱風']),
];

describe('CoOccurrence', () => {
  it('finds equal tags at >50% co-occurrence, transitively', () => {
    const co = new CoOccurrence(rows);
    expect(co.count('核電')).toBe(4);
    expect([...co.equal('核電').keys()]).toEqual(['公投']);
    expect([...co.closure('核電', new Set()).keys()].sort()).toEqual(['公投']);
    expect([...co.closure('亞運', new Set()).keys()].sort()).toEqual(['游泳', '金牌'].sort());
    expect(co.closure('天氣', new Set(['颱風'])).size).toBe(0);
  });
});

describe('clusterEvents', () => {
  it('does not merge unrelated subjects through a category or year tag', () => {
    const articles = [
      art(1, 'a', ['彭佳慧', '許富凱', '地方生活', '115年']),
      art(2, 'b', ['彭佳慧', '許富凱', '地方生活', '115年']),
      art(3, 'a', ['核電', '公投', '地方生活', '115年']),
      art(4, 'b', ['核電', '公投', '地方生活', '115年']),
    ];
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const events = clusterEvents(computeBurst(chart, new Map()), articles, [], { now: t0 });
    expect(events.map((e) => e.tags.map(([tag]) => tag))).toEqual([
      ['彭佳慧', '許富凱'],
      ['核電', '公投'],
    ]);
  });
  it('groups equal tags into events, picks major tags and news like events.php', () => {
    const ranking = computeRanking(
      rows.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { weight: 3, hours: 24 },
    );
    const burst = computeBurst(
      ranking,
      new Map([
        [3, null],
        [6, null],
        [12, null],
        [24, null],
        [48, null],
      ]),
    );
    const events = clusterEvents(burst, rows, [], { now: t0 });
    const tags = events.map((e) => e.tags.map(([t]) => t).sort());
    // 台電 (2 articles, both with 核電) is equal-to 核電, so it joins that event via tagmap.
    expect(tags).toContainEqual(['公投', '台電', '核電']);
    expect(tags).toContainEqual(['亞運', '游泳', '金牌']);
    expect(events.every((e) => e.tags.length > 1)).toBe(true);
    expect(events.map((e) => e.rank)).toEqual([1, 2]);
    const nuclear = events.find((e) => e.tags.some(([t]) => t === '核電')) as NonNullable<(typeof events)[number]>;
    expect(nuclear.major).toEqual(['核電', '公投', '台電']);
    expect(nuclear.news.length).toBeGreaterThan(0);
    expect(nuclear.majorNews.length).toBeGreaterThan(0);
    expect(new Set(nuclear.news.map((n) => n.url)).size).toBe(nuclear.news.length);
  });
  it('keeps two stories apart when only an umbrella tag links them', () => {
    // Golf and a tennis row both mostly carry 亞運, but are never reported together.
    const articles = [
      ...[1, 2, 3, 4].map((i) => art(i, 'a', ['曾雅妮', '高爾夫', '亞運'])),
      ...[5, 6, 7, 8].map((i) => art(i, 'b', ['握手', '謝淑薇', '亞運'])),
      ...[9, 10].map((i) => art(i, 'c', ['亞運', '金牌'])),
    ];
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const burst = computeBurst(chart, new Map());
    const groups = (hubs: boolean) => clusterEvents(burst, articles, [], { now: t0, hubs }).map((e) => e.tags.map(([t]) => t).sort());
    expect(groups(false)).toHaveLength(1);
    const split = groups(true);
    expect(split).toHaveLength(2);
    expect(split.find((g) => g.includes('曾雅妮'))).not.toContain('握手');
    // The umbrella stays with one story instead of disappearing.
    expect(split.filter((g) => g.includes('亞運'))).toHaveLength(1);
  });
  it('flags a tag as a hub only when the tags reaching it are unrelated', () => {
    // 握手 and 網球 both lean on 謝淑薇 and are also reported together.
    const articles = [
      ...[1, 2, 3, 4].map((i) => art(i, 'a', ['握手', '謝淑薇'])),
      ...[5, 6].map((i) => art(i, 'b', ['網球', '謝淑薇', '握手'])),
    ];
    const co = new CoOccurrence(articles);
    const order = ['握手', '網球'];
    expect(hubTags(co, order, new Map(order.map((t) => [t, co.closure(t, new Set())]))).size).toBe(0);
  });
  it('attaches only articles carrying two of the event tags, one outlet first', () => {
    const articles = [
      ...[1, 2, 3].map((i) => art(i, 'a', ['沈伯洋', '競選總部', '蔡英文'], i)),
      art(4, 'b', ['沈伯洋', '競選總部'], 1),
      art(5, 'c', ['沈伯洋', '蔡英文'], 1),
      // Carries one event tag each: a church visit and another candidate's HQ.
      art(6, 'd', ['蔡英文', '安樂教會'], 0),
      art(7, 'e', ['競選總部', '彰化'], 0),
    ];
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const [ev] = clusterEvents(computeBurst(chart, new Map()), articles, [], { now: t0 });
    expect(ev.tags.map(([t]) => t).sort()).toEqual(['競選總部', '沈伯洋', '蔡英文'].sort());
    expect(ev.articles).toBe(5);
    const ids = ev.news.map((n) => n.id);
    expect(ids).not.toContain(6);
    expect(ids).not.toContain(7);
    // Three outlets before a second article from outlet a.
    expect(
      ev.news
        .slice(0, 3)
        .map((n) => n.media)
        .sort(),
    ).toEqual(['a', 'b', 'c']);
    expect(ev.majorNews.map((n) => n.id)).not.toContain(6);
  });
  it('ignores outlet section tags that every article of one outlet carries', () => {
    const articles = [
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => art(i, 'oncc', ['東網', '產經新聞', i < 5 ? '天氣' : '台股'])),
      ...[9, 10].map((i) => art(i, 'cna', ['天氣', '東北季風'])),
      ...[11, 12].map((i) => art(i, 'cna', ['台股', '台指期'])),
    ];
    expect([...siteTags(articles)].sort()).toEqual(['東網', '產經新聞']);
    const co = new CoOccurrence(articles);
    expect(co.count('東網')).toBe(0);
    expect(co.closure('天氣', new Set()).has('東網')).toBe(false);
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const groups = clusterEvents(computeBurst(chart, new Map()), articles, [], { now: t0 }).map((e) => e.tags.map(([t]) => t).sort());
    expect(groups).toHaveLength(2);
    for (const g of groups) expect(g).not.toContain('東網');
  });
  it('honours the no-equal list', () => {
    const ranking = computeRanking(
      rows.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { weight: 3, hours: 24 },
    );
    const burst = computeBurst(ranking, new Map());
    const events = clusterEvents(burst, rows, ['公投'], { now: t0 });
    expect(events.some((e) => e.tags.some(([t]) => t === '公投'))).toBe(false);
  });
});

describe('threads', () => {
  it('continues a thread on >=2 major hits and rebuilds all/max like events_history.php', () => {
    const th = { id: 1, lastTime: t0, allTags: ['核電', '公投', '台電'], history: { '2026-09-28 15:00:00': { 核電: 10, 公投: 8 } } };
    expect(matchThread(['核電', '公投', '經濟部'], [th])?.id).toBe(1);
    expect(matchThread(['核電', '亞運'], [th])).toBeNull();
    const u = threadUpdate(
      th,
      '2026-09-28 16:00:00',
      ['核電', '經濟部'],
      [
        ['核電', 12],
        ['經濟部', 5],
      ],
    );
    expect(u.hours).toBe(2);
    expect(u.maxTag).toBe('核電');
    expect(u.maxScore).toBe(12);
    expect(u.allTags).toEqual(['核電', '經濟部', '公投']);
    expect(u.majorTags[0]).toBe('核電');
  });
  it('picks the thread sharing the most major tags, then the most recent', () => {
    const at = (h: number) => new Date(t0.getTime() + h * 3600e3);
    const golf = { id: 1, lastTime: at(-1), allTags: ['曾雅妮', '徐薇淩', '高爾夫'], history: {} };
    const tennis = { id: 2, lastTime: at(-2), allTags: ['握手', '曾雅妮', '徐薇淩', '網球'], history: {} };
    expect(matchThread(['握手', '曾雅妮', '網球'], [golf, tennis])?.id).toBe(2);
    expect(matchThread(['曾雅妮', '徐薇淩'], [tennis, golf])?.id).toBe(1);
    expect(matchThread(['曾雅妮', '金牌'], [golf, tennis])).toBeNull();
  });
});
