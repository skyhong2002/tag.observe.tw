import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import pLimit from 'p-limit';
import catalog from '../app/data/news-source-catalog.json' with { type: 'json' };
import { extractArticle } from '../app/src/crawl/article.ts';
import { fetchText } from '../app/src/crawl/fetch.ts';
import { discoverNews } from '../app/src/crawl/news-discovery.ts';
import type { NewsCrawlAudit, NewsSource } from '../app/src/crawl/news-sources.ts';
import { listSource } from '../app/src/crawl/pipeline.ts';
import { sourceByMedia } from '../app/src/crawl/registry.ts';

const { values } = parseArgs({
  options: {
    media: { type: 'string', multiple: true },
    output: { type: 'string', default: 'app/data/news-crawl-audit.json' },
    concurrency: { type: 'string', default: '6' },
    samples: { type: 'string', default: '3' },
    resume: { type: 'boolean', default: false },
    'only-new': { type: 'boolean', default: false },
  },
});
const output = resolve(values.output);
const concurrency = Number(values.concurrency);
const samples = Number(values.samples);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12 || !Number.isInteger(samples) || samples < 1 || samples > 12) {
  throw new Error('concurrency must be 1–12; samples must be 1–12');
}
const sources = catalog.sources as NewsSource[];
const selected = sources.filter(
  (source) => (!values.media || values.media.includes(source.media)) && (!values['only-new'] || !source.existing),
);
if (!selected.length) throw new Error('No matching sources');
const results = new Map<string, NewsCrawlAudit>();
try {
  const previous = JSON.parse(await readFile(output, 'utf8')) as { results: NewsCrawlAudit[] };
  for (const item of previous.results) results.set(item.media, item);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

async function inspect(source: NewsSource): Promise<NewsCrawlAudit> {
  const checkedAt = new Date().toISOString();
  const base = { media: source.media, websiteUrl: source.websiteUrl, checkedAt, articleCount: 0, samples: [] };
  if (!source.websiteUrl)
    return {
      ...base,
      status: 'unresolved',
      strategy: 'none',
      listingUrl: null,
      detail:
        source.media === 'wujie'
          ? '依使用者指示略過「無界」；保留原始來源列，不猜測品牌或網域。'
          : '尚未確認官方網址，保留來源列，不猜測網域。',
    };
  try {
    const configured = sourceByMedia(source.media);
    if (source.existing && !configured?.list.autoDiscover) {
      const spec = configured;
      if (!spec) throw new Error('Catalog references an unknown existing crawler');
      const started = Date.now();
      let attempted = 0;
      let throttled = false;
      const fetch: typeof fetchText = async (url, options = {}) => {
        if (throttled) throw new Error('HTTP 429; source requests stopped');
        const remaining = 55000 - (Date.now() - started);
        if (++attempted > 24 || remaining <= 0) throw new Error('Audit request/time budget reached');
        const result = await fetchText(url, { ...options, timeout: Math.min(8000, remaining), retries: 0, maxBytes: 8 * 1024 * 1024 });
        if (result.status === 429) throttled = true;
        return result;
      };
      const listing = await listSource(spec, fetch);
      const verified: NewsCrawlAudit['samples'] = [];
      const errors = [...listing.errors];
      const oldest = Date.now() - 14 * 86400e3;
      const candidates = listing.items
        .filter((item) => !item.publishedAt || item.publishedAt.getTime() >= oldest)
        .sort(
          (a, b) => (b.publishedAt?.getTime() ?? b.modifiedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? a.modifiedAt?.getTime() ?? 0),
        );
      const rejected: Record<string, number> = {};
      const reject = (reason: string) => {
        rejected[reason] = (rejected[reason] ?? 0) + 1;
      };
      for (const item of candidates.slice(0, samples * 8)) {
        if (verified.length >= samples || throttled) break;
        try {
          const response = await fetch(item.url);
          if (response.status !== 200) {
            errors.push(`HTTP ${response.status}`);
            continue;
          }
          const detail = extractArticle(response.body, response.url || item.url, spec.article);
          if (spec.article.provider && !new RegExp(spec.article.provider, 'i').test(detail.provider ?? '')) continue;
          // Match indexing: an explicit feed publication date wins over page
          // metadata (SETN incorrectly labels Taiwan wall time with UTC Z).
          const published = item.publishedAt ?? detail.publishedAt;
          if (!published || published.getTime() < oldest || published.getTime() > Date.now() + 3600e3) {
            reject('無有效近期發布日期');
            continue;
          }
          if (detail.bodyStatus !== 'ok' || (detail.body?.length ?? 0) < 120) {
            reject(`內文${detail.bodyStatus}`);
            continue;
          }
          if (!(detail.title || item.title)) {
            reject('無標題');
            continue;
          }
          verified.push({
            url: item.url,
            title: detail.title || item.title,
            publishedAt: published.toISOString(),
            bodyLength: detail.body!.length,
          });
        } catch (error) {
          errors.push((error as Error).message);
        }
      }
      return {
        ...base,
        status: verified.length ? 'verified' : 'unavailable',
        strategy: 'existing',
        listingUrl: spec.list.urls[0]?.url ?? source.websiteUrl,
        articleCount: verified.length,
        samples: verified,
        detail: verified.length
          ? `沿用既有爬蟲；本次驗證 ${verified.length} 篇近期文章的標題、日期與內文。`
          : `既有爬蟲列出 ${listing.items.length} 筆，尚未驗證到近期完整文章。${Object.entries(rejected)
              .map(([reason, count]) => `${reason} ${count} 筆`)
              .join('；')}。${errors.slice(-3).join('；')}`.slice(0, 1200),
      };
    }
    const discovery = await discoverNews(
      {
        ...(source.existing
          ? configured?.list.autoDiscover
          : {
              homeUrl: source.websiteUrl,
              feedUrls: source.feedUrls,
              articlePattern: source.articlePattern,
              articleHosts: source.articleHosts,
              feedBody: source.feedBody,
              apiUrls: source.apiUrls,
              includeArchive: source.includeArchive,
              feedOnly: source.feedOnly,
              transport: source.transport,
              requestTimeoutMs: source.requestTimeoutMs,
              provider: source.provider,
              articleUrls: source.articleUrls,
            }),
        homeUrl: configured?.list.autoDiscover?.homeUrl ?? source.websiteUrl,
        maxArticles: samples,
      },
      { timeoutMs: 55000, maxRequests: 24 },
    );
    return {
      ...base,
      status: discovery.samples.length ? 'verified' : 'unavailable',
      strategy: discovery.strategy,
      listingUrl: discovery.listingUrl,
      articleCount: discovery.samples.length,
      samples: discovery.samples,
      detail: discovery.samples.length
        ? `以 ${discovery.strategy} 驗證 ${discovery.samples.length} 篇近期文章的標題、日期與內文。`
        : `本次 ${discovery.attempted} 次請求未驗證到近期完整文章。${discovery.errors.slice(-3).join('；')}`.slice(0, 1200),
    };
  } catch (error) {
    return {
      ...base,
      status: 'unavailable',
      strategy: source.existing ? 'existing' : 'none',
      listingUrl: source.websiteUrl,
      detail: (error as Error).message.slice(0, 1200),
    };
  }
}

let saveQueue = Promise.resolve();
function save() {
  saveQueue = saveQueue.then(async () => {
    const ordered = sources.flatMap((source) => (results.has(source.media) ? [results.get(source.media)!] : []));
    const payload = {
      checkedAt: new Date().toISOString(),
      sourceUrl: catalog.sourceUrl,
      sourceMonth: catalog.sourceMonth,
      results: ordered,
    };
    await writeFile(output + '.tmp', JSON.stringify(payload, null, 2) + '\n');
    await rename(output + '.tmp', output);
  });
  return saveQueue;
}

const gate = pLimit(concurrency);
let complete = 0;
await Promise.all(
  selected.map((source) =>
    gate(async () => {
      const previous = results.get(source.media);
      if (values.resume && previous?.websiteUrl === source.websiteUrl) {
        complete++;
        return;
      }
      const result = await inspect(source);
      results.set(source.media, result);
      console.log(`[${++complete}/${selected.length}] ${source.media}: ${result.status} ${result.articleCount} (${result.strategy})`);
      await save();
    }),
  ),
);
await save();
console.log(
  JSON.stringify({
    sources: sources.length,
    audited: results.size,
    verified: [...results.values()].filter((result) => result.status === 'verified').length,
    output,
  }),
);
