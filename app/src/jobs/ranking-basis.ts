import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import bundledBaseline from '../../data/ranking-baseline.json' with { type: 'json' };
import { isTagNoise } from '../tag-noise.ts';
import type { RankingChart } from './ranking-compute.ts';

// Previews can read an existing frozen cohort without rewriting its history.
const baseline: typeof bundledBaseline = process.env.TAG_RANKING_BASELINE_FILE
  ? JSON.parse(readFileSync(process.env.TAG_RANKING_BASELINE_FILE, 'utf8'))
  : bundledBaseline;

export interface RankingBasis {
  id: string;
  media: string[];
  coverageFrom: string;
  validFrom: string;
}

export function rankingBasis(category: string): RankingBasis {
  const media = [...((baseline.categories as Record<string, string[]>)[category] ?? [])].sort();
  const starts = baseline.coverageFrom as Record<string, string>;
  const from = Math.max(0, ...media.map((m) => Date.parse(starts[m])));
  const hash = createHash('sha256').update(JSON.stringify(media)).digest('hex').slice(0, 12);
  return {
    id: `${baseline.version}:${category}:${hash}`,
    media,
    coverageFrom: new Date(from).toISOString(),
    validFrom: new Date(from + 24 * 3600e3).toISOString(),
  };
}

/** Recalculate BOTH numerator and denominator from saved per-outlet counts.
 * Never relabel an incompatible fixed cohort: missing publishers cannot be
 * recovered. A chart over a superset of the basis can be: a revision that only
 * removes outlets (fixed-media-v2 drops on.cc) restates history exactly.
 */
export function applyRankingBasis(chart: RankingChart, basis: RankingBasis, at: Date): RankingChart {
  const covered = new Set(chart.basis?.media ?? []);
  const incompatible = chart.basis && chart.basis.id !== basis.id && !basis.media.every((m) => covered.has(m));
  const allowed = new Set(basis.media);
  const entries = chart.entries
    .filter((e) => !isTagNoise(e.tag))
    .map((e) => {
      const media = Object.fromEntries(Object.entries(e.media).filter(([m]) => allowed.has(m)));
      return {
        ...e,
        media,
        count: Object.values(media).reduce((a, n) => a + n, 0),
        score: Object.values(media).reduce((a, n) => a + 2 * (1 - 0.5 ** n), 0),
      };
    })
    .filter((e) => e.count > 0)
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({ ...e, rank: i + 1 }));
  return {
    ...chart,
    basis,
    weight: Math.max(1, basis.media.length),
    entries,
    // Old snapshots store only top-ranked terms; absence cannot prove zero.
    truncated: chart.truncated ?? true,
    available: !incompatible && chart.available !== false && at.getTime() >= Date.parse(basis.validFrom),
  };
}
