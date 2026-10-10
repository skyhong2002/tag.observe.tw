import { describe, expect, it } from 'vitest';
import { delayLabel, originSummary } from '../../web/src/lib/relation-label.mts';
import type { PairRelationInfo } from '../src/similarity/types.ts';

const relation = (patch: Partial<PairRelationInfo>): PairRelationInfo => ({
  kind: 'unattributed',
  sharedAuthors: [],
  aCitesB: false,
  bCitesA: false,
  commonSources: [],
  publication: 'a-earlier',
  ...patch,
});
const tvbs = { id: 1, mediaTitle: 'TVBS新聞網' },
  msn = { id: 2, mediaTitle: 'MSN新聞' };

describe('origin summary', () => {
  it('calls a shared byline a republication', () => {
    expect(originSummary(relation({ kind: 'same-byline', sharedAuthors: ['曹文寧'] }), { a: tvbs }, msn, tvbs)).toEqual({
      sentence: 'MSN新聞 轉載 TVBS新聞網 · 同一記者：曹文寧',
      roles: ['原稿', '轉載'],
    });
  });

  it('reads source credits from the later article’s side of the pair', () => {
    expect(originSummary(relation({ kind: 'attributed', bCitesA: true, bCreditRole: '來源' }), { a: tvbs }, msn, tvbs)).toEqual({
      sentence: 'MSN新聞 註明來源 TVBS新聞網',
      roles: ['原稿', '轉載'],
    });
  });

  it('only orders the two when nothing says who copied whom', () => {
    expect(originSummary(relation({}), { a: tvbs }, msn, tvbs)).toEqual({ sentence: '內文相近，未註明來源', roles: ['較早', '較晚'] });
    expect(
      originSummary(relation({ kind: 'attributed', commonSources: [{ media: 'cna', name: '中央社' }] }), { a: tvbs }, msn, tvbs).sentence,
    ).toBe('兩篇都註明來源：中央社');
  });

  it('labels the delay', () => {
    expect(delayLabel('2026-10-10T15:05:00Z', '2026-10-10T15:05:20Z')).toBe('同時');
    expect(delayLabel('2026-10-10T15:05:00Z', '2026-10-10T15:17:00Z')).toBe('晚 12 分鐘');
    expect(delayLabel('2026-10-10T15:05:00Z', '2026-10-10T18:05:00Z')).toBe('晚 3 小時');
    expect(delayLabel('2026-10-08T15:05:00Z', '2026-10-10T18:05:00Z')).toBe('晚 2 天');
  });
});
