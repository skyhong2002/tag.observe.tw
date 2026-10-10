import { describe, expect, it } from 'vitest';
import type { NewsSource, TrafficSource } from '../../web/src/lib/media-traffic.mts';
import {
  buildComparison,
  type ComparisonData,
  type ComparisonOutlet,
  type CrawlComparison,
  collectionPoint,
  overrideTitle,
  primaryTraffic,
  rankValues,
  taiwanReadersByMedia,
  taiwanShare,
  taiwanSortValue,
  taiwanVisits,
  withPerArticle,
} from '../../web/src/lib/traffic-comparison.mts';
import traffic from '../data/media-traffic.json' with { type: 'json' };
import catalog from '../data/news-source-catalog.json' with { type: 'json' };

const row = (patch: Partial<TrafficSource> = {}): TrafficSource => ({
  row: 1,
  name: '地方新聞',
  domain: 'local.example',
  classification: null,
  category: '新聞',
  rank: null,
  traffic: null,
  growth: null,
  notes: [],
  ...patch,
});
const source: NewsSource = {
  media: 'local-news',
  name: '地方新聞',
  websiteUrl: 'https://local.example/',
  referenceNames: ['地方新聞', '地方新聞頻道'],
  referenceRows: [1, 2],
  existing: true,
  websiteEvidence: 'https://local.example/',
  notes: '',
};
const crawl: CrawlComparison = {
  generatedAt: '2026-10-04T00:00:00Z',
  collectionStartedAt: '2026-09-30T16:00:00Z',
  months: ['202608', '202609', '202610', '202611'],
  media: [
    {
      media: source.media,
      sourceKind: 'publisher',
      firstAcquiredAt: '2026-09-30T16:00:00Z',
      monthly: [
        { month: '202608', articles: 0 },
        { month: '202609', articles: 12 },
        { month: '202610', articles: 0 },
        { month: '202611', articles: 7 },
      ],
    },
  ],
};

