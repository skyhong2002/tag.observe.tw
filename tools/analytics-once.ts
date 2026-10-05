// Run the GA4 / Search Console pull once (same as the worker's analytics job):
//   set -a; . ~/.config/tag-observe-analytics/analytics.env; set +a
//   node --env-file=.env tools/analytics-once.ts
import { googleConfigFromEnv } from '../app/src/analytics/google.ts';
import { createDb } from '../app/src/db/client.ts';
import { runAnalyticsJob } from '../app/src/jobs/analytics-job.ts';

const config = googleConfigFromEnv();
if (!config) throw Error('Google read-only access is not configured; see docs/analytics.md');
const { db, close } = createDb();
try {
  console.log(JSON.stringify(await runAnalyticsJob(db, config)));
} finally {
  await close();
}
