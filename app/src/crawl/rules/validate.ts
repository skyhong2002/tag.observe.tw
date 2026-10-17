import * as cheerio from 'cheerio';
import { extractArticle } from '../article.ts';
import type { FeedItem } from '../feed.ts';
import { type FetchResult, fetchText } from '../fetch.ts';
import { withTrialSiteRules } from '../news-site-rules.ts';
import { listSource } from '../pipeline.ts';
import { renderingFetch } from '../render.ts';
import type { SourceSpec } from '../sources.ts';
import { applyRules, type CompiledRules, type RawRules } from './contract.ts';
import type { RuleTrigger } from './store.ts';

// Rules go live only after they work on the outlet's current pages
// (docs/generated-crawl-rules.md). The candidate rules apply only inside this
// validation's async context (withTrialSiteRules), never to a parallel crawl.

export type ArticleRef = { url: string; publishedAt: Date | null };
export type RuleTarget = {
  media: string;
  trigger: RuleTrigger;
  /** The source as configured by hand, without any generated rules. */
  spec: SourceSpec;
  /** Hosts the outlet alone uses (configured URLs, recent article hosts): host rules may name only these. */
  owned: string[];
  /** Hosts a new listing may use: the owned ones plus hosts shared with a sister outlet. */
  listingHosts: string[];
  /** Recent articles whose body or tags the current rules miss (body/tags triggers). */
  failing: ArticleRef[];
  /** Recent articles the current rules read fine: new rules must not break them. */
  working: ArticleRef[];
  /** Why the target was picked, in words, for the model and the log. */
  reason: string;
  previous?: { rules: RawRules; reason: string };
};
export type SampleReport = {
  url: string;
  title: string | null;
  publishedAt: string | null;
  bodyStatus: string;
  bodyLength: number;
  bodySource: string;
  tags: number;
  keywordSource: string;
  problem: string | null;
};
export type ValidationReport = {
  listed: number | null;
  samples: SampleReport[];
  regressions: SampleReport[];
  problems: string[];
  passed: boolean;
};

const DAY = 86400e3;
const SAMPLES = 3;
const REQUESTS = 30;
const bodyLength = (body: string | null) => (body ?? '').replace(/\s+/g, '').length;
const listingTrigger = (trigger: RuleTrigger) => trigger === 'listing' || trigger === 'new-source';

