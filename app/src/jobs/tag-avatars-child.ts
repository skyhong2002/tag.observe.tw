import pino from 'pino';
import { releaseModels } from '../avatars/models.ts';
import { addPhoto } from '../avatars/run.ts';
import { createDb } from '../db/client.ts';
import { runTagAvatarsJob } from './tag-avatars-run.ts';

// The tag-avatars job in its own process (forked by runTagAvatarsInChild):
// the image models peak near 1 GB, and only an exiting process gives that
// back. SIGTERM finishes the current tag, then exits. Argument `rising`: the
// hourly run over the home cloud's rising tags, with a shorter budget.
// Argument `photo`: one admin-uploaded photo, sent as the first message.
const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const stop = new AbortController();
process.on('SIGTERM', () => stop.abort());
const { db, close } = createDb();
try {
  const mode = process.argv[2];
  if (mode === 'photo') {
    type Photo = { tag: string; image: string; email: string; userId?: number };
    const photo = await new Promise<Photo>((resolve) => process.once('message', (m) => resolve(m as Photo)));
    const result = await addPhoto(db, photo.tag, Buffer.from(photo.image, 'base64'), photo.email, photo.userId);
    await releaseModels();
    process.send?.({ result });
  } else {
    const result = await runTagAvatarsJob(db, {
      log: (o, m) => log.info(o, m),
      signal: stop.signal,
      ...(mode === 'rising' ? { risingOnly: true, limit: 20, budgetMs: 5 * 60e3 } : {}),
    });
    process.send?.({ result });
  }
} catch (err) {
  process.send?.({ error: String(err) });
  process.exitCode = 1;
} finally {
  await close();
}
