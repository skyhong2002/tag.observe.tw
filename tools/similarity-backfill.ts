import { parseArgs } from 'node:util';
import pLimit from 'p-limit';
import { runArticles } from '../app/src/crawl/pipeline.ts';
import { sourcesInGroup } from '../app/src/crawl/registry.ts';
import { createDb } from '../app/src/db/client.ts';

// Same idempotent pipeline as the worker: fills only unattempted content or
// retries eligible failures within the attempt cap. Does not enable disabled syndication sites.
const { values } = parseArgs({
  options: {
    media: { type: 'string' },
    limit: { type: 'string', default: '20' },
    hours: { type: 'string', default: '2160' },
  },
});
const limit = Number(values.limit),
  hours = Number(values.hours);
if (!Number.isInteger(limit) || limit < 1 || limit > 1000 || !Number.isInteger(hours) || hours < 1 || hours > 2160)
  throw Error('limit must be 1–1000 and hours 1–2160');
const selected = new Set(values.media?.split(',').filter(Boolean) ?? []);
const active = [...sourcesInGroup('news'), ...sourcesInGroup('hourly')];
if ([...selected].some((media) => !active.some((s) => s.media === media))) throw Error('media must be an active source');
const specs = active.filter((s) => !selected.size || selected.has(s.media));
const { db, close } = createDb();
const gate = pLimit(3);
try {
  await Promise.all(
    specs.map((spec) =>
      gate(async () => {
        try {
          console.log(JSON.stringify({ media: spec.media, ...(await runArticles(db, spec, { limit, hours })) }));
        } catch (error) {
          console.error(JSON.stringify({ media: spec.media, error: (error as Error).message }));
          process.exitCode = 1;
        }
      }),
    ),
  );
} finally {
  await close();
}