describe('traffic comparison publisher identity and adjustments', () => {
  it('retains direct-source-only publishers when crawler and reference data are unavailable', () => {
    const live = {
      status: 'ok' as const,
      checkedAt: '2026-10-09T00:00:00Z',
      error: null,
      domains: [{ domain: 'local.example', fetchedAt: '2026-10-09T00:00:00Z', monthly: [{ month: '202609', visits: 120000 }] }],
    };
    const built = buildComparison([], [source], null, new Set(), live);
    expect(built.outlets).toHaveLength(1);
    expect(built.outlets[0]).toMatchObject({ media: source.media, referenceTraffic: [], traffic: [{ traffic: 120000 }] });
  });
  it('keeps Similarweb visits, Radar buckets and GeneHong original values and domains independent', () => {
    const snapshots = [{ month: '202608', sources: [row({ domain: 'channel.example', traffic: 30 })] }];
    const live = {
      status: 'ok' as const,
      checkedAt: '2026-10-09T00:00:00Z',
      error: null,
      domains: [{ domain: 'local.example', fetchedAt: '2026-10-09T00:00:00Z', monthly: [{ month: '202609', visits: 120000 }] }],
    };
    const radar = {
      status: 'ok' as const,
      checkedAt: live.checkedAt,
      error: null,
      domains: [
        {
          domain: 'local.example',
          fetchedAt: live.checkedAt,
          dateStart: '2026-10-07T00:00:00Z',
          dateEnd: '2026-10-08T00:00:00Z',
          rank: null,
          bucket: 2000,
        },
      ],
    };
    const built = buildComparison(snapshots, [source], crawl, new Set(), live, radar);
    expect(built.outlets[0]).toMatchObject({
      domain: 'local.example',
      referenceDomain: 'channel.example',
      traffic: [{ month: '202609', traffic: 120000 }],
      referenceTraffic: [{ month: '202608', traffic: 30 }],
      radar: { rank: null, bucket: 2000 },
    });
    expect(built.referenceMonths).toEqual(['202608']);
    expect(built.trafficMonths).toEqual(['202609']);
    const unavailable = buildComparison(
      snapshots,
      [source],
      crawl,
      new Set(),
      { ...live, status: 'blocked', domains: [] },
      { ...radar, status: 'unconfigured', domains: [] },
    );
    expect(unavailable.outlets[0].traffic).toEqual([]);
    expect(unavailable.outlets[0].radar).toBeUndefined();
    expect(unavailable.outlets[0].referenceTraffic?.[0].traffic).toBe(30);
    expect(buildComparison(snapshots, [source], crawl, new Set([source.media]), live, radar).outlets).toEqual([]);
  });
  it('uses only direct visit counts and keeps missing direct domains blank', () => {
    const second = { ...source, media: 'other-news', name: '另一媒體', websiteUrl: 'https://other.example/', referenceNames: ['另一媒體'] };
    const snapshots = [
      { month: '202608', sources: [row({ traffic: 30 }), row({ name: second.name, domain: 'other.example', traffic: 20 })] },
    ];
    const live = {
      status: 'partial' as const,
      checkedAt: '2026-10-09T00:00:00Z',
      error: 'timeout',
      domains: [{ domain: 'local.example', fetchedAt: '2026-10-08T00:00:00Z', monthly: [{ month: '202609', visits: 120000 }] }],
    };
    const built = buildComparison(snapshots, [source, second], null, new Set(), live);
    expect(built.trafficSource).toBe('similarweb-extension');
    expect(built.trafficMonths).toEqual(['202609']);
    expect(built.outlets.find((o) => o.media === source.media)?.traffic[0].traffic).toBe(120000);
    expect(built.outlets.find((o) => o.media === second.media)?.traffic).toEqual([]);
    const blocked = buildComparison(snapshots, [source, second], null, new Set(), { ...live, status: 'blocked' });
    expect(blocked.outlets.find((o) => o.media === source.media)?.traffic[0].traffic).toBe(120000);
    const empty = buildComparison(snapshots, [source], null, new Set(), { ...live, domains: [] });
    expect(empty.trafficMonths).toEqual([]);
    expect(empty.outlets.every((o) => o.traffic.length === 0)).toBe(true);
  });
  it('lists a shared whole-domain figure once, on the outlet at the site root', () => {
    const channel = {
      ...source,
      media: 'local-channel',
      name: '地方中文頻道',
      websiteUrl: 'https://local.example/zh/',
      referenceNames: ['地方中文頻道'],
    };
    const live = {
      status: 'ok' as const,
      checkedAt: '2026-10-09T00:00:00Z',
      error: null,
      domains: [{ domain: 'local.example', fetchedAt: '2026-10-08T00:00:00Z', monthly: [{ month: '202609', visits: 500 }] }],
    };
    const radar = {
      status: 'ok' as const,
      checkedAt: '2026-10-09T00:00:00Z',
      error: null,
      domains: [
        {
          domain: 'local.example',
          fetchedAt: '2026-10-09T00:00:00Z',
          dateStart: '2026-10-05T00:00:00Z',
          dateEnd: '2026-10-05T00:00:00Z',
          rank: null,
          bucket: 5000,
        },
      ],
    };
    const built = buildComparison([], [channel, source], null, new Set(), live, radar);
    const root = built.outlets.find((o) => o.media === source.media);
    const sub = built.outlets.find((o) => o.media === channel.media);
    expect(root?.traffic[0].traffic).toBe(500);
    expect(root?.radar?.bucket).toBe(5000);
    expect(root?.sharedWith).toBeUndefined();
    expect(sub?.traffic).toEqual([]);
    expect(sub?.radar).toBeUndefined();
    expect(sub?.sharedWith).toBe(root?.name);
    // Two outlets at the same depth: neither gets the figure.
    const twin = { ...channel, websiteUrl: 'https://local.example/' };
    const tied = buildComparison([], [twin, source], null, new Set(), live, radar);
    expect(tied.outlets.every((o) => o.traffic.length === 0 && !o.radar)).toBe(true);
  });
  it('measures an outlet crawled through a host platform on its own reviewed site', () => {
    // 三星傳媒 is crawled from n.yam.com/realtime/tristarnews but has its own site.
    const host = { ...source, media: 'yam', name: '蕃新聞', websiteUrl: 'https://n.yam.com/', referenceNames: ['蕃新聞'] };
    const guest = {
      ...source,
      media: 'tristarnews',
      name: '三星傳媒',
      websiteUrl: 'https://n.yam.com/realtime/tristarnews',
      referenceNames: ['三星傳媒'],
    };
    const live = {
      status: 'ok' as const,
      checkedAt: '2026-10-09T00:00:00Z',
      error: null,
      domains: [
        { domain: 'n.yam.com', fetchedAt: '2026-10-08T00:00:00Z', monthly: [{ month: '202609', visits: 900 }] },
        { domain: 'tristarnews.com.tw', fetchedAt: '2026-10-08T00:00:00Z', monthly: [{ month: '202609', visits: 40 }] },
      ],
    };
    const built = buildComparison([], [host, guest], null, new Set(), live, null);
    const yam = built.outlets.find((o) => o.media === 'yam');
    const tristar = built.outlets.find((o) => o.media === 'tristarnews');
    expect(yam?.traffic[0].traffic).toBe(900);
    expect(tristar?.domain).toBe('tristarnews.com.tw');
    expect(tristar?.sharedWith).toBeUndefined();
    expect(tristar?.traffic[0].traffic).toBe(40);
  });
  it('attaches the newest Similarweb profile and bounds Taiwan outside the top five', () => {
    const profile = (month: string, countries: Array<{ code: string; share: number }>) => ({
      month,
      countries,
      channels: { Direct: 0.4 },
      bounceRate: 0.5,
      pagesPerVisit: 2,
      timeOnSite: 100,
      globalRank: 1000,
      countryRank: null,
      categoryRank: null,
    });
    const live = {
      status: 'ok' as const,
      checkedAt: '2026-10-09T00:00:00Z',
      error: null,
      domains: [
        {
          domain: 'local.example',
          fetchedAt: '2026-10-08T00:00:00Z',
          monthly: [{ month: '202609', visits: 1000 }],
          profiles: {
            '202608': profile('202608', [{ code: 'TW', share: 0.5 }]),
            '202609': profile('202609', [{ code: 'TW', share: 0.9 }]),
          },
        },
      ],
    };
    const built = buildComparison([], [source], null, new Set(), live);
    const outlet = built.outlets.find((o) => o.media === source.media);
    expect(outlet?.trafficProfile?.month).toBe('202609');
    expect(taiwanShare(outlet?.trafficProfile)).toEqual({ share: 0.9 });
    const abroad = profile('202609', [
      { code: 'HK', share: 0.7 },
      { code: 'US', share: 0.1 },
      { code: 'SG', share: 0.03 },
    ]);
    expect(taiwanShare(abroad)).toEqual({ below: 0.03 });
    // Unknown shares sort after every known one, even a tiny known share.
    expect(taiwanSortValue(taiwanShare(abroad)) as number).toBeLessThan(
      taiwanSortValue(taiwanShare(profile('202609', [{ code: 'TW', share: 0.001 }]))) as number,
    );
    expect(taiwanShare(undefined)).toBeNull();
  });
  it('lets an admin correction replace the Similarweb Taiwan share and the readers estimate', () => {
    const source = { media: 'msn', name: 'MSN', websiteUrl: 'https://www.msn.com/' } as NewsSource;
    const countries = [
      { code: 'US', share: 0.34 },
      { code: 'JP', share: 0.07 },
    ];
    const msnProfile = { month: '202609', countries, channels: {}, bounceRate: null, pagesPerVisit: null, timeOnSite: null };
    const live = {
      status: 'ok' as const,
      checkedAt: null,
      error: null,
      domains: [
        {
          domain: 'msn.com',
          fetchedAt: '2026-10-01T00:00:00Z',
          monthly: [{ month: '202609', visits: 1_000_000 }],
          profiles: { '202609': { ...msnProfile, globalRank: null, countryRank: null, categoryRank: null } },
        },
      ],
    };
    const override = { share: 0.02, note: '全球網域', updatedAt: '2026-10-10T00:00:00.000Z' };
    const built = buildComparison([], [source], null, new Set(), live, null, { msn: override });
    const outlet = built.outlets.find((o) => o.media === 'msn');
    expect(outlet?.taiwanOverride).toEqual(override);
    const tw = taiwanShare(outlet?.trafficProfile, outlet?.taiwanOverride);
    expect(tw).toEqual({ share: 0.02, override, similarweb: { below: 0.07 } });
    expect(taiwanVisits(1_000_000, tw)).toEqual({ visits: 20_000 });
    expect(overrideTitle(tw)).toBe('人工修正（Similarweb 為 低於 7%）：全球網域・2026-10-10');
    // Without the correction the estimate is only an upper bound.
    expect(taiwanVisits(1_000_000, taiwanShare(outlet?.trafficProfile))).toEqual({ visits: 70_000, below: true });
    expect(taiwanVisits(null, tw)).toBeNull();
  });
  it('deduplicates real catalog parent/channel rows using the named primary without summing their traffic', () => {
    const latest = traffic.snapshots.find((snapshot) => snapshot.month === '202608')!;
    const built = buildComparison([latest], catalog.sources, null);
    const ltn = catalog.sources.find((entry) => entry.media === 'ltn')!;
    const primary = latest.sources.find((entry) => entry.name === ltn.name)!;
    const channel = latest.sources.find((entry) => entry.name === '自由 (新聞)')!;
    expect(primary.traffic).not.toBeNull();
    expect(channel.traffic).not.toBeNull();
    const matches = built.outlets.filter((outlet) => outlet.media === 'ltn');
    expect(matches).toHaveLength(1);
    expect(matches[0].traffic).toEqual([
      {
        month: latest.month,
        traffic: primary.traffic,
        rawTraffic: primary.traffic,
        growth: primary.growth,
        adjusted: false,
        ambiguous: false,
      },
    ]);
    expect(matches[0].traffic[0].traffic).not.toBe(primary.traffic! + channel.traffic!);
    const mapped = built.outlets.filter((outlet) => outlet.media !== null).map((outlet) => outlet.media);
    expect(new Set(mapped).size).toBe(mapped.length);
  });

  it('retains a missing named primary rather than substituting its different-scope channel', () => {
    const main = row();
    const channel = row({ row: 2, name: '地方新聞頻道', traffic: 5 });
    expect(primaryTraffic([main, channel], source)).toBe(main);
    const built = buildComparison([{ month: '202608', sources: [main, channel] }], [source], null);
    expect(built.outlets[0].traffic[0]).toMatchObject({ traffic: null, rawTraffic: null, ambiguous: false });
  });

  it('marks conflicting rows without a named primary as ambiguous instead of adding or arbitrarily picking', () => {
    const aliases = [{ ...source, name: '新官方名稱' }];
    const built = buildComparison(
      [{ month: '202608', sources: [row({ traffic: 10 }), row({ name: '地方新聞頻道', traffic: 4 })] }],
      aliases,
      null,
    );
    expect(built.outlets).toHaveLength(1);
    expect(built.outlets[0].traffic[0]).toMatchObject({ traffic: null, rawTraffic: null, ambiguous: true });
  });

  it('excludes the real July MSN artificial zero from traffic values and rankings while preserving raw evidence', () => {
    const july = traffic.snapshots.find((snapshot) => snapshot.month === '202607')!;
    const msnRow = july.sources.find((entry) => entry.name.trim() === 'MSN 新聞 zh-tw')!;
    expect(msnRow.traffic).toBe(0);
    expect(msnRow.notes).toContain('原表流量公式：=452.1*0');
    const built = buildComparison([july], catalog.sources, null);
    const msn = built.outlets.find((outlet) => outlet.media === 'msn')!;
    expect(msn).toBeDefined();
    expect(msn.traffic[0]).toMatchObject({ traffic: null, rawTraffic: 0, growth: null, adjusted: true });
    expect(rankValues(built.outlets, (outlet) => outlet.traffic[0]?.traffic ?? null).has(msn.key)).toBe(false);
  });

  it('recognizes a trailing divisor even when the older adjusted value has no formula', () => {
    const built = buildComparison([{ month: '202608', sources: [row({ name: '外媒 / 8 ', traffic: 0.25, growth: -0.3 })] }], [], null);
    expect(built.outlets[0].traffic[0]).toMatchObject({ traffic: null, rawTraffic: 0.25, growth: null, adjusted: true });
  });

  it('does not mistake a /17news URL or ordinary growth formula for a traffic adjustment', () => {
    const built = buildComparison(
      [
        {
          month: '202608',
          sources: [
            row({
              name: '民生好報 https://17news.net',
              traffic: 0.123,
              growth: 0.1,
              notes: ['名稱含人工調整倍數，流量依原表結果呈現，未還原。', '原表月增減公式：=(F8-N8)/N8'],
            }),
          ],
        },
      ],
      [],
      null,
    );
    expect(built.outlets[0].traffic[0]).toMatchObject({ traffic: 0.123, rawTraffic: 0.123, growth: 0.1, adjusted: false });
  });
});

