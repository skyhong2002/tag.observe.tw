import type { rankingQuery } from './ranking-query.mts';

// A data-only shape shared with Node-based checks, independent of the
// Next.js fetch client.
type Summary = {
  snapshot: { available: boolean; articleCount: number | null };
  entries: readonly unknown[];
  matchedCount?: number;
  unknownGrowthCount?: number;
};
type Notice = { message: string; action?: 'unrestricted' | 'popular' };
const count = (ranking: Summary) => ranking.matchedCount ?? ranking.entries.length;

// Use the unrestricted popular ranking, so an optional filter cannot make a
// category with articles look empty in the navigation.
export function rankingCategoryNote(ranking: Summary | null): string | null {
  if (!ranking) return null;
  if (!ranking.snapshot.available) return '暫無排行';
  if (ranking.snapshot.articleCount === 0) return '無近期報導';
  return count(ranking) === 0 ? '暫無關鍵字' : null;
}

export function rankingNotice(
  query: ReturnType<typeof rankingQuery>,
  ranking: Summary | null,
  unrestricted: Summary | null,
  popular: Summary | null,
): Notice | null {
  if (!ranking) return { message: '排行資料暫時無法讀取，請稍後再試。' };
  if (!ranking.snapshot.available) return { message: '這個時段的基準媒體收錄資料不足，暫不提供排行。' };
  if (ranking.snapshot.articleCount === 0) return { message: '這個分類過去 24 小時沒有收錄報導。' };

  const growing = query.order === 'growth';
  const noun = growing ? '升溫關鍵字' : '關鍵字';
  if (query.gate !== 'all' && unrestricted && count(unrestricted) > count(ranking)) {
    const label = query.gate === 'early' ? '早期線索' : '多家跟進';
    return {
      message: `「${label}」目前列出 ${count(ranking)} 個${noun}；不限媒體可查看 ${count(unrestricted)} 個。`,
      action: 'unrestricted',
    };
  }
  if (ranking.entries.length) return null;
  if (growing) {
    const unknown = unrestricted?.unknownGrowthCount ?? ranking.unknownGrowthCount ?? 0;
    return {
      message: unknown ? `目前 ${unknown} 個關鍵字缺少可比較的歷史，暫無可確認的升溫關鍵字。` : '目前沒有可確認正在升溫的關鍵字。',
      ...(popular && count(popular) > 0 ? { action: 'popular' as const } : {}),
    };
  }
  if (query.gate !== 'all') {
    return { message: '目前沒有符合所選跨媒體門檻的關鍵字。', action: 'unrestricted' };
  }
  return { message: '這個分類的報導目前沒有可排行的關鍵字。' };
}
