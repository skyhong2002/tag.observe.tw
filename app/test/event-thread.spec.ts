import { describe, expect, it } from 'vitest';
import {
  bestRank,
  type CoverageOutlet,
  firstReports,
  flattenArticles,
  groupByHour,
  leadStories,
  outletRows,
  relevanceFloor,
  sortOutletRows,
  splitByRelevance,
  tagStats,
  titleSimilarity,
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

describe('reading order', () => {
  const report = (id: number, hits: number, title: string, extra: { description?: string; publishedAt?: string } = {}) => ({
    ...article(id, extra.publishedAt ?? '2026-10-05T05:00:00.000Z', title),
    hits,
    description: extra.description ?? null,
  });
  const outlet = (media: string, camp: 'blue' | 'green' | 'other', articles: ReturnType<typeof report>[]): CoverageOutlet => ({
    media,
    title: media,
    icon: null,
    camp,
    articles,
  });
  it('folds away reports naming one of several major tags only when enough name two', () => {
    const many = [
      outlet(
        'udn',
        'blue',
        [...Array(8)].map((_, i) => report(i + 1, 2, `台股台積電${i}`)),
      ),
      outlet('cna', 'other', [report(99, 1, '0050')]),
    ];
    expect(relevanceFloor(many, 5)).toBe(2);
    expect(relevanceFloor(many, 1)).toBe(1);
    expect(relevanceFloor(byOutlet, 5)).toBe(1);
    const { core, fringe } = splitByRelevance(many, 2);
    expect(core.map((o) => o.media)).toEqual(['udn']);
    expect(fringe.map((o) => [o.media, o.articles.map((a) => a.id)])).toEqual([['cna', [99]]]);
  });
  it('scores reworded copies of one headline as near-identical', () => {
    expect(titleSimilarity('台股狂飆千點 一舉突破49000大關', '台股狂飆千點！一舉突破49000大關')).toBe(1);
    expect(titleSimilarity('台股狂飆千點 一舉突破49000大關', '颱風山陀兒逼近 明起海警')).toBe(0);
  });
  it('picks lead stories by tag hits, one per outlet, without duplicate headlines or one camp taking over', () => {
    const leads = leadStories(
      [
        outlet('udn', 'blue', [report(1, 4, '台積電帶頭衝 台股狂飆千點'), report(2, 4, '台指期首度衝破五萬點')]),
        outlet('chinatimes', 'blue', [report(3, 4, '台指期夜盤飆677點', { description: '費半漲2.4%' })]),
        outlet('tvbs', 'blue', [report(4, 3, '外資買超台積電')]),
        outlet('ltn', 'green', [report(5, 4, '台積電帶頭衝！台股狂飆千點'), report(6, 2, '台股收盤創高')]),
        outlet('cna', 'other', [report(7, 1, '0050 怎麼買')]),
      ],
      4,
    );
    // chinatimes leads on its summary; udn's newest equal; ltn's copy of udn's headline gives way.
    expect(leads.map((a) => a.id)).toEqual([3, 1, 6, 7]);
    expect(leads.filter((a) => a.outlet.camp === 'blue')).toHaveLength(2);
  });
});
