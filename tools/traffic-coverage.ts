import { measureTrafficCoverage } from '../app/src/crawl/traffic-coverage.ts';
import { createDb } from '../app/src/db/client.ts';

const { db, close } = createDb();
try {
  const report = await measureTrafficCoverage(db);
  console.log(JSON.stringify(report, null, 2));
  if (!report.meetsTarget) process.exitCode = 1;
} finally {
  await close();
}