describe('traffic comparison collection history', () => {
  it('keeps an unavailable crawl API as missing rather than inventing monthly zeroes', () => {
    const built = buildComparison(traffic.snapshots, catalog.sources, null);
    expect(built.generatedAt).toBeNull();
    expect(built.collectionStartedAt).toBeNull();
    expect(built.crawlMonths).toEqual([]);
    expect(built.outlets.length).toBeGreaterThan(0);
    for (const outlet of built.outlets) {
      expect(outlet.monthly).toBeNull();
      expect(collectionPoint(outlet, '202608')).toEqual({ articles: null, historical: true });
    }
  });

  it('distinguishes pre-collection zero, historical backfill and collected zero using Taiwan months', () => {
    const built = buildComparison([{ month: '202608', sources: [row({ traffic: 1 })] }], [source], crawl);
    const outlet = built.outlets[0];
    // UTC September 30 16:00 is October 1 in Taiwan.
    expect(collectionPoint(outlet, '202608')).toEqual({ articles: null, historical: true });
    expect(collectionPoint(outlet, '202609')).toEqual({ articles: 12, historical: true });
    expect(collectionPoint(outlet, '202610')).toEqual({ articles: 0, historical: false });
    expect(collectionPoint(outlet, '202611')).toEqual({ articles: 7, historical: false });
    expect(collectionPoint(outlet, '202612')).toEqual({ articles: null, historical: false });
    expect(built.months).toEqual(['202608', '202609', '202610', '202611']);
  });

  it('does not invent zero for a catalog publisher absent from a successful crawl response', () => {
    const built = buildComparison([{ month: '202608', sources: [row({ traffic: 1 })] }], [source], { ...crawl, media: [] });
    expect(collectionPoint(built.outlets[0], '202610')).toEqual({ articles: null, historical: true });
  });

  it('preserves a crawler-only publisher and its article history when external traffic is missing', () => {
    const built = buildComparison([], [source], crawl);
    expect(built.outlets).toHaveLength(1);
    expect(built.outlets[0].traffic).toEqual([]);
    expect(collectionPoint(built.outlets[0], '202609')).toEqual({ articles: 12, historical: true });
  });
});

