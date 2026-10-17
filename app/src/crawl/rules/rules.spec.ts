import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codexQuotaOf, quotaAllows, ruleTargetsFor } from '../../ai/quota.ts';
import { extractArticle } from '../article.ts';
import type { FetchResult } from '../fetch.ts';
import { newsSiteRules, setGeneratedSiteRules, withTrialSiteRules } from '../news-site-rules.ts';
import { classifyRobots } from '../robots.ts';
import type { SourceSpec } from '../sources.ts';
import { applyRules, compileRules, type RawHostRule, type RawRules } from './contract.ts';
import { generateRules } from './generate.ts';
import { generatedRulesOf, refreshGeneratedRules, withGeneratedRules } from './state.ts';
import { activateRules, activeRevision, readAttempts, readRuleFile, recordAttempt, rejectActiveRules } from './store.ts';
import { articleNumber, ownHosts } from './targets.ts';
import { type RuleTarget, tagProblem, validateRules } from './validate.ts';

const now = new Date('2026-10-17T06:00:00Z');
const hour = (h: number) => new Date(now.getTime() - h * 3600e3);
const text = (n: number) => `市政府今天公布新的交通改善計畫，增加公車班次並公開預算與施工進度。第${n}篇的內容。`.repeat(6);
const article = (n: number, title = `交通改善計畫第${n}波上路`) =>
  `<html><head><title>${title} - 測試新聞網</title><meta property="og:title" content="${title}"></head><body>
  <header><h2 class="site">測試新聞網</h2></header>
  <div class="x7q"><h1 class="headline">${title}</h1><span class="when">2026-10-17 1${n}:00</span>
  <div class="story-zone">${text(n)}<br>${text(n + 1)}</div><div class="kw"><a>交通</a><a>公車</a><a>第${n}波</a></div></div></body></html>`;
const listing = `<html><body><ul>${[1, 2, 3, 4].map((n) => `<li><a href="https://news.example.tw/story/${10000 + n}">交通改善計畫第${n}波上路</a></li>`).join('')}</ul></body></html>`;
const pages: Record<string, string> = {
  'https://news.example.tw/': listing,
  ...Object.fromEntries([1, 2, 3, 4].map((n) => [`https://news.example.tw/story/${10000 + n}`, article(n)])),
};
const fetchFake = async (url: string): Promise<FetchResult> => ({
  url,
  status: pages[url] ? 200 : 404,
  body: pages[url] ?? '',
  contentType: 'text/html',
  ms: 1,
});
const spec: SourceSpec = {
  media: 'example',
  group: 'hourly',
  list: { urls: [{ cat: '', url: 'https://news.example.tw/' }], articleId: 'story/(\\d+)', curl: true },
  article: { enabled: true, batch: 20, delayMs: 0 },
};
const hostRule = (extra: Partial<RawHostRule> = {}): RawHostRule => ({
  host: 'news.example.tw',
  path: '^/story/\\d+$',
  bodySelector: '.story-zone',
  bodyExcludeSelector: null,
  titleSelector: 'h1.headline',
  titlePattern: null,
  authorSelector: null,
  authorPattern: null,
  publishedSelector: '.when',
  publishedAttribute: 'text',
  publicationPattern: null,
  publicationFormat: null,
  tagSelector: null,
  plainTextBody: true,
  ...extra,
});
const raw = (extra: Partial<RawRules> = {}): RawRules => ({
  hostRules: [hostRule()],
  listing: null,
  render: false,
  noArticles: false,
  unfixable: false,
  notes: '',
  ...extra,
});
const target = (extra: Partial<RuleTarget> = {}): RuleTarget => ({
  media: 'example',
  trigger: 'body',
  spec,
  owned: ['example.tw', 'news.example.tw'],
  listingHosts: ['example.tw', 'news.example.tw'],
  examples: [],
  collected: async () => new Map(),
  failing: [1, 2, 3].map((n) => ({ url: `https://news.example.tw/story/${10000 + n}`, publishedAt: hour(n) })),
  working: [],
  reason: 'test',
  ...extra,
});

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tag-rules-'));
  process.env.TAG_GENERATED_RULES_DIR = dir;
});
afterAll(async () => {
  setGeneratedSiteRules([]);
  await rm(dir, { recursive: true, force: true });
});

