export type DemoCamp = 'green' | 'other' | 'blue';
export interface CampOutlet {
  media: string;
  title: string;
  icon: string | null;
  last24h: number;
  active: boolean;
}
export interface CampShare {
  hourStart: string;
  articles: number;
  camps: Array<{ camp: DemoCamp; articles: number; outlets: CampOutlet[] }>;
}

type Counts = { snapshot: { hourStart: string; articleCount: number | null; available?: boolean } };

/** Refuse missing or incompatible counts instead of presenting them as zero. */
export function campShareCounts(news: Counts | null, blue: Counts | null, green: Counts | null): CampShare | null {
  if (!news || !blue || !green) return null;
  const snapshots = [news.snapshot, blue.snapshot, green.snapshot];
  const hours = snapshots.map((s) => Date.parse(s.hourStart));
  if (
    hours.some((hour) => !Number.isFinite(hour)) ||
    Math.abs(hours[1] - hours[0]) > 3600e3 ||
    Math.abs(hours[2] - hours[0]) > 3600e3 ||
    snapshots.some((s) => s.available === false || s.articleCount === null || !Number.isSafeInteger(s.articleCount) || s.articleCount < 0)
  )
    return null;
  const total = news.snapshot.articleCount!;
  const b = blue.snapshot.articleCount!;
  const g = green.snapshot.articleCount!;
  if (total === 0 || b + g > total) return null;
  return {
    hourStart: news.snapshot.hourStart,
    articles: total,
    camps: [
      { camp: 'green', articles: g, outlets: [] },
      { camp: 'other', articles: total - b - g, outlets: [] },
      { camp: 'blue', articles: b, outlets: [] },
    ],
  };
}

/** Recovery bypasses both the browser cache and Next's independent fetch caches. */
export async function fetchCampShare(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<CampShare> {
  const read = async (category: string, at?: string): Promise<Counts> => {
    const params = new URLSearchParams({ category, order: 'score', limit: '1' });
    if (at) params.set('at', at);
    const response = await fetcher(`/api/v1/ranking?${params}`, { cache: 'no-store', signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`camp share ${category}: ${response.status}`);
    const data = (await response.json()) as Counts;
    if (!data?.snapshot || !Number.isFinite(Date.parse(data.snapshot.hourStart))) throw new Error('Missing ranking snapshot');
    return data;
  };
  let [news, blue, green] = await Promise.all(['news', 'blue', 'green'].map((category) => read(category)));
  // If a ranking job is crossing the hour, read every category at the oldest
  // completed hour instead of subtracting counts from different 24h windows.
  const hours = [news, blue, green].map((r) => r.snapshot.hourStart);
  if (new Set(hours).size > 1) {
    const at = new Date(Math.min(...hours.map(Date.parse))).toISOString();
    [news, blue, green] = await Promise.all(['news', 'blue', 'green'].map((category) => read(category, at)));
  }
  const share = campShareCounts(news, blue, green);
  if (!share) throw new Error('Camp share counts are not ready');
  return share;
}

/** Largest remainders keep displayed whole percentages adding up to 100. */
export function wholePercentages(counts: number[]): number[] {
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (!total) return counts.map(() => 0);
  const exact = counts.map((n) => (n / total) * 100);
  const percentages = exact.map(Math.floor);
  const remaining = 100 - percentages.reduce((sum, n) => sum + n, 0);
  exact
    .map((n, i) => ({ i, remainder: n - percentages[i] }))
    .sort((a, b) => b.remainder - a.remainder)
    .slice(0, remaining)
    .forEach(({ i }) => {
      percentages[i]++;
    });
  return percentages;
}