describe('traffic comparison competition ranks', () => {
  it('uses 1,1,3 ranks for ties, includes observed zero and omits missing values without mutating input', () => {
    const outlet = (key: string, value: number | null): ComparisonOutlet => ({
      key,
      media: key,
      name: key,
      domain: null,
      sourceKind: 'publisher',
      firstAcquiredAt: null,
      monthly: null,
      traffic: [{ month: '202608', traffic: value, rawTraffic: value, growth: null, adjusted: false, ambiguous: false }],
    });
    const values = [outlet('third', 5), outlet('first-a', 10), outlet('missing', null), outlet('zero', 0), outlet('first-b', 10)];
    const originalOrder = values.map((entry) => entry.key);
    expect([...rankValues(values, (entry) => entry.traffic[0].traffic)]).toEqual([
      ['first-a', 1],
      ['first-b', 1],
      ['third', 3],
      ['zero', 4],
    ]);
    expect(values.map((entry) => entry.key)).toEqual(originalOrder);
  });
});

describe('traffic list domain fallbacks', () => {
  it('keeps a known spreadsheet domain even without traffic or a catalog match', () => {
    const built = buildComparison([{ month: '202608', sources: [row({ traffic: null })] }], [], null);
    expect(built.outlets[0].domain).toBe('local.example');
    expect(built.outlets[0].traffic[0].traffic).toBeNull();
  });

  it('fills missing domains from reviewed catalog websites without modifying the historical snapshot', () => {
    const original = row({ domain: null });
    const built = buildComparison([{ month: '202608', sources: [original] }], [source], null);
    expect(built.outlets[0].domain).toBe('local.example');
    expect(original.domain).toBeNull();
    expect(built.outlets[0].traffic[0].traffic).toBeNull();
    expect(buildComparison([{ month: '202608', sources: [row({ domain: 'original.example' })] }], [source], null).outlets[0].domain).toBe(
      'original.example',
    );
  });

  it('uses the reviewed name registry for crawler-only outlets missing from the traffic catalog', () => {
    const data = { ...crawl, media: [{ ...crawl.media[0], media: 'udnmoney' }] };
    expect(buildComparison([], [], data).outlets[0].domain).toBe('money.udn.com');
  });

  it('leaves unverified or unsafe websites unknown rather than guessing or throwing', () => {
    for (const websiteUrl of [null, 'not a URL', 'javascript:alert(1)', 'https://user:secret@local.example/']) {
      const built = buildComparison([], [{ ...source, websiteUrl }], crawl);
      expect(built.outlets[0].domain).toBeNull();
    }
  });

  it('drops outlets removed from the site, with their spreadsheet traffic', () => {
    const built = buildComparison([{ month: '202608', sources: [row({ traffic: 1 })] }], [source], crawl, new Set([source.media]));
    expect(built.outlets).toEqual([]);
  });
});