describe('compileRules', () => {
  it('compiles patterns and keeps hosts to the outlet', () => {
    const compiled = compileRules(raw(), ['example.tw']);
    expect(compiled.sites[0]).toMatchObject({ host: 'news.example.tw', bodySelector: '.story-zone', publishedAttribute: null });
    expect(compiled.sites[0].path.test('/story/12')).toBe(true);
    expect(() => compileRules(raw({ hostRules: [hostRule({ host: 'evil.com' })] }), ['example.tw'])).toThrow(/not the outlet/);
    expect(() => compileRules(raw({ hostRules: [hostRule({ host: 'tw' })] }), ['example.tw'])).toThrow(/not the outlet/);
  });
  it('refuses backtracking patterns, broken selectors and foreign listings', () => {
    expect(() => compileRules(raw({ hostRules: [hostRule({ titlePattern: '^(\\S+)+$' })] }), ['example.tw'])).toThrow(/nested quantifier/);
    expect(() => compileRules(raw({ hostRules: [hostRule({ bodySelector: 'div[' })] }), ['example.tw'])).toThrow();
    expect(() =>
      compileRules(raw({ listing: { urls: ['https://other.tw/'], include: null, discoverPattern: null, discoverTitleSelector: null } }), [
        'example.tw',
      ]),
    ).toThrow(/listing/);
  });
  it('replaces the listing but keeps article identity, schedules an unscheduled source, renders without curl', () => {
    const compiled = compileRules(
      raw({
        listing: {
          urls: ['https://news.example.tw/latest'],
          include: '^/story/',
          discoverPattern: '/story/\\d+',
          discoverTitleSelector: null,
        },
        render: true,
      }),
      ['example.tw'],
    );
    const applied = applyRules({ ...spec, group: 'off' }, compiled);
    expect(applied).toMatchObject({ group: 'hourly', render: true, list: { articleId: 'story/(\\d+)', include: '^/story/' } });
    expect(applied.list.curl).toBeUndefined();
    expect(applied.list.urls).toEqual([{ cat: '', url: 'https://news.example.tw/latest' }]);
  });
});

describe('articleNumber', () => {
  it('finds the article number whatever the URL shape', () => {
    expect(articleNumber('https://my-formosa.com.tw/DOC_230068.htm')).toBe('230068');
    expect(articleNumber('https://my-formosa.com.tw/KM/News.asp?Did=230068')).toBe('230068');
    expect(articleNumber('https://example.tw/2026/10/17/slug')).toBeNull();
    expect(articleNumber('https://example.tw/news/20261017/')).toBeNull();
    expect(articleNumber('https://www.mnews.tw/story/20261017sot1921001')).toBe('1921001');
    expect(articleNumber('https://example.tw/about/')).toBeNull();
  });
});

describe('ownHosts', () => {
  it('leaves out shared platforms and hosts configured for another source', () => {
    const owners = new Map([
      ['chinatimes.com', new Set(['chinatimes', 'want'])],
      ['ltn.com.tw', new Set(['ltn'])],
    ]);
    expect(ownHosts(['chinatimes.com', 'www.youtube.com', 'news.example.tw'], 'want', owners)).toEqual(['news.example.tw']);
    expect(ownHosts(['ltn.com.tw'], 'ltn', owners)).toEqual(['ltn.com.tw']);
    expect(ownHosts(['ltn.com.tw'], 'other', owners)).toEqual([]);
  });
});

describe('generated site rules', () => {
  it('win over a source selector, are labelled, and stay inside their trial', async () => {
    const [site] = compileRules(raw(), ['example.tw']).sites;
    const url = 'https://news.example.tw/story/10001';
    const html = article(1);
    expect(newsSiteRules(url)).toBeUndefined();
    const tried = withTrialSiteRules([site], () => extractArticle(html, url, { bodySelector: '.missing' }));
    expect(tried).toMatchObject({ title: '交通改善計畫第1波上路', bodyStatus: 'ok', bodySource: 'selector:gen' });
    // Outside the trial, a concurrent crawl does not see the candidate.
    const outside = await Promise.all([withTrialSiteRules([site], async () => newsSiteRules(url)), (async () => newsSiteRules(url))()]);
    expect(outside[0]).toBe(site);
    expect(outside[1]).toBeUndefined();
  });
});

