import { setGeneratedSiteRules } from '../news-site-rules.ts';
import type { SourceSpec } from '../sources.ts';
import { applyRules } from './contract.ts';
import { type ActiveRules, loadActiveRules } from './store.ts';

// The API and the worker both crawl (admin refetch runs in the API), so both
// keep the active generated rules in memory and re-read the rule files when
// they change.

let active = new Map<string, ActiveRules>();

export function useGeneratedRules(list: ActiveRules[]) {
  active = new Map(list.map((rules) => [rules.media, rules]));
  setGeneratedSiteRules(list.flatMap((rules) => rules.sites));
}
export const generatedRulesOf = (media: string) => active.get(media) ?? null;

/** The source with its generated listing and rendering. Rules are generated
 * for an unscheduled source only when it is a catalog source without a
 * verified audit, so validated rules also put it on the hourly schedule. */
export function withGeneratedRules(spec: SourceSpec): SourceSpec {
  const rules = active.get(spec.media);
  return rules ? applyRules(spec, rules) : spec;
}

export async function refreshGeneratedRules(warn: (err: unknown) => void = () => {}, force = false) {
  const list = await loadActiveRules((media, err) => warn(Object.assign(err as Error, { media })), force);
  if (list) useGeneratedRules(list);
}
export function keepGeneratedRulesFresh({ everyMs = 60e3, warn = (_err: unknown) => {} } = {}) {
  const tick = () => refreshGeneratedRules(warn).catch(warn);
  const timer = setInterval(tick, everyMs);
  timer.unref();
  return { ready: tick(), stop: () => clearInterval(timer) };
}
