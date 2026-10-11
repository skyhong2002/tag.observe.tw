import { risingTags } from '../avatars/run.ts';
import type { Db } from '../db/client.ts';
import { aiConfig } from '../tag-groups/ai.ts';
import { rankedTags } from '../tag-groups/run.ts';
import { processTags } from '../tag-visuals/run.ts';

// Daily pictures for non-person tags (docs/tag-visuals.md): the home page
// cloud's rising tags, then this week's 500 busiest ranking tags, after the tag-groups job has looked their Wikidata
// items up. Tags are checked again after 30 days, so a normal day handles a
// few dozen. Stops between tags after `budgetMs`; the rest wait a day.

type Log = (obj: object, msg: string) => void;

export async function runTagVisualsJob(
  db: Db,
  {
    log = (() => {}) as Log,
    signal,
    limit = 500,
    budgetMs = 8 * 60e3,
    env = process.env,
  }: { log?: Log; signal?: AbortSignal; limit?: number; budgetMs?: number; env?: Record<string, string | undefined> } = {},
) {
  const deadline = Date.now() + budgetMs;
  const stop = () => !!signal?.aborted || Date.now() > deadline;
  const tags = [...new Set([...(await risingTags(db)), ...(await rankedTags(db, { limit }))])];
  const tally = await processTags(db, tags, {
    ai: aiConfig(env),
    stop,
    log: (o) => {
      if ('error' in o) log(o, 'tag visual failed');
    },
  });
  return { tags: tags.length, ...tally, stopped: stop() };
}
