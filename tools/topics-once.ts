// Read-only audit by default. --apply persists verified official topic indexes.
import pLimit from 'p-limit';
import { fetchTopicListings, TOPIC_RULES } from '../app/src/crawl/topics.ts';
import { createDb } from '../app/src/db/client.ts';
import { runTopicsJob } from '../app/src/jobs/topics-job.ts';

const requested = process.argv
  .find((s) => s.startsWith('--media='))
  ?.slice(8)
  .split(',');
const rules = TOPIC_RULES.filter((r) => !requested || requested.includes(r.media));
if (!rules.length || requested?.some((id) => !rules.some((r) => r.media === id))) throw Error('Unknown topic source');
if (process.argv.includes('--apply')) {
  const { db, close } = createDb();
  try {
    const results = await runTopicsJob(db, { rules, refreshPages: false });
    console.log(JSON.stringify(results, null, 2));
    if (Object.values(results).some((r) => r.error)) process.exitCode = 1;
  } finally {
    await close();
  }
} else {
  const limit = pLimit(3);
  const results = await Promise.all(
    rules.map((rule) =>
      limit(async () => {
        const { items, sources } = await fetchTopicListings(rule);
        return { media: rule.media, count: items.length, sources, sample: items.slice(0, 3) };
      }),
    ),
  );
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  if (results.some((r) => r.sources.some((s) => s.error))) process.exitCode = 1;
}
