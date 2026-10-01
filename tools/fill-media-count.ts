// One-off (idempotent): snapshots imported from the legacy site stored
// media_count = 0. Recover it as the number of distinct media across the
// chart's entries (each entry keeps its per-media article counts), so burst
// comparisons normalize old and new charts the same way (effectiveWeight).
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { createDb } from '../app/src/db/client.ts';
import { rankingSnapshots } from '../app/src/db/schema.ts';
import type { RankingChart } from '../app/src/jobs/ranking-compute.ts';

const { db, close } = createDb();
try {
  let lastId = 0,
    updated = 0,
    empty = 0;
  for (;;) {
    const rows = await db
      .select({ id: rankingSnapshots.id, chart: rankingSnapshots.chart })
      .from(rankingSnapshots)
      .where(and(eq(rankingSnapshots.mediaCount, 0), gt(rankingSnapshots.id, lastId)))
      .orderBy(asc(rankingSnapshots.id))
      .limit(200);
    if (!rows.length) break;
    for (const r of rows) {
      lastId = r.id;
      const chart = JSON.parse(r.chart) as RankingChart;
      const media = new Set<string>();
      for (const e of chart.entries) for (const m of Object.keys(e.media ?? {})) media.add(m);
      if (!media.size) {
        empty++;
        continue;
      }
      chart.mediaCount = media.size;
      await db
        .update(rankingSnapshots)
        .set({ mediaCount: media.size, chart: JSON.stringify(chart) })
        .where(eq(rankingSnapshots.id, r.id));
      updated++;
    }
  }
  const [left] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(rankingSnapshots)
    .where(and(eq(rankingSnapshots.mediaCount, 0), gt(rankingSnapshots.articleCount, 0)));
  console.log(JSON.stringify({ updated, emptyCharts: empty, stillZeroWithArticles: Number(left.n) }));
} finally {
  await close();
}
