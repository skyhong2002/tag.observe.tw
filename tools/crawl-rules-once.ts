import { parseArgs } from 'node:util';
import { readCodexQuota, ruleTargetsFor } from '../app/src/ai/quota.ts';
import { allSources, disabled } from '../app/src/crawl/registry.ts';
import { closeRenderer } from '../app/src/crawl/render.ts';
import { generateRules } from '../app/src/crawl/rules/generate.ts';
import { activateRules, type RuleTrigger, recordAttempt } from '../app/src/crawl/rules/store.ts';
import { articleSignals, buildTarget, listingSignals, newSourceSignals, pickTargets, usable } from '../app/src/crawl/rules/targets.ts';
import { createDb } from '../app/src/db/client.ts';

// Generated crawl rules by hand (docs/generated-crawl-rules.md).
//   node --env-file=.env tools/crawl-rules-once.ts --quota                  # remaining Codex quota, targets per run
//   node --env-file=.env tools/crawl-rules-once.ts --signals                # which outlets the job would pick now
//   node --env-file=.env tools/crawl-rules-once.ts --media ctv              # generate and validate, print, write nothing
//   node --env-file=.env tools/crawl-rules-once.ts --media ctv --apply      # ... and put passing rules live
//   node --env-file=.env tools/crawl-rules-once.ts --media ctv --trigger body   # when the outlet has no current signal
const { values } = parseArgs({
  options: {
    media: { type: 'string' },
    trigger: { type: 'string' },
    apply: { type: 'boolean', default: false },
    quota: { type: 'boolean', default: false },
    signals: { type: 'boolean', default: false },
  },
});

if (values.quota) {
  const quota = await readCodexQuota();
  console.log(JSON.stringify({ quota, targetsPerRun: ruleTargetsFor(quota) }, null, 2));
  process.exit(0);
}
const { db, close } = createDb();
try {
  const now = new Date();
  if (values.signals) {
    const off = disabled();
    const signals = [...(await listingSignals(db, now)), ...(await articleSignals(db, now)), ...newSourceSignals()].filter(
      (s) => !off.has(s.media),
    );
    for (const s of signals) console.log(`${s.trigger.padEnd(10)} ${s.media.padEnd(18)} ${s.reason}`);
    console.log(`next run would pick: ${(await pickTargets(db, { now, limit: 4 })).map((t) => `${t.media} (${t.trigger})`).join(', ')}`);
  } else if (values.media) {
    const spec = allSources().find((s) => s.media === values.media);
    if (!spec) throw Error(`unknown media ${values.media}`);
    const [picked] = await pickTargets(db, { now, only: [spec.media], limit: 1 });
    const trigger = values.trigger as RuleTrigger | undefined;
    if (!trigger && !picked)
      throw Error(`${spec.media} has no current signal (healthy, disabled or unscheduled); pass --trigger to try anyway`);
    const target = trigger ? await buildTarget(db, spec, { media: spec.media, trigger, reason: '手動指定' }, now) : picked;
    if (!usable(target)) throw Error(`${target.media} has no host of its own for ${target.trigger} rules (shared platforms only)`);
    console.error(`target: ${target.media} (${target.trigger}) — ${target.reason}; hosts ${target.owned.join(', ')}`);
    const result = await generateRules(target, {});
    console.log(JSON.stringify(result, null, 2));
    let status: 'activated' | 'failed' | 'dry-run' = result.ok ? 'dry-run' : 'failed';
    if (result.ok && result.rules && values.apply) {
      const revision = await activateRules(target.media, {
        trigger: target.trigger,
        rules: result.rules,
        owned: target.owned,
        listingHosts: target.listingHosts,
        model: result.model ?? 'unknown',
        validation: result.report,
      });
      status = 'activated';
      console.error(`activated revision ${revision}; the worker and the API pick it up within a minute`);
    }
    await recordAttempt({
      at: new Date().toISOString(),
      media: target.media,
      trigger: target.trigger,
      status,
      rounds: result.rounds,
      modelCalls: result.modelCalls,
      reason: result.reason,
      quotaPercent: (await readCodexQuota())?.remainingPercent ?? null,
    });
  } else throw Error('give --quota, --signals or --media <media>');
} finally {
  await closeRenderer();
  await close();
}