describe('validateRules', () => {
  it('passes rules that read the failing articles', async () => {
    const report = await validateRules(target(), compileRules(raw(), ['example.tw']), { fetch: fetchFake, now });
    expect(report.problems).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.samples[0]).toMatchObject({ bodyStatus: 'ok', bodySource: 'selector:gen' });
  });
  it('refuses a title read from a page element shared by every article', async () => {
    const rules = compileRules(raw({ hostRules: [hostRule({ titleSelector: 'h2.site' })] }), ['example.tw']);
    const report = await validateRules(target(), rules, { fetch: fetchFake, now });
    expect(report.passed).toBe(false);
  });
  it('checks a new listing on its own', async () => {
    const rules = compileRules(
      raw({ listing: { urls: ['https://news.example.tw/'], include: null, discoverPattern: '/story/\\d+$', discoverTitleSelector: null } }),
      ['example.tw'],
    );
    const report = await validateRules(target({ trigger: 'listing', failing: [] }), rules, { fetch: fetchFake, now });
    expect(report.listed).toBe(4);
    expect(report.passed).toBe(true);
    // The same listing over articles already collected repairs nothing.
    const again = await validateRules(
      target({ trigger: 'listing', failing: [], collected: async (urls) => new Map(urls.map((u) => [u, 'same' as const])) }),
      rules,
      {
        fetch: fetchFake,
        now,
      },
    );
    expect(again.problems).toContain('listing reaches only articles already collected');
    // The same articles under another URL shape would be stored twice.
    const twice = await validateRules(
      target({ trigger: 'listing', failing: [], collected: async (urls) => new Map([[urls[0], 'shape' as const]]) }),
      rules,
      { fetch: fetchFake, now },
    );
    expect(twice.problems[0]).toMatch(/another URL shape/);
  });
  it('wants article keywords from a tagSelector, not menus or sentences', async () => {
    const rules = compileRules(raw({ hostRules: [hostRule({ tagSelector: '.kw a' })] }), ['example.tw']);
    expect((await validateRules(target({ trigger: 'tags' }), rules, { fetch: fetchFake, now })).passed).toBe(true);
    expect(tagProblem(['政治', '國際'], 'selector', '今天天氣很好')).toMatch(/no tag/);
    expect(
      tagProblem(['這是一整句話而不是標籤這是一整句話而不是標籤'], 'selector', '這是一整句話而不是標籤這是一整句話而不是標籤'),
    ).toMatch(/sentence/);
    expect(tagProblem(['交通'], 'meta', '交通')).toMatch(/found no tags/);
  });
});

