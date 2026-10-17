import { type CodexQuota, quotaAllows, readCodexQuota } from '../ai/quota.ts';
import { risingTags } from '../avatars/run.ts';
import type { Db } from '../db/client.ts';
import { aiConfig } from '../tag-groups/ai.ts';
import { rankedTags } from '../tag-groups/run.ts';
import { processTags } from '../tag-visuals/run.ts';

// Pictures for non-person tags (docs/tag-visuals.md). Hourly (`risingOnly`):
// the home page cloud's rising tags not checked yet, so a new word gets its
// picture within the hour. Daily: those, then this week's 500 busiest ranking tags, after the tag-groups job has looked their Wikidata
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
    risingOnly = false,
    readQuota = readCodexQuota,
  }: {
    log?: Log;
    signal?: AbortSignal;
    limit?: number;
    budgetMs?: number;
    env?: Record<string, string | undefined>;
    risingOnly?: boolean;
    readQuota?: () => Promise<CodexQuota | null>;
  } = {},
) {
  const deadline = Date.now() + budgetMs;
  const stop = () => !!signal?.aborted || Date.now() > deadline;
  const rising = await risingTags(db);
  const tags = risingOnly ? rising : [...new Set([...rising, ...(await rankedTags(db, { limit }))])];
  // AI picks only while the Codex quota is comfortably above its floor; the
  // Wikidata, flag and logo steps run either way.
  const config = aiConfig(env);
  const ai = config && quotaAllows(await readQuota()) ? config : null;
  const tally = await processTags(db, tags, {
    ai,
    stop,
    log: (o) => {
      if ('error' in o) log(o, 'tag visual failed');
    },
  });
  return { tags: tags.length, ...tally, stopped: stop() };
}
