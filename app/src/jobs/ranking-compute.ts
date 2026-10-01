// Port of the ranking computation in legacy index.php (the "標籤雲" score).
// Per article, each tag in "[a][b][c]" contributes count+1 and a media-decayed
// score: 1 for the first article of a media, 0.5 for the second, 0.25 ...
// Sorting is a stable descending sort (PHP 5.4's arsort tie order is not
// reproduced; the legacy-compatible routes still read PHP's own cache).
export interface TagSource {
  media: string;
  tags: string;
}
export interface RankingEntry {
  rank: number;
  tag: string;
  score: number;
  count: number;
  media: Record<string, number>;
}
export interface RankingChart {
  weight: number;
  hours: number;
  mediaCount: number;
  articleCount: number;
  entries: RankingEntry[];
}

export function splitLegacyTags(tags: string): string[] {
  // PHP: explode("]") then strip "[" and keep strlen(tag) > 1 (bytes).
  return tags
    .split(']')
    .map((t) => t.replaceAll('[', ''))
    .filter((t) => Buffer.byteLength(t) > 1);
}

export function computeRanking(
  rows: Iterable<TagSource>,
  { weight, hours, limit = 500 }: { weight?: number; hours: number; limit?: number },
): RankingChart {
  const count = new Map<string, number>();
  const score = new Map<string, number>();
  const perMedia = new Map<string, Map<string, number>>();
  let articles = 0;
  const mediaSeen = new Set<string>();
  for (const row of rows) {
    articles++;
    mediaSeen.add(row.media);
    for (const tag of splitLegacyTags(row.tags)) {
      count.set(tag, (count.get(tag) ?? 0) + 1);
      let media = perMedia.get(tag);
      if (!media) {
        media = new Map();
        perMedia.set(tag, media);
      }
      const seen = media.get(row.media) ?? 0;
      score.set(tag, (score.get(tag) ?? 0) + (seen === 0 ? 1 : 0.5 ** seen));
      media.set(row.media, seen + 1);
    }
  }
  const ordered = [...score.entries()].sort((a, b) => b[1] - a[1]);
  const entries: RankingEntry[] = ordered.slice(0, limit).map(([tag, s], i) => ({
    rank: i + 1,
    tag,
    score: s,
    count: count.get(tag) ?? 0,
    media: Object.fromEntries([...(perMedia.get(tag) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])),
  }));
  // Default weight (2026-09-29): the number of media that actually published in
  // the window, replacing the 2015 constants (14 for all, list length per category).
  return { weight: weight ?? Math.max(1, mediaSeen.size), hours, mediaCount: mediaSeen.size, articleCount: articles, entries };
}

// Legacy burst: score normalised to 50/weight, then the change against the
// 3/6/12/24/48-hour-old charts weighted 0.92/0.84/0.7/0.5/0.25.
export const BURST_STEPS: ReadonlyArray<[number, number]> = [
  [3, 0.92],
  [6, 0.84],
  [12, 0.7],
  [24, 0.5],
  [48, 0.25],
];
export interface BurstEntry extends RankingEntry {
  normalized: number;
  burst: number;
  history: Record<number, number | null>;
}
// Normalization divisor for any stored chart: the media that had data in its
// window. Older charts kept a constant weight but record mediaCount, so every
// chart in a burst comparison is normalized the same way.
export function effectiveWeight(chart: Pick<RankingChart, 'weight' | 'mediaCount'>): number {
  return chart.mediaCount > 0 ? chart.mediaCount : Math.max(1, chart.weight);
}
export const normalizedScore = (chart: Pick<RankingChart, 'weight' | 'mediaCount'>, score: number) => (score / effectiveWeight(chart)) * 50;

export function computeBurst(current: RankingChart, history: ReadonlyMap<number, RankingChart | null>): BurstEntry[] {
  const norm = normalizedScore;
  const lookup = new Map<number, Map<string, number>>();
  for (const [step] of BURST_STEPS) {
    const chart = history.get(step) ?? null;
    lookup.set(step, new Map(chart ? chart.entries.map((e) => [e.tag, norm(chart, e.score)]) : []));
  }
  const out: BurstEntry[] = current.entries.map((e) => {
    const normalized = norm(current, e.score);
    let burst = normalized;
    const hist: Record<number, number | null> = {};
    for (const [step, w] of BURST_STEPS) {
      const old = lookup.get(step)?.get(e.tag);
      hist[step] = old ?? null;
      burst += (normalized - (old ?? 0)) * w;
    }
    return { ...e, normalized, burst, history: hist };
  });
  return out.sort((a, b) => b.burst - a.burst);
}
