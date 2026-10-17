import { type CodexQuota, quotaAllows, readCodexQuota, ruleTargetsFor } from '../ai/quota.ts';
import { generateRules } from '../crawl/rules/generate.ts';
import { refreshGeneratedRules } from '../crawl/rules/state.ts';
import { activateRules, readAttempts, recordAttempt } from '../crawl/rules/store.ts';
import { pickTargets } from '../crawl/rules/targets.ts';
import type { Db } from '../db/client.ts';

// Generated crawl rules (docs/generated-crawl-rules.md), every 30 minutes
// when TAG_AI_RULES_ENABLED=1: the remaining Codex quota decides how many
// outlets this run may handle; each gets up to three model rounds, and rules
// that pass validation on live pages go live at once. Rules and attempts are
// written to files, never to the database.

type Log = (obj: object, msg: string) => void;
const DAY = 86400e3;
/** Runaway guards on top of the quota: per rolling day. */
export const DAILY_TARGETS = 100;
export const DAILY_MODEL_CALLS = 300;

export async function runCrawlRulesJob(
  db: Db,
  {
    log = (() => {}) as Log,
    signal,
    now = () => new Date(),
    readQuota = readCodexQuota,
    generate = generateRules,
    budgetMs = 25 * 60e3,
    dryRun = false,
    only = null as string[] | null,
  }: {
    log?: Log;
    signal?: AbortSignal;
    now?: () => Date;
    readQuota?: () => Promise<CodexQuota | null>;
    generate?: typeof generateRules;
    budgetMs?: number;
    dryRun?: boolean;
    only?: string[] | null;
  } = {},
) {
  const started = now();
  const quota = await readQuota();
  const allowed = only ? (quotaAllows(quota) ? only.length : 0) : ruleTargetsFor(quota);
  const summary = { quota: quota?.remainingPercent ?? null, allowed, picked: 0, activated: [] as string[], failed: [] as string[] };
  if (!allowed) return summary;
  const attempts = await readAttempts(new Date(started.getTime() - 31 * DAY));
  const today = attempts.filter((a) => Date.parse(a.at) >= started.getTime() - DAY && a.status !== 'dry-run');
  let calls = today.reduce((sum, a) => sum + a.modelCalls, 0);
  const room = Math.min(allowed, DAILY_TARGETS - today.length);
  if (room <= 0 || calls >= DAILY_MODEL_CALLS) return { ...summary, allowed: 0 };
  const targets = await pickTargets(db, { now: started, attempts, limit: room, only });
  summary.picked = targets.length;
  for (const target of targets) {
    if (signal?.aborted || now().getTime() - started.getTime() > budgetMs) break;
    const result = await generate(target, {
      signal,
      mayCall: async () => calls < DAILY_MODEL_CALLS && quotaAllows(await readQuota()),
    });
    calls += result.modelCalls;
    let status: 'activated' | 'failed' | 'dry-run' = result.ok ? (dryRun ? 'dry-run' : 'activated') : 'failed';
    if (result.ok && result.rules && !dryRun) {
      try {
        const revision = await activateRules(target.media, {
          trigger: target.trigger,
          rules: result.rules,
          owned: target.owned,
          listingHosts: target.listingHosts,
          model: result.model ?? 'unknown',
          validation: result.report,
        });
        await refreshGeneratedRules(undefined, true);
        log({ media: target.media, trigger: target.trigger, revision, rounds: result.rounds }, 'generated crawl rules activated');
        summary.activated.push(target.media);
      } catch (error) {
        status = 'failed';
        result.reason = `activation: ${(error as Error).message}`;
      }
    }
    if (status === 'failed') {
      summary.failed.push(target.media);
      log({ media: target.media, trigger: target.trigger, rounds: result.rounds, reason: result.reason }, 'generated crawl rules failed');
    }
    await recordAttempt({
      at: now().toISOString(),
      media: target.media,
      trigger: target.trigger,
      status,
      rounds: result.rounds,
      modelCalls: result.modelCalls,
      reason: result.reason,
      quotaPercent: quota?.remainingPercent ?? null,
    });
  }
  return summary;
}
