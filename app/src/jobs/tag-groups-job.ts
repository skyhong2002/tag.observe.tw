import { type CodexQuota, quotaAllows, readCodexQuota } from '../ai/quota.ts';
import type { Db } from '../db/client.ts';
import { aiConfig, fileAi } from '../tag-groups/ai.ts';
import { filePeople, fileSections, fileWikidata, rankedTags, seedGroupDefs } from '../tag-groups/run.ts';

// Daily tag grouping (docs/tag-groups.md): this week's 500 busiest ranking
// tags through the person, section, Wikidata and AI rules. Wikidata and the
// AI are asked only about tags not asked in 30 days, so a normal day costs a
// few dozen lookups. The worker runs two jobs at once under a 15-minute
// lock, so the job stops between tags after `budgetMs`; whatever is left
// waits for the next day.

type Log = (obj: object, msg: string) => void;

export async function runTagGroupsJob(
  db: Db,
  {
    log = (() => {}) as Log,
    signal,
    limit = 500,
    budgetMs = 10 * 60e3,
    env = process.env,
    readQuota = readCodexQuota,
  }: {
    log?: Log;
    signal?: AbortSignal;
    limit?: number;
    budgetMs?: number;
    env?: Record<string, string | undefined>;
    readQuota?: () => Promise<CodexQuota | null>;
  } = {},
) {
  const deadline = Date.now() + budgetMs;
  const stop = () => !!signal?.aborted || Date.now() > deadline;
  const warn = (o: object) => {
    if ('error' in o) log(o, 'tag groups lookup failed');
  };
  await seedGroupDefs(db);
  const tags = await rankedTags(db, { limit });
  const result: Record<string, unknown> = { tags: tags.length };
  result.person = await filePeople(db);
  if (!stop()) result.section = await fileSections(db, tags, { stop });
  if (!stop()) result.wikidata = await fileWikidata(db, tags, { stop, log: warn });
  const ai = aiConfig(env);
  // The AI step only runs while the Codex quota is comfortably above its floor.
  const quota = ai && !stop() ? await readQuota() : null;
  if (!ai) result.ai = 'skipped: no TAG_AI_API_KEY';
  else if (!stop() && !quotaAllows(quota)) result.ai = `skipped: Codex quota ${quota ? `${quota.remainingPercent}%` : 'unknown'}`;
  else if (!stop()) result.ai = await fileAi(db, tags, ai, { stop, log: warn });
  result.stopped = stop();
  return result;
}
