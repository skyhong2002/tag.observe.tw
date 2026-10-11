import pino from 'pino';
import { createDb } from '../app/src/db/client.ts';
import { aiConfig } from '../app/src/tag-groups/ai.ts';
import { rankedTags } from '../app/src/tag-groups/run.ts';
import { processTags } from '../app/src/tag-visuals/run.ts';

// Pictures for non-person tags (docs/tag-visuals.md).
//   node --env-file=.env tools/tag-visuals.ts 台北 國民黨 煙火     # these tags
//   node --env-file=.env tools/tag-visuals.ts --top 500           # this week's ranking tags not checked in 30 days
// --force also re-runs tags an admin confirmed or hid, and recently checked ones.
// Run the tag-groups job (or tools/tag-groups.ts wikidata) first: the Wikidata items come from it.
const log = pino({ level: 'info' });
const args = process.argv.slice(2);
const force = args.includes('--force');
const topAt = args.indexOf('--top');
const { db, close } = createDb();
try {
  const tags =
    topAt >= 0
      ? await rankedTags(db, { limit: Number(args[topAt + 1]) || 500 })
      : args.filter((a, i) => !a.startsWith('--') && i !== topAt + 1);
  const ai = aiConfig();
  if (!ai) log.warn('TAG_AI_BASE_URL / TAG_AI_API_KEY not set: tags needing an icon are left unchecked');
  const tally = await processTags(db, tags, { force, ai, log: (o) => log.info(o, 'tag visual') });
  console.log(JSON.stringify({ tags: tags.length, ...tally }));
} finally {
  await close();
}
