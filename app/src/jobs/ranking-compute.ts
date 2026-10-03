// Port of the ranking computation in legacy index.php (the "標籤雲" score).
// Per article, each tag in "[a][b][c]" contributes count+1 and a media-decayed
// score: 1 for the first article of a media, 0.5 for the second, 0.25 ...
// Sorting is a stable descending sort (PHP 5.4's arsort tie order is not
// reproduced; the legacy-compatible routes still read PHP's own cache).
import { isTagNoise } from '../tag-noise.ts';
import type { RankingBasis } from './ranking-basis.ts';
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
  basis?: RankingBasis;
  available?: boolean;
  truncated?: boolean;
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
  { weight, hours, limit = 500, basis }: { weight?: number; hours: number; limit?: number; basis?: RankingBasis },
): RankingChart {
  const count = new Map<string, number>();
  const score = new Map<string, number>();
  const perMedia = new Map<string, Map<string, number>>();
  let articles = 0;
  const mediaSeen = new Set<string>();
  const allowed = basis ? new Set(basis.media) : null;
  for (const row of rows) {
    if (allowed && !allowed.has(row.media)) continue;
    articles++;
    mediaSeen.add(row.media);
    for (const tag of splitLegacyTags(row.tags)) {
      if (isTagNoise(tag)) continue;
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
  // Production ranking uses the fixed cohort, including outlets with no reports.
  // Preserve the old default only for callers reading/computing unversioned data.
  return {
    weight: basis ? Math.max(1, basis.media.length) : (weight ?? Math.max(1, mediaSeen.size)),
    hours,
    mediaCount: mediaSeen.size,
    articleCount: articles,
    entries,
    truncated: ordered.length > limit,
    ...(basis ? { basis } : {}),
  };
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
  burst: number | null;
  history: Record<number, number | null>;
}
// Versioned charts use the fixed roster. Legacy charts must first be projected
// with applyRankingBasis before serving comparisons in the current API.
export function effectiveWeight(chart: Pick<RankingChart, 'weight' | 'mediaCount' | 'basis'>): number {
  if (chart.basis) return Math.max(1, chart.basis.media.length);
  return chart.mediaCount > 0 ? chart.mediaCount : Math.max(1, chart.weight);
}
export const normalizedScore = (chart: Pick<RankingChart, 'weight' | 'mediaCount' | 'basis'>, score: number) =>
  (score / effectiveWeight(chart)) * 50;

export function computeBurst(current: RankingChart, history: ReadonlyMap<number, RankingChart | null>): BurstEntry[] {
  const norm = normalizedScore;
  const lookup = new Map<number, Map<string, number>>();
  for (const [step] of BURST_STEPS) {
    const old = history.get(step) ?? null;
    const chart = old?.available !== false && old?.basis?.id === current.basis?.id ? old : null;
    lookup.set(step, new Map(chart ? chart.entries.map((e) => [e.tag, norm(chart, e.score)]) : []));
  }
  // Also filter stored snapshots so old noise does not return before a rebuild.
  const out: BurstEntry[] = current.entries
    .filter((e) => !isTagNoise(e.tag))
    .map((e, i) => {
      const normalized = norm(current, e.score);
      let burst = normalized;
      let complete = current.available !== false;
      const hist: Record<number, number | null> = {};
      for (const [step, w] of BURST_STEPS) {
        const chart = history.get(step);
        const compatible = chart && chart.available !== false && chart.basis?.id === current.basis?.id;
        const old = lookup.get(step)?.get(e.tag) ?? (compatible && chart.truncated === false ? 0 : null);
        hist[step] = old;
        if (old === null) complete = false;
        else burst += (normalized - old) * w;
      }
      return { ...e, rank: i + 1, normalized, burst: complete ? burst : null, history: hist };
    });
  return out.sort((a, b) => (b.burst ?? -Infinity) - (a.burst ?? -Infinity) || b.normalized - a.normalized);
}
