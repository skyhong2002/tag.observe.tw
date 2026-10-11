// Runs the writing-signals job by hand: the first backfill after deploying,
// or a re-analysis after VERSION changes (app/src/writing/rules.ts).
//
//   node --env-file=.env tools/writing-once.ts [--people] [--batches 200]
//
// Batches of 2,000 newest-first until nothing is pending; --people then runs
// the daily poster-name pass once.
import { createDb } from '../app/src/db/client.ts';
import { runWritingJob, runWritingPeopleJob } from '../app/src/jobs/writing-job.ts';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const batches = Number(arg('--batches') ?? 200);
const { db, close } = createDb();
try {
  const log = (o: object, m: string) => console.error(m, JSON.stringify(o));
  // One job run caps at maxBatches; repeat runs so progress is logged between them.
  for (let done = 0; done < batches; done += 10) {
    const r = await runWritingJob(db, { log, maxBatches: 10 });
    if (r.skipped) throw Error('another writing job holds the lock');
    if (!r.pending) break;
  }
  if (process.argv.includes('--people')) await runWritingPeopleJob(db, { log });
} finally {
  await close();
}
