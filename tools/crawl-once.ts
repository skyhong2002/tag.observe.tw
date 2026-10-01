import pino from 'pino';
import { runArticles, runIndex } from '../app/src/crawl/pipeline.ts';
import { sourceByMedia } from '../app/src/crawl/registry.ts';
import { createDb } from '../app/src/db/client.ts';

const [media, stage = 'index', limit = '10'] = process.argv.slice(2);
const spec = sourceByMedia(media ?? '');
if (!spec) {
  console.error('unknown media', media);
  process.exit(2);
}
const log = pino({ level: 'info' });
const { db, close } = createDb();
try {
  console.log(
    JSON.stringify(stage === 'articles' ? await runArticles(db, spec, { log, limit: Number(limit) }) : await runIndex(db, spec, { log })),
  );
} finally {
  await close();
}
