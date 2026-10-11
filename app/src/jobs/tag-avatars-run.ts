import { releaseModels } from '../avatars/models.ts';
import { busyTags, processTag } from '../avatars/run.ts';
import type { Db } from '../db/client.ts';

// Sketch avatars for new person tags (docs/tag-avatars.md): daily, the news
// ranking's tags of the week not checked in 30 days, a few at a time; hourly
// (`risingOnly`), just the home cloud's rising tags not checked yet. The
// worker runs two jobs at once, so this one stops after `budgetMs` (well
// inside the 15-minute job lock) and leaves the rest for the next day.

type Log = (obj: object, msg: string) => void;

export async function runTagAvatarsJob(
  db: Db,
  {
    log = (() => {}) as Log,
    signal,
    limit = 40,
    budgetMs = 8 * 60e3,
    risingOnly = false,
  }: { log?: Log; signal?: AbortSignal; limit?: number; budgetMs?: number; risingOnly?: boolean } = {},
) {
  const deadline = Date.now() + budgetMs;
  const tags = await busyTags(db, { limit, risingOnly });
  const tally: Record<string, number> = {};
  let done = 0;
  try {
    for (const tag of tags) {
      if (signal?.aborted || Date.now() > deadline) break;
      try {
        const r = await processTag(db, tag, { log });
        tally[r.status] = (tally[r.status] ?? 0) + 1;
        if (r.status !== 'none') log(r, 'tag avatar');
      } catch (err) {
        tally.error = (tally.error ?? 0) + 1;
        log({ tag, err: String(err) }, 'tag avatar failed');
      }
      done++;
    }
  } finally {
    await releaseModels();
  }
  return { candidates: tags.length, done, ...tally };
}
