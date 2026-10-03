import { parseArgs } from 'node:util';
import { createDb } from '../app/src/db/client.ts';
import { runSimilarityJob } from '../app/src/jobs/similarity-job.ts';

// Same incremental index run as the worker's similarity job, repeated until
// no usable body is left unindexed. Safe to stop and restart at any point.
const { values } = parseArgs({
  options: {
    batch: { type: 'string', default: '2000' },
    runs: { type: 'string', default: '1000' },
  },
});
const batch = Number(values.batch),
  runs = Number(values.runs);
if (!Number.isInteger(batch) || batch < 1 || batch > 10_000 || !Number.isInteger(runs) || runs < 1)
  throw Error('batch must be 1–10000 and runs a positive integer');
const { db, close } = createDb();
try {
  for (let i = 0; i < runs; i++) {
    const started = Date.now();
    const result = await runSimilarityJob(db, { batch, maxBatches: 1 });
    console.log(JSON.stringify({ run: i + 1, ms: Date.now() - started, ...result }));
    if (result.skipped) throw Error('Another similarity run holds the index lock; try again when it finishes');
    if (result.articles < batch) break;
  }
} finally {
  await close();
}
