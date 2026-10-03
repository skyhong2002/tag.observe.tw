// Read-only inventory of the entire media directory, not just configured topic rules.
// Candidates require editorial review before adding a crawler: a /topic path may
// be a taxonomy, forum or article. No new source is automatically enabled here.
import { writeFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import names from '../app/data/media-names.json' with { type: 'json' };
import { fetchText } from '../app/src/crawl/fetch.ts';
import { allSources } from '../app/src/crawl/registry.ts';
import { stripTracking } from '../app/src/crawl/text.ts';
import { registrable } from '../app/src/crawl/topic-page.ts';
import { TOPIC_RULES, topicListings } from '../app/src/crawl/topics.ts';
import { listedMediaSources } from '../app/src/v1/media-stats.ts';

const metadata = names.media as Record<string, { name: string | null; sourceUrl: string | null }>;
const requested = process.argv
  .find((arg) => arg.startsWith('--media='))
  ?.slice(8)
  .split(',');
const directory = listedMediaSources(allSources()).filter((m) => !requested || requested.includes(m.media));
if (requested?.some((id) => !directory.some((m) => m.media === id))) throw Error('Unknown directory media');
const limit = pLimit(5);
const results = await Promise.all(
  directory.map(({ media }) =>
    limit(async () => {
      const entry = metadata[media];
      const rule = TOPIC_RULES.find((r) => r.media === (media === 'reporter' ? 'twreporter' : media));
      const base = {
        media,
        name: entry?.name ?? media,
        url: entry?.sourceUrl ?? null,
        configuredIndexes: rule ? topicListings(rule).map((r) => r.url) : [],
        checkedAt: new Date().toISOString(),
      };
      // crawl-disabled.json documents this domain's unrelated replacement content.
      if (media === 'overdope')
        return { ...base, status: 'excluded', reason: 'Official domain replaced by unrelated content', candidates: [] };
      if (!base.url) return { ...base, status: 'unconfirmed', reason: 'No reviewed official URL', candidates: [] };
      try {
        const response = await fetchText(base.url, { timeout: 10000, retries: 0 });
        if (response.status < 200 || response.status >= 400) throw Error(`HTTP ${response.status}`);
        if (registrable(new URL(response.url).hostname) !== registrable(new URL(base.url).hostname))
          throw Error(`Homepage moved to another domain: ${response.url}`);
        const $ = cheerio.load(response.body);
        const candidates = new Map<string, string>();
        $('a[href]').each((_, el) => {
          const a = $(el),
            href = a.attr('href') ?? '';
          const title = (a.attr('title') || a.text() || a.find('img').attr('alt') || '').replace(/\s+/g, ' ').trim();
          if (
            !/special|feature|topic|project|\/series\//i.test(href) &&
            !(title.length <= 24 && /專題|专题|議題|议题|專輯|特別企劃/.test(title))
          )
            return;
          try {
            const url = new URL(href, response.url);
            if (!/^https?:$/.test(url.protocol) || registrable(url.hostname) !== registrable(new URL(response.url).hostname)) return;
            if (/\.(css|js|png|jpg|svg)(\?|$)/i.test(url.pathname)) return;
            candidates.set(stripTracking(url.href), title.slice(0, 120));
          } catch {
            /* Ignore non-URL navigation. */
          }
        });
        return {
          ...base,
          status: rule ? 'configured' : candidates.size ? 'needs-review' : 'unconfirmed',
          httpStatus: response.status,
          finalUrl: response.url,
          candidates: [...candidates].map(([url, title]) => ({ url, title })),
        };
      } catch (error) {
        return { ...base, status: 'unavailable', reason: (error as Error).message, candidates: [] };
      }
    }),
  ),
);
const output =
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      scope: 'Media directory homepages; candidates are not proof of a topic index; unconfirmed does not mean no topics exist.',
      results,
    },
    null,
    2,
  ) + '\n';
const path = process.argv.find((arg) => arg.startsWith('--out='))?.slice(6);
if (path) await writeFile(path, output);
else process.stdout.write(output);
console.error(
  JSON.stringify({
    media: results.length,
    statuses: results.reduce<Record<string, number>>((counts, r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      return counts;
    }, {}),
  }),
);
