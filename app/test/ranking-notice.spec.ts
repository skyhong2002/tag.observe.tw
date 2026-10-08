import { describe, expect, it } from 'vitest';
import { rankingCategoryNote, rankingNotice } from '../../web/src/lib/ranking-notice.mts';
import { rankingQuery } from '../../web/src/lib/ranking-query.mts';

type Summary = NonNullable<Parameters<typeof rankingNotice>[1]>;
function summary(count: number, { articles = 52, available = true, unknown = 0 } = {}): Summary {
  return {
    snapshot: {
      available,
      articleCount: articles,
    },
    // Summary requests only return one entry even when hundreds match.
    entries: count ? [{ tag: '風格詞' }] : [],
    matchedCount: count,
    unknownGrowthCount: unknown,
  };
}

describe('ranking empty results and category availability', () => {
  it('offers the style data excluded by an optional media gate', () => {
    const query = rankingQuery({ category: 'style', gate: 'early' });
    const unrestricted = summary(230);
    expect(rankingNotice(query, summary(0), unrestricted, null)).toEqual({
      message: '「早期線索」目前列出 0 個關鍵字；不限媒體可查看 230 個。',
      action: 'unrestricted',
    });
    expect(rankingCategoryNote(unrestricted)).toBeNull();
  });

  it('uses the total candidate count rather than the one returned summary row', () => {
    const query = rankingQuery({ category: 'women', gate: 'early' });
    expect(rankingNotice(query, summary(1), summary(500), null)).toEqual({
      message: '「早期線索」目前列出 1 個關鍵字；不限媒體可查看 500 個。',
      action: 'unrestricted',
    });
  });

  it('does not promise filter recovery when there are genuinely no recent articles', () => {
    const empty = summary(0, { articles: 0 });
    expect(rankingNotice(rankingQuery({ category: 'movie', gate: 'early' }), empty, empty, null)).toEqual({
      message: '這個分類過去 24 小時沒有收錄報導。',
    });
    expect(rankingCategoryNote(empty)).toBe('無近期報導');
  });

  it('distinguishes articles without eligible tags from no articles', () => {
    const untagged = summary(0, { articles: 10 });
    expect(rankingNotice(rankingQuery({}), untagged, untagged, null)).toEqual({
      message: '這個分類的報導目前沒有可排行的關鍵字。',
    });
    expect(rankingCategoryNote(untagged)).toBe('暫無關鍵字');
  });

  it('keeps insufficient growth history distinct and offers the existing popular ranking', () => {
    const unknown = summary(0, { unknown: 42 });
    expect(rankingNotice(rankingQuery({ order: 'growth' }), unknown, unknown, summary(100))).toEqual({
      message: '目前 42 個關鍵字缺少可比較的歷史，暫無可確認的升溫關鍵字。',
      action: 'popular',
    });
  });

  it('does not label known non-growing topics as missing articles or missing history', () => {
    const notGrowing = summary(0);
    expect(rankingNotice(rankingQuery({ order: 'growth' }), notGrowing, notGrowing, summary(100))).toEqual({
      message: '目前沒有可確認正在升溫的關鍵字。',
      action: 'popular',
    });
  });

  it('does not infer no articles from unavailable statistics or a request failure', () => {
    const unavailable = summary(0, { available: false });
    expect(rankingNotice(rankingQuery({}), unavailable, unavailable, null)).toEqual({
      message: '這個時段的基準媒體收錄資料不足，暫不提供排行。',
    });
    expect(rankingCategoryNote(unavailable)).toBe('暫無排行');
    expect(rankingNotice(rankingQuery({}), null, null, null)).toEqual({ message: '排行資料暫時無法讀取，請稍後再試。' });
    expect(rankingCategoryNote(null)).toBeNull();
  });
});