describe('Taiwan readers outside /media/traffic/', () => {
  const outlet = (media: string, patch: Partial<ComparisonOutlet>) =>
    ({ media, name: media, traffic: [{ month: '202609', traffic: 1_000_000 }], ...patch }) as unknown as ComparisonOutlet;
  const profile = (countries: Array<{ code: string; share: number }>) =>
    ({ month: '202609', countries }) as unknown as ComparisonOutlet['trafficProfile'];
  it('keys the latest month estimate by media id and skips shared or unknown figures', () => {
    const data = {
      trafficMonths: ['202608', '202609'],
      outlets: [
        outlet('local', { trafficProfile: profile([{ code: 'TW', share: 0.8 }]) }),
        outlet('global', {
          trafficProfile: profile([
            { code: 'US', share: 0.5 },
            { code: 'JP', share: 0.05 },
          ]),
        }),
        outlet('fixed', {
          trafficProfile: profile([{ code: 'US', share: 0.5 }]),
          taiwanOverride: { share: 0.1, note: '全球網域', updatedAt: '2026-10-10T00:00:00Z' },
        }),
        outlet('channel', { trafficProfile: profile([{ code: 'TW', share: 0.9 }]), sharedWith: '母站' }),
        outlet('noprofile', {}),
      ],
    } as unknown as ComparisonData;
    const readers = taiwanReadersByMedia(data);
    expect(Object.keys(readers).sort()).toEqual(['fixed', 'global', 'local']);
    expect(readers.local).toMatchObject({ visits: 800_000 });
    expect(readers.local.below).toBeUndefined();
    expect(readers.local.title).toBe('Similarweb 估算：2026/09 月造訪量 × 台灣占比 80%');
    expect(readers.global).toMatchObject({ visits: 50_000, below: true });
    expect(readers.fixed).toMatchObject({ visits: 100_000 });
    expect(readers.fixed.title).toContain('（人工修正）');
  });
  it('spreads the month over the past week pace of articles', () => {
    // September: 70 articles in 7 days → 300 for the month.
    const per = withPerArticle({ visits: 600_000, month: '202609', title: '' }, 70).perArticle;
    expect(per?.visits).toBe(2000);
    expect(per?.title).toBe('台灣月造訪 ÷ 2026/09 推估 300 篇（近 7 天 70 篇 ÷ 7 × 30 天）');
    expect(withPerArticle({ visits: 50_000, below: true, month: '202602', title: '' }, 7).perArticle).toEqual({
      visits: 1786,
      title: '上限：台灣月造訪 ÷ 2026/02 推估 28 篇（近 7 天 7 篇 ÷ 7 × 28 天）',
    });
    expect(withPerArticle({ visits: 1, month: '202609', title: '' }, 0).perArticle).toBeUndefined();
  });
  it('is empty without traffic months', () => {
    expect(taiwanReadersByMedia({ trafficMonths: [], outlets: [] } as unknown as ComparisonData)).toEqual({});
  });
});
