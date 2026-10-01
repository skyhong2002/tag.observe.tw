import pino from 'pino';
import { createDb } from '../app/src/db/client.ts';
import { RANKING_CATEGORIES, runRankingJob } from '../app/src/jobs/ranking-job.ts';

const log = pino({ level: 'info' });
const { db, close } = createDb();
try {
  const only = process.argv.slice(2);
  const result = await runRankingJob({ db, log: (o, m) => log.info(o, m) }, only.length ? only : undefined);
  console.log(JSON.stringify({ ...result, categories: Object.keys(RANKING_CATEGORIES).length }));
} finally {
  await close();
}
