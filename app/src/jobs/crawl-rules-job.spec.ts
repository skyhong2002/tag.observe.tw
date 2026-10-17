import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CodexQuota } from '../ai/quota.ts';
import type { GenerationResult } from '../crawl/rules/generate.ts';
import { activeRevision, readAttempts, readRuleFile } from '../crawl/rules/store.ts';
import type { RuleTarget } from '../crawl/rules/validate.ts';
import type { Db } from '../db/client.ts';
import { runCrawlRulesJob } from './crawl-rules-job.ts';

const picked: { limit: number }[] = [];
vi.mock('../crawl/rules/targets.ts', () => ({
  pickTargets: async (_db: unknown, { limit }: { limit: number }) => {
    picked.push({ limit });
    return ['alpha', 'beta', 'gamma', 'delta'].slice(0, limit).map(
      (media): RuleTarget => ({
        media,
        trigger: 'body',
        spec: { media, group: 'hourly', list: { urls: [] }, article: { enabled: true, batch: 1, delayMs: 0 } },
        owned: [`${media}.tw`],
        listingHosts: [`${media}.tw`],
        failing: [],
        working: [],
        reason: 'test',
      }),
    );
  },
}));

const quota = (remainingPercent: number): CodexQuota => ({ remainingPercent, accounts: [], checkedAt: '' });
const rules = {
  hostRules: [
    {
      host: 'alpha.tw',
      path: '^/n/\\d+$',
      bodySelector: 'article',
      bodyExcludeSelector: null,
      titleSelector: null,
      titlePattern: null,
      authorSelector: null,
      authorPattern: null,
      publishedSelector: null,
      publishedAttribute: null,
      publicationPattern: null,
      publicationFormat: null,
      tagSelector: null,
      plainTextBody: false,
    },
  ],
  listing: null,
  render: false,
  noArticles: false,
  unfixable: false,
  notes: '',
};
const db = {} as Db;
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tag-rules-job-'));
  process.env.TAG_GENERATED_RULES_DIR = dir;
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('runCrawlRulesJob', () => {
  it('does nothing when the quota is low or unknown', async () => {
    for (const q of [null, quota(19)]) {
      const r = await runCrawlRulesJob(db, { readQuota: async () => q, generate: async () => Promise.reject(Error('no call')) });
      expect(r).toMatchObject({ allowed: 0, picked: 0 });
    }
    expect(picked).toEqual([]);
  });

  it('scales with the quota, activates passing rules and logs every attempt', async () => {
    const results: Record<string, GenerationResult> = {
      alpha: { ok: true, rules, report: null, rounds: 1, modelCalls: 1, model: 'gpt-test', reason: null },
      beta: { ok: false, rules: null, report: null, rounds: 3, modelCalls: 3, model: 'gpt-test', reason: 'body short' },
    };
    const r = await runCrawlRulesJob(db, {
      readQuota: async () => quota(60),
      generate: async (target) => results[target.media],
    });
    expect(picked.at(-1)).toEqual({ limit: 2 });
    expect(r).toMatchObject({ quota: 60, allowed: 2, picked: 2, activated: ['alpha'], failed: ['beta'] });
    expect(activeRevision(await readRuleFile('alpha'))).toMatchObject({ revision: 1, trigger: 'body', owned: ['alpha.tw'] });
    expect((await readAttempts()).map((a) => [a.media, a.status, a.modelCalls])).toEqual([
      ['alpha', 'activated', 1],
      ['beta', 'failed', 3],
    ]);
  });

  it('asks the quota again before every model call', async () => {
    let left = 85;
    const answers: boolean[] = [];
    await runCrawlRulesJob(db, {
      readQuota: async () => quota(left),
      dryRun: true,
      generate: async (_target, deps) => {
        answers.push(Boolean(await deps?.mayCall?.()));
        left = 10;
        return { ok: false, rules: null, report: null, rounds: 0, modelCalls: 0, model: null, reason: 'stopped' };
      },
    });
    expect(picked.at(-1)).toEqual({ limit: 4 });
    expect(answers).toEqual([true, false, false, false]);
  });
});
