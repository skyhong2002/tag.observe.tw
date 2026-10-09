import { describe, expect, it } from 'vitest';
import { fetchDomainTraffic, refreshTraffic, trafficDomain } from './live.ts';

describe('Similarweb live traffic source', () => {
  it('normalizes only bare public domains', () => {
    expect(trafficDomain('www.udn.com')).toBe('udn.com');
    expect(trafficDomain('https://udn.com/')).toBe('udn.com');
    expect(trafficDomain('http://user:pass@udn.com')).toBeNull();
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
      { request: async () => new Response('', { status: 403 }), delay: async () => {} },
    );
    expect(result.status).toBe('blocked');
    expect(result.domains[0].monthly[0].visits).toBe(10);
  });
});
