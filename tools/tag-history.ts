import pino from 'pino';
import { createDb } from '../app/src/db/client.ts';
import { recountTag, runTagHistoryJob } from '../app/src/jobs/tag-history-job.ts';

// Keyword first articles and busiest days (jobs/tag-history-job.ts).
//   node --env-file=.env tools/tag-history.ts --minutes 30   # one long run of the hourly job (first backfill)
//   node --env-file=.env tools/tag-history.ts 颱風 美國        # recount these tags now
// The hourly job stops after 60 s; a longer run is the same work with a
// bigger budget, one tag at a time with a 500 ms rest. Watch tag-db's memory
// (docker stats tag-db) during long runs: it sits near its 5 GB cap.
const log = pino({ level: 'info' });
const args = process.argv.slice(2);
const minutesAt = args.indexOf('--minutes');
const minutes = minutesAt >= 0 ? Number(args[minutesAt + 1]) : 1;
if (!(minutes > 0)) throw Error('--minutes needs a positive number');
const tags = args.filter((a, i) => !a.startsWith('--') && !(minutesAt >= 0 && i === minutesAt + 1));
const { db, close } = createDb();
try {
  if (tags.length) for (const tag of tags) log.info({ tag, found: await recountTag(db, tag, new Date()) }, 'recounted');
  else await runTagHistoryJob(db, { budgetMs: minutes * 60e3, log: (o, m) => log.info(o, m) });
} finally {
  await close();
}
