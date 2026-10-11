import pino from 'pino';
import { createDb } from '../db/client.ts';
import { runTagAvatarsJob } from './tag-avatars-run.ts';

// The tag-avatars job in its own process (forked by runTagAvatarsInChild):
// the image models peak near 1 GB, and only an exiting process gives that
// back. SIGTERM finishes the current tag, then exits. Argument `rising`: the
// hourly run over the home cloud's rising tags, with a shorter budget.
const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const stop = new AbortController();
process.on('SIGTERM', () => stop.abort());
const { db, close } = createDb();
try {
  const rising = process.argv[2] === 'rising';
  const result = await runTagAvatarsJob(db, {
    log: (o, m) => log.info(o, m),
    signal: stop.signal,
    ...(rising ? { risingOnly: true, limit: 20, budgetMs: 5 * 60e3 } : {}),
  });
  process.send?.({ result });
} catch (err) {
  process.send?.({ error: String(err) });
  process.exitCode = 1;
} finally {
  await close();
}
