import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import pLimit from 'p-limit';
import { extractArticle } from '../app/src/crawl/article.ts';
import { type FetchResult, fetchText, fetchViaCurl } from '../app/src/crawl/fetch.ts';
import { listSource } from '../app/src/crawl/pipeline.ts';
import { disabled, sourceByMedia } from '../app/src/crawl/registry.ts';
import type { SourceSpec } from '../app/src/crawl/sources.ts';
import { trafficBaseline } from '../app/src/crawl/traffic-coverage.ts';

// Reads public listings and articles only. Importing listSource does not create
// a database connection; none of the database-writing pipeline is invoked.
const { values } = parseArgs({
  options: {
    media: { type: 'string', multiple: true },
    limit: { type: 'string', default: '2' },
    output: { type: 'string' },
    concurrency: { type: 'string', default: '4' },
    timeout: { type: 'string', default: '10000' },
    help: { type: 'boolean', short: 'h' },
  },
});
if (values.help) {
  console.log(
    'node tools/similarity-audit.ts [--media udn,ltn] [--limit 2] [--output artifacts/similarity/audit.json] [--concurrency 4] [--timeout 10000]',
  );
  process.exit(0);
}
function positive(value: string, flag: string, max: number) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) throw Error(`${flag} must be an integer from 1 to ${max}`);
  return number;
}
const limit = positive(values.limit, '--limit', 20);
const concurrency = positive(values.concurrency, '--concurrency', 8);
const timeout = positive(values.timeout, '--timeout', 60000);
const selected = new Set(
  (values.media ?? [])
    .flatMap((media) => media.split(','))
    .map((media) => media.trim())
    .filter(Boolean),
);
const unknown = [...selected].filter((media) => !trafficBaseline.sources.some((source) => source.media === media));
if (unknown.length) throw Error(`Media outside traffic reference: ${unknown.join(', ')}`);
const references = trafficBaseline.sources.filter((source) => !selected.size || selected.has(source.media));
const generatedAt = new Date().toISOString();
const output = resolve(values.output ?? `artifacts/similarity/audit-${generatedAt.replace(/[:.]/g, '-')}.json`);
const gate = pLimit(concurrency);
const off = disabled();

interface RequestEvidence {
  url: string;
  finalUrl: string | null;
  status: number | null;
  ms: number;
  responseChars: number;
  contentType: string | null;
  error: string | null;
}
interface ArticleEvidence extends RequestEvidence {
  bodyChars: number;
  bodySource: string;
  bodyStatus: string;
  authors: string[];
  authorCount: number;
  titleChars: number;
  descriptionChars: number;
  tagCount: number;
  publishedAt: string | null;
}
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);
function requestEvidence(url: string, result: FetchResult): RequestEvidence {
  return {
    url,
    finalUrl: result.url,
    status: result.status,
    ms: result.ms,
    responseChars: result.body.length,
    contentType: result.contentType,
    error: result.status >= 400 ? `HTTP ${result.status}` : null,
  };
}

