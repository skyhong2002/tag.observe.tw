import { and, eq, gte, lte } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { rankingSnapshots } from '../db/schema.ts';
import { applyRankingBasis, rankingBasis } from '../jobs/ranking-basis.ts';
import { BURST_STEPS, computeBurst, type RankingChart } from '../jobs/ranking-compute.ts';

// Each tag's place in the burst ranking hour by hour. Snapshots store only the
// score order, so every hour's burst order is rebuilt from the stored charts
// with the same rule (and history steps) as the live ranking.

const HOUR = 3600e3;
export const RANK_TRAIL_HOURS = 24;
const LOOKBACK = Math.max(...BURST_STEPS.map(([h]) => h));

export interface RankTrailPoint {
  t: string;
  /**
   * 1-based burst position, or null when the hour has no usable snapshot, the
   * tag was not on it, or its burst could not be compared (the ranking then
   * sorts it to the end, which is no real place).
   */
  position: number | null;
}

/** Burst positions for every tag over `hours` (hour starts in ms, oldest first). */
export function burstTrails(charts: ReadonlyMap<number, RankingChart | null>, hours: readonly number[]): Map<string, RankTrailPoint[]> {
  const tags = new Set<string>();
  const orders = hours.map((at) => {
    const current = charts.get(at);
    if (!current?.available) return new Map<string, number>();
    const history = new Map(BURST_STEPS.map(([h]) => [h, charts.get(at - h * HOUR) ?? null]));
    const order = computeBurst(current, history);
    for (const e of order) tags.add(e.tag);
    return new Map(order.flatMap((e, i) => (e.burst === null ? [] : [[e.tag, i + 1] as const])));
  });
  return new Map(
    [...tags].map((tag) => [tag, hours.map((at, i) => ({ t: new Date(at).toISOString(), position: orders[i].get(tag) ?? null }))]),
  );
}

// One rebuild per category and snapshot version (the current hour's snapshot is
// recomputed every 10 minutes); the board asks every couple of minutes.
const cache = new Map<string, Promise<Map<string, RankTrailPoint[]>>>();

/** The last RANK_TRAIL_HOURS hours of burst positions, ending with the given snapshot. */
export function loadBurstTrails(
  db: Db,
  category: string,
  snapshot: { hourStart: Date; computedAt: Date },
): Promise<Map<string, RankTrailPoint[]>> {
  const key = `${category}|${snapshot.hourStart.getTime()}|${snapshot.computedAt.getTime()}`;
  let found = cache.get(key);
  if (!found) {
    found = buildTrails(db, category, snapshot.hourStart);
    found.catch(() => cache.delete(key));
    cache.set(key, found);
    // A few categories and hours at most.
    if (cache.size > 8) cache.delete(cache.keys().next().value as string);
  }
  return found;
}

async function buildTrails(db: Db, category: string, end: Date) {
  const hours = Array.from({ length: RANK_TRAIL_HOURS }, (_, i) => end.getTime() - (RANK_TRAIL_HOURS - 1 - i) * HOUR);
  const rows = await db
    .select({ hourStart: rankingSnapshots.hourStart, computedAt: rankingSnapshots.computedAt, chart: rankingSnapshots.chart })
    .from(rankingSnapshots)
    .where(
      and(
        eq(rankingSnapshots.category, category),
        gte(rankingSnapshots.hourStart, new Date(hours[0] - LOOKBACK * HOUR)),
        lte(rankingSnapshots.hourStart, end),
      ),
    );
  const basis = rankingBasis(category);
  const charts = new Map(
    rows.map((r) => [r.hourStart.getTime(), applyRankingBasis(JSON.parse(r.chart) as RankingChart, basis, r.computedAt)] as const),
  );
  return burstTrails(charts, hours);
}
