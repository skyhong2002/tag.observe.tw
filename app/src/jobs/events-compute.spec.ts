import { describe, expect, it } from 'vitest';
import { type ArticleRow, CoOccurrence, clusterEvents, matchThread, threadUpdate } from './events-compute.ts';
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
});
