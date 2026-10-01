import { describe, expect, it } from 'vitest';
import {
  type CompareCoverage,
  type CompareEventInput,
  headlineDiff,
  makeComparison,
  politicsPriority,
} from '../../web/src/lib/headline-compare.mts';

const seed: CompareEventInput = {
  rank: 1,
  major: ['鞭刑'],
  tags: [{ tag: '鞭刑' }, { tag: '洪孟楷' }],
  news: [{ title: '國民黨團再推鞭刑入法　四大重罪最高打12下' }],
  relatedEventPk: '327',
};
const article = (id: number, title: string, publishedAt = '2026-09-30T06:00:00Z') => ({
  id,
  title,
  publishedAt,
  url: `https://example.org/${id}`,
});
const coverage = (blue: ReturnType<typeof article>[], green: ReturnType<typeof article>[]): CompareCoverage => ({
  from: '2026-09-29T00:00:00Z',
  to: '2026-10-01T00:00:00Z',
  byOutlet: [
    { media: 'a', title: '甲報', camp: 'blue', articles: blue },
    { media: 'b', title: '乙報', camp: 'green', articles: green },
  ],
});

describe('headline comparisons', () => {
  it('pairs actual headlines while excluding unrelated lifetime-tag matches', () => {
    const a = article(1, seed.news[0].title);
    const b = article(2, '國民黨團推鞭刑入法！四大重罪最高12下　綠委籲充分討論');
    const result = makeComparison(seed, coverage([a, article(3, '洪孟楷談追加預算　新會期協商')], [b]));
    expect(result?.pair).toEqual([1, 2]);
    expect(result?.articles.map((a) => a.id)).toEqual([1, 2]);
    expect(result?.articles[0].title).toBe(a.title);
  });
  it('does not confuse the same politicians in different developments', () => {
    const event = {
      ...seed,
      major: ['莊競程', '高虹安'],
      tags: [],
      news: [{ title: '莊競程、高虹安巨城看板交鋒 何志勇拋「年領16800元」政見' }],
    };
    const result = makeComparison(
      event,
      coverage(
        [article(1, event.news[0].title)],
        [article(2, '竹市長選戰聚焦輕軌進度　莊競程高虹安陣營交鋒'), article(3, '巨城旁看板正面對決 莊競程點名高虹安：做不來的我來做')],
      ),
    );
    expect(result?.pair).toEqual([1, 3]);
    expect(result?.articles.some((a) => a.id === 2)).toBe(false);
  });
  it('keeps an absent side absent and does not pair distant publication dates', () => {
    const result = makeComparison(
      seed,
      coverage([article(1, seed.news[0].title)], [article(2, seed.news[0].title, '2026-09-28T06:00:00Z')]),
    );
    expect(result?.pair).toBeNull();
    expect(result?.articles).toHaveLength(1);
  });
  it('deduplicates within each outlet, validates dates/URLs, and handles empty data', () => {
    const result = makeComparison(
      seed,
      coverage(
        [
          article(1, seed.news[0].title),
          article(2, seed.news[0].title),
          article(3, seed.news[0].title, 'invalid'),
          { ...article(4, seed.news[0].title), url: 'javascript:alert(1)' },
        ],
        [article(5, seed.news[0].title)],
      ),
    );
    expect(result?.articles.map((a) => a.id)).toEqual([1, 5]);
    expect(makeComparison(seed, coverage([], []))).toBeNull();
    expect(makeComparison({ ...seed, news: [] }, coverage([], []))).toBeNull();
  });
  it('identifies politics without treating all news as political', () => {
    expect(politicsPriority(seed)).toBe(2);
    expect(politicsPriority({ ...seed, major: ['選手'], tags: [], news: [{ title: '選手奪冠' }] })).toBe(0);
  });
});

describe('literal headline differences', () => {
  it('preserves the exact original strings including punctuation and Unicode', () => {
    const titles = ['鞭刑入法！最高12下𠮷', '鞭刑入法？綠委籲討論𠮷'];
    const result = headlineDiff(titles[0], titles[1]);
    result.forEach((parts, i) => {
      expect(parts.map((p) => p.text).join('')).toBe(titles[i]);
    });
    expect(result[0].some((p) => p.different && p.text.includes('最高12下'))).toBe(true);
    expect(result[1].some((p) => p.different && p.text.includes('綠委籲討論'))).toBe(true);
  });
  it('does not highlight identical text or punctuation-only differences', () => {
    expect(
      headlineDiff('相同標題', '相同標題')
        .flat()
        .some((p) => p.different),
    ).toBe(false);
    expect(
      headlineDiff('相同標題！', '相同標題？')
        .flat()
        .some((p) => p.different),
    ).toBe(false);
    expect(headlineDiff('', '')).toEqual([[], []]);
  });
  it('bounds work for unexpectedly long input without truncating it', () => {
    const long = '字'.repeat(601);
    expect(headlineDiff(long, '短標題')[0]).toEqual([{ text: long, different: false }]);
  });
});
