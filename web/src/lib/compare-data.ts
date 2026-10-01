import { API_ORIGIN } from './api';
import { type CompareCoverage, type CompareEvent, makeComparison, politicsPriority } from './headline-compare.mts';
import { fetchEvents } from './pages';

export async function loadComparisons(all: boolean) {
  const data = await fetchEvents(30);
  const unique = [...new Map((data?.events ?? []).filter((e) => e.relatedEventPk).map((e) => [e.relatedEventPk, e])).values()];
  const candidates = unique
    .filter((e) => all || politicsPriority(e) > 0)
    .sort((a, b) => politicsPriority(b) - politicsPriority(a) || a.rank - b.rank)
    .slice(0, all ? 20 : 14);
  const events: CompareEvent[] = [];
  let failed = 0;
  for (let i = 0; i < candidates.length; i += 3) {
    const batch = await Promise.all(
      candidates.slice(i, i + 3).map(async (e) => {
        try {
          const res = await fetch(`${API_ORIGIN}/api/v1/events/threads/${e.relatedEventPk}/coverage`, {
            next: { revalidate: 120 },
            signal: AbortSignal.timeout(6000),
          });
          if (!res.ok) {
            failed++;
            return null;
          }
          return makeComparison(e, (await res.json()) as CompareCoverage);
        } catch {
          failed++;
          return null;
        }
      }),
    );
    events.push(...batch.filter((e): e is CompareEvent => e !== null));
  }
  // Comparable pairs first; don't silently substitute unrelated stories for a missing side.
  events.sort((a, b) => Number(!!b.pair) - Number(!!a.pair));
  return { events, updated: data?.builtAt ?? null, stale: data?.stale ?? false, unavailable: !data, failed };
}
