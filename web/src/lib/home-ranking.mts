import type { Ranking } from './api.ts';

/** One home ranking row: only what the panel draws, so the page does not ship whole snapshots to the browser. */
export type HomeRankingRow = {
  tag: string;
  rank: number;
  rank24h: number | null;
  new: boolean;
  mediaCount: number;
  count: number;
  normalized: number;
  trend: Array<number | null>;
};

export const HOME_RANKING_ROWS = 8;

export function homeRankingRows(ranking: Ranking): HomeRankingRow[] {
  return ranking.entries.slice(0, HOME_RANKING_ROWS).map((e) => ({
    tag: e.tag,
    rank: e.rank,
    rank24h: e.rank24h,
    new: e.new,
    mediaCount: Object.keys(e.media).length,
    count: e.count,
    normalized: e.normalized,
    trend: e.trend?.map((p) => (p.average24h === null ? null : Math.round(p.average24h * 100) / 100)) ?? [],
  }));
}

export function rankingReady(ranking: Ranking | null): ranking is Ranking {
  return Boolean(ranking?.snapshot?.available && Array.isArray(ranking.entries));
}

/** Refresh only this panel through the same origin, independent of SSR caches. */
export async function fetchHomeRanking(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Ranking> {
  const path = '/api/v1/ranking?category=news&order=score&limit=8';
  let response = await fetcher(`${path}&trend=1`, { cache: 'no-store', signal, headers: { accept: 'application/json' } });
  // Trends are optional. A failed history query must not hide the ranking.
  if (!response.ok) response = await fetcher(path, { cache: 'no-store', signal, headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Home ranking: ${response.status}`);
  const ranking = (await response.json()) as Ranking;
  if (!rankingReady(ranking)) throw new Error('Ranking snapshot is not ready');
  return ranking;
}
