import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';
import { campLean, foldBaseline, groupFeedCoverage, matchPrevRank, rankTrail } from './event-feed.ts';

const cats = { blue: ['udn', 'tvbs'], green: ['ltn', 'setn'] };

describe('groupFeedCoverage', () => {
  it('counts outlets once per event and flags the silent camp', () => {
    const rows = [
      { articleId: 1, media: 'udn', tag: '核三' },
      { articleId: 1, media: 'udn', tag: '黃國昌' },
      { articleId: 2, media: 'tvbs', tag: '核三' },
      { articleId: 3, media: 'cna', tag: '核三' },
      { articleId: 4, media: 'ltn', tag: '大谷翔平' },
    ];
    const [nuclear, ohtani, empty] = groupFeedCoverage(rows, [['核三', '黃國昌'], ['大谷翔平'], ['沒人寫']], null, cats);
    expect(nuclear.articles).toBe(3);
    expect(nuclear.outlets.map((o) => o.media)).toEqual(['cna', 'tvbs', 'udn']);
    expect(nuclear.camps).toEqual({ blue: 2, green: 0, other: 1 });
    expect(nuclear.share).toEqual({ blue: 100, green: 0 });
    // Two outlets is not enough to call a blind spot or a tilt.
    expect(nuclear.blindspot).toEqual([]);
    expect(nuclear.tilt).toBeNull();
    expect(ohtani.camps).toEqual({ blue: 0, green: 1, other: 0 });
    expect(ohtani.share).toEqual({ blue: 0, green: 100 });
    expect(empty.share).toBeNull();
    expect(empty.lean).toBeNull();
  });
  it('orders outlets by how much they wrote', () => {
    const rows = [
      { articleId: 1, media: 'cna', tag: 'a' },
      { articleId: 2, media: 'udn', tag: 'a' },
      { articleId: 3, media: 'udn', tag: 'a' },
    ];
    expect(groupFeedCoverage(rows, [['a']], null, cats)[0].outlets.map((o) => o.media)).toEqual(['udn', 'cna']);
  });
  it('flags a blind spot when one camp is barely there and the other clearly is', () => {
    const wide = { blue: ['b1', 'b2', 'b3', 'b4', 'b5'], green: ['g1', 'g2', 'g3', 'g4', 'g5'] };
    const rows = ['g1', 'g2', 'g3', 'g4', 'b1'].map((media, i) => ({ articleId: i, media, tag: 't' }));
    const [c] = groupFeedCoverage(rows, [['t']], null, wide);
    expect(c.blindspot).toEqual(['blue']);
    expect(c.share).toEqual({ blue: 20, green: 80 });
    expect(c.tilt).toBe('green');
    const both = groupFeedCoverage([...rows, { articleId: 9, media: 'b2', tag: 't' }], [['t']], null, wide)[0];
    expect(both.blindspot).toEqual([]);
  });
});

describe('campLean', () => {
  const base = { outlets: { blue: 10, green: 15, other: 100 }, articles: { blue: 0, green: 0, other: 0 } };
  it('is near zero at the usual split and positive when blue is over-represented', () => {
    expect(Math.abs(campLean({ blue: 4, green: 6, other: 3 }, base) as number)).toBeLessThan(0.2);
    expect(campLean({ blue: 8, green: 3, other: 0 }, base) as number).toBeGreaterThan(1);
    expect(campLean({ blue: 1, green: 9, other: 0 }, base) as number).toBeLessThan(-1);
    expect(campLean({ blue: 0, green: 0, other: 4 }, base)).toBeNull();
  });
  it('falls back to a 1:1 baseline without one', () => {
    expect(campLean({ blue: 5, green: 5, other: 0 }, null)).toBe(0);
  });
});

describe('foldBaseline', () => {
  it('counts outlets and articles per camp, limiting 其他 to news outlets', () => {
    const cats = { blue: ['udn'], green: ['ltn'], news: ['udn', 'ltn', 'cna'] };
    const b = foldBaseline(
      [
        { media: 'udn', n: 30 },
        { media: 'ltn', n: 50 },
        { media: 'cna', n: 20 },
        { media: 'vogue', n: 99 },
      ],
      cats,
    );
    expect(b).toEqual({ outlets: { blue: 1, green: 1, other: 1 }, articles: { blue: 30, green: 50, other: 20 } });
  });
});

describe('matchPrevRank', () => {
  const prev = [
    { threadId: 809, rank: 1, major: ['楊植斗', '反毒', '管中閔'] },
    { threadId: 802, rank: 2, major: ['大谷翔平', '道奇'] },
    { threadId: null, rank: 3, major: ['油價'] },
  ];
  it('links by thread id first', () => {
    expect(matchPrevRank({ threadId: 802, major: ['別的'] }, prev)).toBe(2);
  });
  it('falls back to major-tag overlap when the thread id changed', () => {
    expect(matchPrevRank({ threadId: 817, major: ['楊植斗', '反毒', '沈伯洋'] }, prev)).toBe(1);
    expect(matchPrevRank({ threadId: 900, major: ['油價', '中油'] }, prev)).toBe(3);
  });
  it('accepts the same leading tag even when the rest moved on', () => {
    expect(matchPrevRank({ threadId: 903, major: ['大谷翔平', '山本由伸', '季後賽'] }, prev)).toBe(2);
  });
  it('needs at least half of the smaller major set in common', () => {
    expect(matchPrevRank({ threadId: 901, major: ['反毒', '校園', '教育部', '毒品'] }, prev)).toBeNull();
    expect(matchPrevRank({ threadId: 902, major: [] }, prev)).toBeNull();
  });
});

describe('rankTrail', () => {
  it('lays ranks on a dense 24-hour grid ending at the hour, keeping the best rank per hour', async () => {
    const hour = new Date('2026-10-04T06:00:00Z');
    const H = 3600e3;
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { threadId: 7, hourStart: new Date(+hour - 23 * H), rank: 12 },
        { threadId: 7, hourStart: hour, rank: 3 },
        { threadId: 7, hourStart: hour, rank: 9 },
        { threadId: 7, hourStart: new Date(+hour + H), rank: 1 },
        { threadId: 8, hourStart: new Date(+hour - H), rank: 30 },
      ]),
    };
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Db;
    const trails = await rankTrail(db, 'news', [7, 8, 9], hour);
    const seven = trails.get(7)!;
    expect(seven).toHaveLength(24);
    expect(seven[0]).toBe(12);
    expect(seven[23]).toBe(3);
    expect(seven.filter((r) => r !== null)).toHaveLength(2);
    expect(trails.get(8)![22]).toBe(30);
    expect(trails.get(9)!.every((r) => r === null)).toBe(true);
    expect(await rankTrail(db, 'news', [], hour)).toEqual(new Map());
  });
});