/** A fetch with a request budget and a short pause between requests, so validation stays gentle on the outlet. */
export function budgetFetch(base: typeof fetchText = fetchText, max = REQUESTS, pauseMs = 400): typeof fetchText & { used: () => number } {
  let used = 0;
  const run = async (url: string, options: Parameters<typeof fetchText>[1] = {}): Promise<FetchResult> => {
    if (++used > max) throw Error('validation request budget reached');
    if (used > 1 && pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
    return base(url, { timeout: 15000, retries: 0, ...options });
  };
  return Object.assign(run, { used: () => used });
}

/** Tags read by a generated tagSelector must look like an article's own keywords. */
export function tagProblem(tags: string[], source: string, text: string): string | null {
  if (!tags.length || source !== 'selector') return 'tagSelector found no tags';
  if (tags.length > 15) return `tagSelector found ${tags.length} tags (more than 15)`;
  if (tags.some((tag) => tag.length > 20)) return 'tagSelector found sentence-length tags';
  const plain = text.replace(/\s+/g, '');
  if (!tags.some((tag) => plain.includes(tag.replace(/\s+/g, '')))) return 'no tag appears in the headline or body';
  return null;
}

function pageTitles(html: string) {
  const $ = cheerio.load(html);
  return [$('title').first().text(), $('meta[property="og:title"]').attr('content') ?? '', $('h1').text()].join(' ').replace(/\s+/g, '');
}

export async function validateRules(
  target: RuleTarget,
  rules: CompiledRules,
  { fetch = fetchText, now = new Date() }: { fetch?: typeof fetchText; now?: Date } = {},
): Promise<ValidationReport> {
  const spec = applyRules(target.spec, rules);
  const get = rules.render ? renderingFetch(fetch) : fetch;
  const report: ValidationReport = { listed: null, samples: [], regressions: [], problems: [], passed: false };
  await withTrialSiteRules(rules.sites, async () => {
    const sample = async (ref: ArticleRef, known: boolean, regression = false): Promise<SampleReport> => {
      const out: SampleReport = {
        url: ref.url,
        title: null,
        publishedAt: null,
        bodyStatus: 'error',
        bodyLength: 0,
        bodySource: '',
        tags: 0,
        keywordSource: 'none',
        problem: null,
      };
      try {
        const res = await get(ref.url, { userAgent: spec.article.userAgent });
        if (res.status !== 200) return { ...out, problem: `HTTP ${res.status}` };
        const detail = extractArticle(res.body, res.url || ref.url, spec.article);
        const published = known ? ref.publishedAt : (ref.publishedAt ?? detail.publishedAt);
        Object.assign(out, {
          title: detail.title,
          publishedAt: published?.toISOString() ?? null,
          bodyStatus: detail.bodyStatus,
          bodyLength: bodyLength(detail.body),
          bodySource: detail.bodySource,
          tags: detail.tags.length,
          keywordSource: detail.keywordSource,
        });
        const title = (detail.title ?? '').replace(/\s+/g, '');
        if (title.length < 4) out.problem = 'no title';
        else if (!pageTitles(res.body).includes(title.slice(0, 12))) out.problem = 'title not found in the page title, og:title or h1';
        else if (!published || published.getTime() > now.getTime() + 3600e3 || (!known && published.getTime() < now.getTime() - 14 * DAY))
          out.problem = 'no recent publication date';
        else if (detail.publishedAt && detail.publishedAt.getTime() > now.getTime() + 3600e3) out.problem = 'page date in the future';
        else if (detail.bodyStatus !== 'ok' || out.bodyLength < 200) out.problem = `body ${detail.bodyStatus} (${out.bodyLength} chars)`;
        else if (!regression && target.trigger === 'tags')
          out.problem = tagProblem(detail.tags, detail.keywordSource, `${detail.title} ${detail.body}`);
        if (!out.problem) tagSets.push(detail.tags.join('|'));
      } catch (error) {
        out.problem = (error as Error).message.slice(0, 200);
      }
      return out;
    };

    const tagSets: string[] = [];
    let refs: ArticleRef[] = [];
    if (listingTrigger(target.trigger) || rules.list) {
      const listing = await listSource(spec, get);
      const recent = listing.items
        .filter((item: FeedItem) => !item.publishedAt || item.publishedAt.getTime() >= now.getTime() - 14 * DAY)
        .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
      report.listed = recent.length;
      if (recent.length < SAMPLES)
        report.problems.push(`listing found ${recent.length} recent articles (${listing.errors.slice(0, 3).join('; ') || 'no errors'})`);
      refs = recent.map((item) => ({ url: item.url, publishedAt: item.publishedAt ?? null }));
    }
    const fromDb = !refs.length;
    if (fromDb) refs = target.failing;
    if (!refs.length && !report.problems.length) report.problems.push('no article to test the rules on');

    for (const ref of refs.slice(0, SAMPLES * 2)) {
      if (report.samples.filter((s) => !s.problem).length >= SAMPLES) break;
      report.samples.push(await sample(ref, fromDb));
    }
    const good = report.samples.filter((s) => !s.problem);
    const needed = fromDb ? Math.min(2, refs.length) : SAMPLES;
    if (refs.length && good.length < needed)
      report.problems.push(
        `${good.length} of ${report.samples.length} sampled articles passed: ${report.samples.find((s) => s.problem)?.problem}`,
      );
    // Titles that repeat across articles come from a page element, not the headline.
    if (new Set(good.map((s) => s.title)).size < good.length) report.problems.push('sampled articles share one title');
    // The same tags on every article are a menu or a section list, not the article's keywords.
    if (target.trigger === 'tags' && good.length > 1 && new Set(tagSets.slice(0, good.length)).size === 1)
      report.problems.push('sampled articles share one tag list');

    for (const ref of target.working.slice(0, 2)) {
      const result = await sample(ref, true, true);
      report.regressions.push(result);
      if (result.problem) report.problems.push(`breaks an article the current rules read: ${result.problem}`);
    }
  });
  report.passed = report.problems.length === 0;
  return report;
}
