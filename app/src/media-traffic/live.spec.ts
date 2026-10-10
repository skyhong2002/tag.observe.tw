import { describe, expect, it, vi } from 'vitest';
import { dueDomains, emptyTraffic, extensionHeaders, fetchDomainTraffic, mergeHistory, refreshTraffic, trafficDomain } from './live.ts';

describe('Similarweb live traffic source', () => {
  it('normalizes only bare public domains', () => {
    expect(trafficDomain('www.udn.com')).toBe('udn.com');
    expect(trafficDomain('https://udn.com/')).toBe('udn.com');
    expect(trafficDomain('http://user:pass@udn.com')).toBeNull();
  });

  it('sends the extension headers CloudFront requires', async () => {
    const request = vi.fn(async () => new Response('', { status: 403 }));
    await expect(fetchDomainTraffic('udn.com', request)).rejects.toThrow('Similarweb HTTP 403');
    expect(request).toHaveBeenCalledWith(
      'https://data.similarweb.com/api/v1/data?domain=udn.com',
      expect.objectContaining({ headers: extensionHeaders }),
    );
    expect(extensionHeaders).toMatchObject({
      origin: expect.stringMatching(/^chrome-extension:\/\//),
      'x-extension-version': expect.any(String),
    });
  });

  it('keeps the three newest monthly visit estimates', async () => {
    const row = await fetchDomainTraffic(
      'udn.com',
      async () =>
        new Response(
          JSON.stringify({
            SiteName: 'udn.com',
            EstimatedMonthlyVisits: {
              '2025-12-01': 1,
              '2026-01-01': 2,
              '2026-02-01': 3,
              '2026-03-01': 4,
            },
          }),
          { status: 200 },
        ),
      new Date('2026-10-09T00:00:00Z'),
    );
    expect(row.monthly).toEqual([
      { month: '202601', visits: 2 },
      { month: '202602', visits: 3 },
      { month: '202603', visits: 4 },
    ]);
  });

  it('stops a denied batch and preserves the previous snapshot', async () => {
    const request = vi.fn(async () => new Response('', { status: 403 }));
    const result = await refreshTraffic(
      ['udn.com', 'ltn.com.tw'],
      {
        version: 1,
        source: 'similarweb-extension',
        checkedAt: '2026-10-08T00:00:00Z',
        status: 'ok',
        error: null,
        domains: [{ domain: 'udn.com', fetchedAt: '2026-10-08T00:00:00Z', monthly: [{ month: '202608', visits: 10 }] }],
      },
      { request, delay: async () => {} },
    );
    expect(result.status).toBe('blocked');
    expect(result.domains[0].monthly[0].visits).toBe(10);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('fetches missing domains first, then the oldest, and skips fresh successes and recent misses', () => {
    const now = new Date('2026-10-10T00:00:00Z');
    const row = (domain: string, fetchedAt: string) => ({ domain, fetchedAt, monthly: [], profiles: {} });
    const due = dueDomains(
      ['fresh.com', 'old.com', 'older.com', 'new.com', 'nodata.com', 'retry.com'],
      {
        ...emptyTraffic(),
        domains: [
          row('fresh.com', '2026-10-08T00:00:00Z'),
          row('old.com', '2026-09-20T00:00:00Z'),
          row('older.com', '2026-09-01T00:00:00Z'),
        ],
        failedAt: { 'nodata.com': '2026-10-09T12:00:00Z', 'retry.com': '2026-10-08T00:00:00Z' },
      },
      now,
    );
    expect(due).toEqual(['new.com', 'older.com', 'old.com', 'retry.com']);
  });

  it('resumes after a rate limit and reports progress', async () => {
    const ok = (domain: string) =>
      new Response(JSON.stringify({ SiteName: domain, EstimatedMonthlyVisits: { '2026-09-01': 5 } }), { status: 200 });
    const request = vi
      .fn()
      .mockResolvedValueOnce(ok('a.com'))
      .mockResolvedValueOnce(new Response('', { status: 403 }));
    const now = new Date('2026-10-10T00:00:00Z');
    const first = await refreshTraffic(['a.com', 'b.com', 'c.com'], emptyTraffic(), { request, now, delay: async () => {} });
    expect(first).toMatchObject({ status: 'blocked', updated: 1, remaining: 2 });
    expect(first.failedAt).toEqual({});
    const { updated: _u, remaining: _r, ...snapshot } = first;
    const second = vi.fn(async (url: RequestInfo | URL) => ok(new URL(String(url)).searchParams.get('domain') as string));
    const next = await refreshTraffic(['a.com', 'b.com', 'c.com'], snapshot, { request: second, now, delay: async () => {} });
    expect(second).toHaveBeenCalledTimes(2);
    expect(next).toMatchObject({ status: 'ok', error: null, updated: 2, remaining: 0 });
    expect(next.domains.map((d) => d.domain).sort()).toEqual(['a.com', 'b.com', 'c.com']);
  });

  it('records domains without Similarweb data and keeps going', async () => {
    const request = vi.fn(async (url: RequestInfo | URL) => {
      const domain = new URL(String(url)).searchParams.get('domain') as string;
      return new Response(JSON.stringify({ SiteName: domain, EstimatedMonthlyVisits: domain === 'd.com' ? { '2026-09-01': 1 } : {} }));
    });
    const now = new Date('2026-10-10T00:00:00Z');
    const result = await refreshTraffic(['a.com', 'b.com', 'c.com', 'd.com'], emptyTraffic(), { request, now, delay: async () => {} });
    expect(request).toHaveBeenCalledTimes(4);
    expect(result).toMatchObject({ status: 'partial', updated: 1 });
    expect(Object.keys(result.failedAt ?? {})).toEqual(['a.com', 'b.com', 'c.com']);
  });

  it("stores the month's countries, channels, engagement and ranks, dropping malformed parts", async () => {
    const body = {
      SiteName: 'money.udn.com',
      EstimatedMonthlyVisits: { '2026-08-01': 4915427, '2026-09-01': 4323489 },
      Engagments: { BounceRate: '0.555', Month: '9', Year: '2026', PagePerVisit: '1.73', TimeOnSite: '121.95' },
      TopCountryShares: [
        { CountryCode: 'HK', Value: 0.019 },
        { CountryCode: 'TW', Value: 0.9346 },
        { CountryCode: 'bad', Value: 0.1 },
        { CountryCode: 'US', Value: 7 },
      ],
      TrafficSources: { Direct: 0.39, SearchOrganic: 0.44, GenAi: 0.006, Affiliate: 0, Unknown: 0.5, Mail: 'x' },
      GlobalRank: { Rank: 17750 },
      CountryRank: { CountryCode: 'TW', Rank: 223 },
      CategoryRank: { Category: 'News_and_Media', Rank: '29' },
    };
    const row = await fetchDomainTraffic('money.udn.com', async () => new Response(JSON.stringify(body)), new Date('2026-10-10T00:00:00Z'));
    expect(row.profiles).toEqual({
      '202609': {
        month: '202609',
        countries: [
          { code: 'TW', share: 0.9346 },
          { code: 'HK', share: 0.019 },
        ],
        channels: { Direct: 0.39, SearchOrganic: 0.44, GenAi: 0.006, Affiliate: 0 },
        bounceRate: 0.555,
        pagesPerVisit: 1.73,
        timeOnSite: 121.95,
        globalRank: 17750,
        countryRank: { code: 'TW', rank: 223 },
        categoryRank: { category: 'News_and_Media', rank: 29 },
      },
    });
    // No reporting month: visits are kept, the profile is not.
    const bare = await fetchDomainTraffic(
      'money.udn.com',
      async () => new Response(JSON.stringify({ ...body, Engagments: null })),
      new Date('2026-10-10T00:00:00Z'),
    );
    expect(bare.monthly.length).toBe(2);
    expect(bare.profiles).toEqual({});
  });

  it('keeps earlier months and profiles and refetches rows saved without profiles first', () => {
    const profile = (month: string) => ({
      month,
      countries: [],
      channels: {},
      bounceRate: null,
      pagesPerVisit: null,
      timeOnSite: null,
      globalRank: null,
      countryRank: null,
      categoryRank: null,
    });
    const old = { domain: 'a.com', fetchedAt: '2026-09-10T00:00:00Z', monthly: [], profiles: { '202608': profile('202608') } };
    const next = { domain: 'a.com', fetchedAt: '2026-10-10T00:00:00Z', monthly: [], profiles: { '202609': profile('202609') } };
    expect(Object.keys(mergeHistory(old, next).profiles ?? {})).toEqual(['202608', '202609']);
    // Months the fetch no longer returns stay; a month it returns takes the revised value.
    const kept = mergeHistory(
      {
        ...old,
        monthly: [
          { month: '202606', visits: 1 },
          { month: '202607', visits: 2 },
        ],
      },
      {
        ...next,
        monthly: [
          { month: '202607', visits: 3 },
          { month: '202608', visits: 4 },
        ],
      },
    );
    expect(kept.monthly).toEqual([
      { month: '202606', visits: 1 },
      { month: '202607', visits: 3 },
      { month: '202608', visits: 4 },
    ]);
    const now = new Date('2026-10-10T00:00:00Z');
    const fresh = '2026-10-09T00:00:00Z';
    const due = dueDomains(
      ['with.com', 'without.com'],
      {
        ...emptyTraffic(),
        domains: [
          { domain: 'with.com', fetchedAt: fresh, monthly: [], profiles: { '202609': profile('202609') } },
          { domain: 'without.com', fetchedAt: fresh, monthly: [] },
        ],
      },
      now,
    );
    expect(due).toEqual(['without.com']);
  });

  it.each([
    { SiteName: 'other.example', EstimatedMonthlyVisits: { '2026-08-01': 10 } },
    { SiteName: 'udn.com', EstimatedMonthlyVisits: { '2026-08-01': null } },
    { SiteName: 'udn.com', EstimatedMonthlyVisits: { '2026-13-01': 10 } },
    { SiteName: 'udn.com', EstimatedMonthlyVisits: { '2026-10-01': 10 } },
    { SiteName: 'udn.com', EstimatedMonthlyVisits: {} },
  ])('rejects wrong domains and invalid or missing visits', async (data) => {
    await expect(
      fetchDomainTraffic('udn.com', async () => new Response(JSON.stringify(data)), new Date('2026-10-09T00:00:00Z')),
    ).rejects.toThrow();
  });
});
