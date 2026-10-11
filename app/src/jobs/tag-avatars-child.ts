import pino from 'pino';
import { createDb } from '../db/client.ts';
import { runTagAvatarsJob } from './tag-avatars-run.ts';

// The tag-avatars job in its own process (forked by runTagAvatarsInChild):
// the image models peak near 1 GB, and only an exiting process gives that
// back. SIGTERM finishes the current tag, then exits.
const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const stop = new AbortController();
process.on('SIGTERM', () => stop.abort());
const { db, close } = createDb();
try {
  const result = await runTagAvatarsJob(db, { log: (o, m) => log.info(o, m), signal: stop.signal });
  process.send?.({ result });
} catch (err) {
  process.send?.({ error: String(err) });
  process.exitCode = 1;
} finally {
  await close();
}
