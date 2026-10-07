import type { Ranking } from './api.ts';

export function rankingReady(ranking: Ranking | null): ranking is Ranking {
  return Boolean(ranking?.snapshot?.available && Array.isArray(ranking.entries));
}

/** Refresh only this panel through the same origin, independent of SSR caches. */
export async function fetchHomeRanking(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Ranking> {
  const path = '/api/v1/ranking/?category=news&order=burst&limit=8';
  let response = await fetcher(`${path}&trend=1`, { cache: 'no-store', signal, headers: { accept: 'application/json' } });
  // Trends are optional. A failed history query must not hide the ranking.
  if (!response.ok) response = await fetcher(path, { cache: 'no-store', signal, headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Home ranking: ${response.status}`);
  const ranking = (await response.json()) as Ranking;
  if (!rankingReady(ranking)) throw new Error('Ranking snapshot is not ready');
  return ranking;
}
