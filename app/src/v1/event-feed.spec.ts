import { describe, expect, it } from 'vitest';
import { groupFeedCoverage, matchPrevRank } from './event-feed.ts';

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
    const [nuclear, ohtani, empty] = groupFeedCoverage(rows, [['核三', '黃國昌'], ['大谷翔平'], ['沒人寫']], cats);
    expect(nuclear.articles).toBe(3);
    expect(nuclear.outlets.map((o) => o.media)).toEqual(['cna', 'tvbs', 'udn']);
    expect(nuclear.camps).toEqual({ blue: 2, green: 0, other: 1 });
    expect(nuclear.blindspot).toEqual(['green']);
    expect(ohtani.camps).toEqual({ blue: 0, green: 1, other: 0 });
    expect(ohtani.blindspot).toEqual(['blue']);
    expect(empty).toEqual({ outlets: [], articles: 0, camps: { blue: 0, green: 0, other: 0 }, blindspot: [] });
  });
  it('orders outlets by how much they wrote', () => {
    const rows = [
      { articleId: 1, media: 'cna', tag: 'a' },
      { articleId: 2, media: 'udn', tag: 'a' },
      { articleId: 3, media: 'udn', tag: 'a' },
    ];
    expect(groupFeedCoverage(rows, [['a']], cats)[0].outlets.map((o) => o.media)).toEqual(['udn', 'cna']);
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