const reports = await Promise.all(
  references.map((reference) =>
    gate(async () => {
      const registered = sourceByMedia(reference.media);
      // 蕃新聞 remains outside the registry and outside statistics. A bounded
      // public sample audits its extraction without enabling its scheduler.
      const exploratory: SourceSpec | undefined =
        !registered && reference.media === 'yam'
          ? {
              media: 'yam',
              group: 'off',
              list: { urls: [{ cat: 'audit-only', url: 'https://n.yam.com/' }], discover: { pattern: '^/Article/' } },
              article: { enabled: false, batch: 1, delayMs: 0, bodySelector: '.inner-content', authorSelector: '.reporter' },
            }
          : undefined;
      const spec = registered ?? exploratory;
      const listingRequests: RequestEvidence[] = [];
      const articles: ArticleEvidence[] = [];
      const base = {
        ...reference,
        registryStatus: !registered ? 'missing' : off.has(reference.media) ? 'disabled' : registered.group === 'off' ? 'off' : 'active',
        excludedFromStatistics: reference.classification === '內容',
        auditOnlyDiscovery: !!exploratory,
        articleAlwaysFetched: registered?.article.enabled ?? false,
        listingRequests,
        articles,
      };
      if (!spec) return { ...base, outcome: 'missing-source', listingItems: 0, listingErrors: [], bodySuccesses: 0, authorSuccesses: 0 };
      const trackedFetch = async (url: string, options: { userAgent?: string } = {}) => {
        const started = performance.now();
        try {
          const result = spec.list.curl
            ? await fetchViaCurl(url, { ...options, timeout })
            : await fetchText(url, { ...options, timeout, retries: 0 });
          listingRequests.push(requestEvidence(url, result));
          return result;
        } catch (error) {
          listingRequests.push({
            url,
            finalUrl: null,
            status: null,
            ms: Math.round(performance.now() - started),
            responseChars: 0,
            contentType: null,
            error: errorMessage(error),
          });
          throw error;
        }
      };
      // Route curl through the same timeout/evidence wrapper. The production
      // parser's limits, filters, sitemap traversal and deduplication still run.
      const listing = await listSource({ ...spec, list: { ...spec.list, curl: false } }, trackedFetch);
      const samples = [...listing.items]
        .sort(
          (a, b) => (b.publishedAt?.getTime() ?? b.modifiedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? a.modifiedAt?.getTime() ?? 0),
        )
        .slice(0, limit);
      for (const item of samples) {
        const started = performance.now();
        try {
          const result = await fetchText(item.url, { userAgent: spec.article.userAgent, timeout, retries: 0 });
          const request = requestEvidence(item.url, result);
          if (result.status >= 400) {
            articles.push({
              ...request,
              bodyChars: 0,
              bodySource: 'none',
              bodyStatus: 'http-error',
              authors: [],
              authorCount: 0,
              titleChars: 0,
              descriptionChars: 0,
              tagCount: 0,
              publishedAt: item.publishedAt?.toISOString() ?? null,
            });
            if (result.status === 429) break;
            continue;
          }
          // Transitional optional fields report an honest unsupported status
          // when this tool is run against a pre-body-extraction checkout.
          const detail = extractArticle(result.body, result.url, spec.article) as ReturnType<typeof extractArticle> & {
            body?: string | null;
            bodySource?: string;
            bodyStatus?: string;
            authors?: string[];
          };
          const authors = detail.authors ?? [];
          articles.push({
            ...request,
            bodyChars: detail.body?.length ?? 0,
            bodySource: detail.bodySource ?? 'none',
            bodyStatus: detail.bodyStatus ?? 'extraction-unavailable',
            authors,
            authorCount: authors.length,
            titleChars: detail.title?.length ?? 0,
            descriptionChars: detail.description?.length ?? 0,
            tagCount: detail.tags.length,
            publishedAt: (detail.publishedAt ?? item.publishedAt)?.toISOString() ?? null,
          });
        } catch (error) {
          articles.push({
            url: item.url,
            finalUrl: null,
            status: null,
            ms: Math.round(performance.now() - started),
            responseChars: 0,
            contentType: null,
            error: errorMessage(error),
            bodyChars: 0,
            bodySource: 'none',
            bodyStatus: 'fetch-error',
            authors: [],
            authorCount: 0,
            titleChars: 0,
            descriptionChars: 0,
            tagCount: 0,
            publishedAt: item.publishedAt?.toISOString() ?? null,
          });
        }
      }
      const bodySuccesses = articles.filter((article) => article.bodyChars > 0 && article.bodyStatus === 'ok').length;
      const authorSuccesses = articles.filter((article) => article.authorCount > 0).length;
      const outcome = !listing.items.length
        ? 'listing-empty'
        : bodySuccesses === articles.length
          ? 'body-ok'
          : bodySuccesses
            ? 'body-partial'
            : 'body-missing';
      console.error(
        `${reference.media}: ${listing.items.length} listed; ${bodySuccesses}/${articles.length} bodies, ${authorSuccesses}/${articles.length} author metadata; ${listing.errors.length} listing errors`,
      );
      return { ...base, outcome, listingItems: listing.items.length, listingErrors: listing.errors, bodySuccesses, authorSuccesses };
    }),
  ),
);
const report = {
  generatedAt,
  completedAt: new Date().toISOString(),
  readOnly: true,
  sourceUrl: trafficBaseline.sourceUrl,
  referenceRetrievedAt: trafficBaseline.retrievedAt,
  settings: { media: [...selected], limit, concurrency, timeout, retries: 0, maxListingRequestsPerMedia: 12 },
  limitations: [
    'Public-page sample only; does not verify database persistence or worker freshness.',
    'Successful extraction is not proof of complete text on paywalled or dynamically rendered pages.',
    'Missing/disabled reference outlets remain in this report; classification 內容 is excluded from similarity statistics.',
    'Report stores URLs, attribution, dates and counts; it does not retain article text or HTML.',
  ],
  summary: {
    referenceOutlets: trafficBaseline.sources.length,
    auditedOutlets: reports.length,
    activeOutlets: reports.filter((media) => media.registryStatus === 'active').length,
    excludedOutlets: reports.filter((media) => media.excludedFromStatistics).length,
    listingSuccesses: reports.filter((media) => media.listingItems > 0).length,
    outletsWithBody: reports.filter((media) => media.bodySuccesses > 0).length,
    outletsWithAuthors: reports.filter((media) => media.authorSuccesses > 0).length,
    articlesSampled: reports.reduce((sum, media) => sum + media.articles.length, 0),
    bodySuccesses: reports.reduce((sum, media) => sum + media.bodySuccesses, 0),
  },
  sources: reports,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, ...report.summary }, null, 2));
