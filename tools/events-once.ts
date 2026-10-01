import pino from 'pino';
import { createDb } from '../app/src/db/client.ts';
import { latestEvents, runEventsJob } from '../app/src/jobs/events-job.ts';

const log = pino({ level: 'info' });
const { db, close } = createDb();
try {
  const r = await runEventsJob({ db, log: (o, m) => log.info(o, m) });
  console.log(JSON.stringify(r));
  const latest = await latestEvents(db, 'news', 8);
  for (const e of latest?.events ?? [])
    console.log(
      e.rank,
      e.score / 1e6,
      e.major.join('|'),
      'news=' + e.news.length,
      'majorNews=' + e.majorNews.length,
      'thread=' + e.threadId,
    );
} finally {
  await close();
}