describe('generateRules', () => {
  it('feeds validation problems back and stops at passing rules', async () => {
    const replies = [raw({ hostRules: [hostRule({ bodySelector: '.nowhere' })] }), raw()];
    const prompts: string[] = [];
    const result = await generateRules(target(), {
      config: { baseUrl: 'http://gw', apiKey: 'k', model: 'sky-quality' },
      fetch: fetchFake,
      render: false,
      now: () => now,
      chat: async (_config, body) => {
        prompts.push(String((body.messages as { content: string }[])[1].content));
        return { content: JSON.stringify(replies.shift()), model: 'gpt-test', finishReason: 'stop' };
      },
    });
    expect(result).toMatchObject({ ok: true, rounds: 2, modelCalls: 2, model: 'gpt-test' });
    expect(prompts[1]).toContain('lastRound');
    expect(prompts[0]).toContain('story-zone');
  });
  it('leaves a quiet outlet alone when its listing page links only to collected articles', async () => {
    let calls = 0;
    const result = await generateRules(
      target({ trigger: 'listing', failing: [], collected: async (urls) => new Map(urls.map((u) => [u, 'same' as const])) }),
      {
        config: { baseUrl: 'http://gw', apiKey: 'k', model: 'sky-quality' },
        fetch: fetchFake,
        render: false,
        chat: async () => {
          calls++;
          return { content: '{}', model: 'x', finishReason: 'stop' };
        },
      },
    );
    expect(calls).toBe(0);
    expect(result).toMatchObject({ ok: false, modelCalls: 0, reason: 'quiet: all 4 articles its listing page links to are collected' });
  });
  it('stops when the model returns no rules', async () => {
    let calls = 0;
    const result = await generateRules(target(), {
      config: { baseUrl: 'http://gw', apiKey: 'k', model: 'sky-quality' },
      fetch: fetchFake,
      render: false,
      chat: async () => {
        calls++;
        return { content: JSON.stringify(raw({ hostRules: [], noArticles: true, notes: '網站已停刊' })), model: 'x', finishReason: 'stop' };
      },
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({ ok: false, rounds: 1, reason: 'unfixable: 網站已停刊' });
  });
  it('makes no call when the quota says no', async () => {
    let calls = 0;
    const result = await generateRules(target(), {
      config: { baseUrl: 'http://gw', apiKey: 'k', model: 'sky-quality' },
      fetch: fetchFake,
      render: false,
      mayCall: async () => false,
      chat: async () => {
        calls++;
        return { content: '{}', model: 'x', finishReason: 'stop' };
      },
    });
    expect(calls).toBe(0);
    expect(result).toMatchObject({ ok: false, modelCalls: 0 });
  });
});

describe('rule files', () => {
  it('activate, load into crawls, and fall back when an admin turns them off', async () => {
    await activateRules('example', { trigger: 'body', rules: raw(), owned: ['example.tw'], model: 'gpt-test', validation: null });
    await activateRules('example', { trigger: 'body', rules: raw(), owned: ['example.tw'], model: 'gpt-test', validation: null });
    const file = await readRuleFile('example');
    expect(file.revisions.map((r) => [r.revision, r.status])).toEqual([
      [2, 'active'],
      [1, 'superseded'],
    ]);
    await refreshGeneratedRules(undefined, true);
    expect(generatedRulesOf('example')?.revision).toBe(2);
    expect(newsSiteRules('https://news.example.tw/story/1')?.bodySelector).toBe('.story-zone');
    expect(withGeneratedRules({ ...spec, group: 'off' }).group).toBe('hourly');
    expect(await rejectActiveRules('example', 'admin@example.tw')).toBe(true);
    expect(activeRevision(await readRuleFile('example'))).toBeNull();
    await refreshGeneratedRules(undefined, true);
    expect(newsSiteRules('https://news.example.tw/story/1')).toBeUndefined();
  });
  it('logs attempts', async () => {
    await recordAttempt({
      at: now.toISOString(),
      media: 'example',
      trigger: 'body',
      status: 'failed',
      rounds: 3,
      modelCalls: 3,
      reason: 'x',
      quotaPercent: 60,
    });
    expect((await readAttempts(hour(1))).map((a) => a.media)).toEqual(['example']);
  });
});

describe('quota', () => {
  it('reads fresh Codex accounts once each and scales targets', () => {
    const status = {
      gateway: {
        hosts: [
          {
            accounts: {
              fresh: true,
              checkedAt: now.toISOString(),
              list: [
                { provider: 'codex', id: 'a', remainingPercent: 90 },
                { provider: 'codex', id: 'b', remainingPercent: 50 },
                { provider: 'claude', id: 'c', remainingPercent: 0 },
              ],
            },
          },
          { accounts: { fresh: true, checkedAt: now.toISOString(), list: [{ provider: 'codex', id: 'a', remainingPercent: 10 }] } },
        ],
      },
    };
    const quota = codexQuotaOf(status, now.getTime());
    expect(quota?.remainingPercent).toBe(70);
    expect(ruleTargetsFor(quota)).toBe(2);
    expect(ruleTargetsFor(null)).toBe(0);
    expect(quotaAllows({ remainingPercent: 19, accounts: [], checkedAt: '' })).toBe(false);
    expect(codexQuotaOf(status, now.getTime() + 3600e3)).toBeNull();
  });
});

describe('classifyRobots', () => {
  it('follows RFC 9309 for status codes and reads the * group', () => {
    expect(classifyRobots(404, '').status).toBe('missing');
    expect(classifyRobots(403, '').status).toBe('missing');
    expect(classifyRobots(429, '').status).toBe('unreachable');
    expect(classifyRobots(503, '').status).toBe('unreachable');
    expect(classifyRobots(null, '').status).toBe('unreachable');
    expect(classifyRobots(200, '<html>not found</html>').status).toBe('missing');
    expect(classifyRobots(200, 'User-agent: *\nDisallow:\n').status).toBe('allowed');
    expect(classifyRobots(200, 'User-agent: *\nDisallow: /wp-admin/\n')).toEqual({
      status: 'partial',
      googleOnly: false,
      disallow: ['/wp-admin/'],
    });
    expect(classifyRobots(200, 'User-agent: Googlebot\nAllow: /\n\nUser-agent: *\nDisallow: /\n')).toMatchObject({
      status: 'disallowed',
      googleOnly: true,
    });
    expect(classifyRobots(200, 'User-agent: a\nUser-agent: *\nDisallow: /\n').status).toBe('disallowed');
  });
});
