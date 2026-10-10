import { describe, expect, it } from 'vitest';
import type { NewsSource, TrafficSource } from '../../web/src/lib/media-traffic.mts';
import {
  buildComparison,
  type ComparisonOutlet,
  type CrawlComparison,
  collectionPoint,
  primaryTraffic,
  rankValues,
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
