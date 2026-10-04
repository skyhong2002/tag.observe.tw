import { describe, expect, it } from 'vitest';
import {
  bestRank,
  type CoverageOutlet,
  firstReports,
  flattenArticles,
  groupByHour,
  outletRows,
  sortOutletRows,
  tagStats,
} from '../../web/src/lib/event-thread.mts';

const hours = [
  {
    hourStart: '2026-10-04T06:00:00.000Z',
    rank: 1,
    score: 34.7,
    major: ['羅智強', '針頭'],
    tags: [
      ['毒品', 34.7],
      ['蔣萬安', 27.5],
      ['羅智強', 5.5],
    ] as Array<[string, number]>,
  },
  {
    hourStart: '2026-10-04T05:00:00.000Z',
    rank: 1,
    score: 34.2,
    major: ['羅智強', '毒品'],
    tags: [
      ['毒品', 34.2],
      ['沈伯洋', 24.6],
      ['羅智強', 6.1],
    ] as Array<[string, number]>,
  },
  {
    hourStart: '2026-10-04T04:00:00.000Z',
    rank: 2,
    score: 20,
    major: ['羅智強'],
    tags: [
      ['毒品', 20],
      ['羅智強', 4],
    ] as Array<[string, number]>,
  },
];

const article = (id: number, publishedAt: string, title = `t${id}`) => ({
  id,
  title,
  url: `https://x/${id}`,
  image: null,
  publishedAt,
  hits: 1,
});
const byOutlet: CoverageOutlet[] = [
  {
    media: 'udn',
    title: '聯合',
    icon: null,
    camp: 'blue',
    articles: [article(1, '2026-10-04T05:10:00.000Z'), article(2, '2026-10-04T03:30:00.000Z')],
  },
  { media: 'ltn', title: '自由', icon: null, camp: 'green', articles: [article(3, '2026-10-04T05:40:00.000Z')] },
  {
    media: 'cna',
    title: '中央社',
    icon: null,
    camp: 'other',
    articles: [article(4, '2026-10-04T05:05:00.000Z'), article(5, '2026-10-04T05:50:00.000Z'), article(6, '2026-10-04T06:01:00.000Z')],
  },
  { media: 'empty', title: '空', icon: null, camp: 'other', articles: [] },
];

describe('tagStats', () => {
  it('ranks every tag the event carried by its peak, marking major ones', () => {
    const stats = tagStats(hours, ['楊植斗', '羅智強']);
    expect(stats.map((s) => s.tag)).toEqual(['毒品', '蔣萬安', '沈伯洋', '羅智強', '針頭', '楊植斗']);
    const drug = stats[0];
    expect(drug).toMatchObject({ peak: 34.7, peakAt: '2026-10-04T06:00:00.000Z', hours: 3, major: true });
    expect(stats.find((s) => s.tag === '蔣萬安')).toMatchObject({ hours: 1, major: false });
    expect(stats.find((s) => s.tag === '羅智強')).toMatchObject({ peak: 6.1, hours: 3, major: true });
  });
  it('keeps thread major tags that never made an hourly list, at zero', () => {
    const s = tagStats(hours, ['楊植斗']).find((x) => x.tag === '楊植斗');
    expect(s).toMatchObject({ peak: 0, hours: 0, major: true });
  });
  it('reports the best rank and how long it held', () => {
    expect(bestRank(hours)).toEqual({ rank: 1, hours: 2 });
    expect(bestRank([])).toBeNull();
  });
});

describe('outlet rows', () => {
  it('summarises each outlet with first, last and latest headline', () => {
    const rows = outletRows(byOutlet);
    expect(rows.map((r) => r.media)).toEqual(['udn', 'ltn', 'cna']);
    expect(rows[0]).toMatchObject({ articles: 2, first: '2026-10-04T03:30:00.000Z', last: '2026-10-04T05:10:00.000Z' });
    expect(rows[0].latest.id).toBe(1);
  });
  it('sorts by any column with article count as the tie-break', () => {
    const rows = outletRows(byOutlet);
    const collator = new Intl.Collator('zh-Hant-TW-u-co-stroke');
    expect(sortOutletRows(rows, 'articles', 'desc', collator).map((r) => r.media)).toEqual(['cna', 'udn', 'ltn']);
    expect(sortOutletRows(rows, 'first', 'asc', collator).map((r) => r.media)).toEqual(['udn', 'cna', 'ltn']);
    expect(sortOutletRows(rows, 'camp', 'asc', collator).map((r) => r.media)).toEqual(['udn', 'ltn', 'cna']);
    expect(sortOutletRows(rows, 'last', 'desc', collator).map((r) => r.media)).toEqual(['cna', 'ltn', 'udn']);
  });
});

describe('headline grouping', () => {
  it('groups reports by hour and splits each hour by camp', () => {
    const groups = groupByHour(flattenArticles(byOutlet, 'asc'));
    expect(groups.map((g) => g.items.length)).toEqual([1, 4, 1]);
    const five = groups[1];
    expect(five.items.map((a) => a.id)).toEqual([4, 1, 3, 5]);
    expect(five.byCamp.blue.map((a) => a.id)).toEqual([1]);
    expect(five.byCamp.green.map((a) => a.id)).toEqual([3]);
    expect(five.byCamp.other.map((a) => a.id)).toEqual([4, 5]);
  });
  it('names the first report of each camp', () => {
    expect(firstReports(byOutlet).map((f) => [f.camp, f.article.id])).toEqual([
      ['blue', 2],
      ['green', 3],
      ['other', 4],
    ]);
  });
});
