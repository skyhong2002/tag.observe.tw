import pino from 'pino';
import { busyTags, processTag } from '../app/src/avatars/run.ts';
import { createDb } from '../app/src/db/client.ts';

// Sketch avatars for person tags (docs/tag-avatars.md).
//   node --env-file=.env tools/tag-avatars.ts 賴清德 苗博雅      # these tags
//   node --env-file=.env tools/tag-avatars.ts --top 100          # busiest tags of the week not checked in 30 days
// --force also re-runs tags an admin chose or hid, and recently checked ones.
const log = pino({ level: 'info' });
const args = process.argv.slice(2);
const force = args.includes('--force');
const topAt = args.indexOf('--top');
const { db, close } = createDb();
try {
  const tags = topAt >= 0 ? await busyTags(db, { limit: Number(args[topAt + 1]) || 100, force }) : args.filter((a) => !a.startsWith('--'));
  const tally: Record<string, number> = {};
  for (const tag of tags) {
    try {
      const r = await processTag(db, tag, { force, log: (o, m) => log.debug(o, m) });
      tally[r.status] = (tally[r.status] ?? 0) + 1;
      if (r.status !== 'none') log.info(r, 'tag avatar');
    } catch (err) {
      tally.error = (tally.error ?? 0) + 1;
      log.warn({ tag, err: String(err) }, 'tag avatar failed');
    }
  }
  console.log(JSON.stringify({ tags: tags.length, ...tally }));
} finally {
  await close();
}
