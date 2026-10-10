// Seed months before the Similarweb worker existed from the GeneHong sheet
// (app/data/media-traffic.json) into media_traffic_months, marked source=genehong.
// Rules: app/src/media-traffic/sheet-seed.ts. Dry run by default; --write stores.
// Safe to rerun: outlets skipped for lack of Similarweb data get checked again
// once the worker has fetched them, and sheet rows never replace Similarweb ones.
//   node --env-file=.env tools/import-genehong-traffic.ts [--write]
import disabled from '../app/data/crawl-disabled.json' with { type: 'json' };
import sheet from '../app/data/media-traffic.json' with { type: 'json' };
import catalog from '../app/data/news-source-catalog.json' with { type: 'json' };
import { createDb } from '../app/src/db/client.ts';
import { loadTrafficHistory, saveSheetHistory, withTrafficHistory } from '../app/src/media-traffic/history.ts';
import { readLiveTraffic } from '../app/src/media-traffic/live.ts';
import { sheetSeedRows } from '../app/src/media-traffic/sheet-seed.ts';
import { buildComparison } from '../web/src/lib/traffic-comparison.mts';

const write = process.argv.includes('--write');
const { db, close } = createDb();
try {
  const live = await readLiveTraffic();
  // Check the sheet only against months Similarweb itself returned, never against earlier seeds.
  const fetched = withTrafficHistory(live.domains, await loadTrafficHistory(db)).map((row) => ({
    ...row,
    monthly: row.monthly.filter((point) => !point.source),
  }));
  const comparison = buildComparison(sheet.snapshots, catalog.sources, null, new Set(disabled.excludedMedia), {
    ...live,
    domains: fetched,
  });
  const result = sheetSeedRows(comparison.outlets);
  const reasons = Object.groupBy(result.skipped, (row) => row.reason);
  console.log(`可匯入 ${result.imported.length} 家媒體、${result.rows.length} 個月份（原表 ${sheet.retrievedAt.slice(0, 10)} 匯入）`);
  for (const row of result.imported) console.log(`  + ${row.name} ${row.domain}: ${row.months.join(' ')}`);
  for (const [reason, rows] of Object.entries(reasons))
    console.log(
      `略過 ${reason}（${rows?.length}）：${rows?.map((row) => (row.detail ? `${row.name}（${row.detail}）` : row.name)).join('、')}`,
    );
  if (write) console.log('寫入', await saveSheetHistory(db, result.rows, sheet.retrievedAt));
  else console.log('試算（未寫入）；加 --write 寫入資料庫。');
} finally {
  await close();
}
