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
  it('compares nonpolitical sources without requiring opposing camps', () => {
    const event = { ...seed, major: ['網球'], tags: [], news: [{ title: '亞運網球女雙摘金 謝淑薇梁恩碩擊敗對手' }] };
    const cov = coverage([article(1, event.news[0].title)], [article(2, '謝淑薇梁恩碩亞運網球女雙摘金 擊敗對手奪冠')]);
    for (const outlet of cov.byOutlet) outlet.camp = 'other';
    expect(makeComparison(event, cov)?.pair).toBeNull();
    expect(makeComparison(event, cov, 'outlets')?.pair?.slice().sort()).toEqual([1, 2]);
  });
  it('does not present one outlet or identical syndicated headlines as different sources and wording', () => {
    const first = article(1, seed.news[0].title);
    const second = article(2, '國民黨團推鞭刑入法 四大重罪最高12下各界討論');
    expect(makeComparison(seed, coverage([first, second], []), 'outlets')?.pair).toBeNull();
    expect(makeComparison(seed, coverage([first], [article(3, first.title)]), 'outlets')?.pair).toBeNull();
    expect(makeComparison(seed, coverage([first], [article(3, first.title + ' - OwlNews')]), 'outlets')?.pair).toBeNull();
  });
  it('keeps topic and time safeguards when comparing outlets', () => {
    const result = makeComparison(
      seed,
      coverage(
        [article(1, seed.news[0].title)],
        [article(2, '洪孟楷談追加預算 新會期協商'), article(3, '國民黨團推鞭刑入法 四大重罪最高12下各界討論', '2026-09-28T06:00:00Z')],
      ),
      'outlets',
    );
    expect(result?.pair).toBeNull();
  });
  it('identifies politics without treating all news as political', () => {
    expect(politicsPriority(seed)).toBe(2);
    expect(politicsPriority({ ...seed, major: ['選手'], tags: [], news: [{ title: '選手奪冠' }] })).toBe(0);
  });
  it('keeps literal focus context distinct for titles with the same normalized text', () => {
    const event = { ...seed, major: ['AB'], tags: [], news: [{ title: 'ABxyz' }] };
    for (const reverse of [false, true]) {
      const blue = [article(1, 'ABxA-Byz'), article(2, 'ABxAByz')];
      if (reverse) blue.reverse();
      for (const mode of ['camps', 'outlets'] as const) {
        const result = makeComparison(event, coverage(blue, [article(3, 'ABxyz')]), mode);
        expect(result?.articles.some((a) => a.id === 2)).toBe(true);
        expect(result?.articles.some((a) => a.id === 1)).toBe(false);
        if (mode === 'camps') expect(result?.pair).toEqual([2, 3]);
      }
    }
  });
  it('recomputes context after input changes and does not retain mutations to returned articles', () => {
    const event = { ...seed, major: ['AB'], tags: [], news: [{ title: 'ABxyz' }] };
    const cov = coverage([article(1, 'ABxA-Byz'), article(2, 'ABxAByz')], [article(3, 'ABxyz')]);
    const snapshot = structuredClone({ event, cov });
    const first = makeComparison(event, cov)!;
    expect(first.pair).toEqual([2, 3]);
    first.focusTags.push('output-only');
    first.articles[0].title = 'output-only';
    first.articles.reverse();
    expect({ event, cov }).toEqual(snapshot);
    event.major = [];
    expect(makeComparison(event, cov)?.pair).toEqual([1, 3]);
    event.major = ['AB'];
    expect(makeComparison(event, cov)?.pair).toEqual([2, 3]);
    expect(makeComparison(event, cov)?.focusTags).toEqual(['AB']);
  });
  it('keeps the inclusive twelve-hour boundary at millisecond precision', () => {
    const start = Date.parse('2026-09-30T06:00:00Z');
    for (const delta of [-1, 0, 1]) {
      const result = makeComparison(
        seed,
        coverage([article(1, seed.news[0].title)], [article(2, seed.news[0].title, new Date(start + 12 * 3600e3 + delta).toISOString())]),
      );
      expect(result?.pair).toEqual(delta <= 0 ? [1, 2] : null);
    }
  });
  it('preserves the candidate and pair similarity thresholds', () => {
    const title = Array.from({ length: 101 }, (_, i) => String.fromCodePoint(0x6000 + i)).join('');
    const event = { ...seed, major: [], tags: [], news: [{ title }] };
    for (const sharedBigrams of [17, 18, 19, 23, 24, 25]) {
      const other =
        title.slice(0, sharedBigrams + 1) +
        Array.from({ length: 100 - sharedBigrams }, (_, i) => String.fromCodePoint(0x6800 + i)).join('');
      const result = makeComparison(event, coverage([article(1, title)], [article(2, other)]));
      expect(result?.articles.some((a) => a.id === 2)).toBe(sharedBigrams >= 18);
      expect(result?.pair).toEqual(sharedBigrams >= 24 ? [1, 2] : null);
    }
  });
  it('keeps the newer left tie-break and the first eligible right on equal scores', () => {
    const cov = coverage([article(10, seed.news[0].title)], [article(30, seed.news[0].title)]);
    cov.byOutlet.splice(1, 0, {
      media: 'newer-blue',
      title: '新甲報',
      camp: 'blue',
      articles: [article(20, seed.news[0].title, '2026-09-30T06:00:00.001Z')],
    });
    cov.byOutlet.push({ media: 'later-green', title: '新乙報', camp: 'green', articles: [article(40, seed.news[0].title)] });
    expect(makeComparison(seed, cov)?.pair).toEqual([20, 30]);
  });
  it('searches past rejected rows without reserving their deduplication keys', () => {
    const rejected = Array.from({ length: 64 }, (_, i) => ({ ...article(i + 10, seed.news[0].title), url: 'invalid' }));
    const cov = coverage([...rejected, article(1, seed.news[0].title)], [article(2, seed.news[0].title)]);
    expect(makeComparison(seed, cov)?.pair).toEqual([1, 2]);
    expect(makeComparison(seed, cov)?.articles.map((a) => a.id)).toEqual([1, 2]);
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
