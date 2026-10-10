import { describe, expect, it } from 'vitest';
import { type SeedOutlet, sheetMatches, sheetSeedRows } from './sheet-seed.ts';

const outlet = (patch: Partial<SeedOutlet> = {}): SeedOutlet => ({
  key: 'udn',
  name: '聯合新聞網',
  domain: 'udn.com',
  sourceKind: 'publisher',
  referenceDomain: 'udn.com',
  traffic: [{ month: '202607', traffic: 42543824 }],
  referenceTraffic: [
    { month: '202606', traffic: 39.96, adjusted: false, ambiguous: false },
    { month: '202607', traffic: 42.54, adjusted: false, ambiguous: false },
  ],
  ...patch,
});

describe('GeneHong sheet seed', () => {
  it('takes months Similarweb no longer returns once an overlapping month agrees', () => {
    const result = sheetSeedRows([outlet()]);
    expect(result.rows).toEqual([{ domain: 'udn.com', month: '202606', visits: 39960000 }]);
    expect(result.skipped).toEqual([]);
  });

  it('allows for the sheet rounding but not a different figure', () => {
    expect(sheetMatches(1.253, 1252398)).toBe(true);
    expect(sheetMatches(4.5, 411909971)).toBe(false);
  });

  it.each([
    ['shared-domain', { sharedWith: 'BBC News' }],
    ['sheet-domain-differs', { referenceDomain: 'ltn.com.tw', domain: 'news.ltn.com.tw' }],
    ['no-overlap', { traffic: [] }],
    ['overlap-mismatch', { traffic: [{ month: '202607', traffic: 411909971 }] }],
    ['not-publisher', { sourceKind: 'discovery' as const }],
  ])('skips %s', (reason, patch) => {
    const result = sheetSeedRows([outlet(patch)]);
    expect(result.rows).toEqual([]);
    expect(result.skipped[0].reason).toBe(reason);
  });

  it('ignores manual divisors and ambiguous rows', () => {
    const result = sheetSeedRows([
      outlet({
        referenceTraffic: [
          { month: '202605', traffic: 4.4, adjusted: true, ambiguous: false },
          { month: '202606', traffic: 39.96, adjusted: false, ambiguous: true },
          { month: '202607', traffic: 42.54, adjusted: false, ambiguous: false },
        ],
      }),
    ]);
    expect(result.rows).toEqual([]);
    expect(result.skipped[0].reason).toBe('nothing-new');
  });
});
