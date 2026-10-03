import { and, eq, sql } from 'drizzle-orm';
import catalog from '../../data/news-source-catalog.json' with { type: 'json' };
import type { Db } from '../db/client.ts';
import { articleDiscoveries, articles, crawlRuns } from '../db/schema.ts';
import { discoverDongtaiwang } from './discovery-dongtaiwang.ts';
import { discoverGoogleNews, resolveGoogleNewsInBrowser } from './discovery-google-news.ts';
import { fetchText } from './fetch.ts';
import { discoverNews } from './news-discovery.ts';
import { type Logger, runIndex } from './pipeline.ts';
import { allSources, disabled } from './registry.ts';
import type { SourceSpec } from './sources.ts';
import { urlKey } from './text.ts';

const host = (raw: string) => {
  try {
    const u = new URL(raw);
    return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.hostname.replace(/^www\./, '').toLowerCase() : null;
  } catch {
    return null;
  }
};

/** Match reviewed publisher websites only, never ads, feed hosts or guessed brands. */
export function discoveryPublisher(
  url: string,
  sources = allSources(),
  excluded = disabled(),
  websites: Array<{ media: string; websiteUrl: string | null }> = catalog.sources,
): SourceSpec | null {
  const candidate = host(url);
  if (!candidate) return null;
  const matches = websites.filter((s) => s.websiteUrl && host(s.websiteUrl) === candidate);
  const eligible = sources.filter(
    (s) => !s.discovery && s.group !== 'off' && !excluded.has(s.media) && matches.some((m) => m.media === s.media),
  );
  return eligible.length === 1 ? eligible[0] : null;
}

export async function runDiscoveryIndex(
  db: Db,
  spec: SourceSpec,
  { fetch = fetchText, log, now = () => new Date() }: { fetch?: typeof fetchText; log: Logger; now?: () => Date },
): Promise<{ items: number; inserted: number; errors: string[] }> {
  const started = now();
  const [run] = await db
    .insert(crawlRuns)
    .values({ media: spec.media, stage: 'index', startedAt: started, status: 'running' })
    .$returningId();
  let stored = 0;
  let inserted = 0;
  const errors: string[] = [];
  try {
    const discovered =
      spec.discovery === 'google_news'
        ? await discoverGoogleNews({ maxItems: 4, maxRequests: 9 }, { fetch, resolveInBrowser: resolveGoogleNewsInBrowser })
        : await discoverDongtaiwang({ fetch, maxArticles: 40 });
    errors.push(...discovered.errors);
    const cooling = new Set<string>();
    const deadline = Date.now() + 90000;
    for (const candidate of discovered.items) {
      if (stored >= 5 || Date.now() > deadline) break;
      const publisher = discoveryPublisher(candidate.url);
      if (!publisher) {
        errors.push(`${candidate.url}: no unambiguous enabled publisher`);
        continue;
      }
      if (cooling.has(publisher.media)) continue;
      // The aggregator date/title are hints only. Validate date, full body,
      // canonical host and provider on the original publisher page.
      const original = publisher.list.autoDiscover;
      const result = await discoverNews(
        {
          ...original,
          homeUrl: new URL(candidate.url).origin,
          articleUrls: [candidate.url],
          includeArchive: true,
          maxArticles: 1,
          provider: original?.provider ?? publisher.article.provider,
        },
        { fetch, now, maxRequests: 2, timeoutMs: Math.min(20000, Math.max(1, deadline - Date.now())) },
      );
      errors.push(...result.errors);
      if (result.errors.some((e) => /HTTP 429/.test(e))) cooling.add(publisher.media);
      const item = result.items[0];
      if (!item?.publishedAt || !item.verifiedContent || candidate.discoveryUrl.length > 16000) continue;
      // Provider was checked above. Reuse the validated body without fetching
      // twice; normal insert/repair/retention and URL deduplication still apply.
      const saved = await runIndex(
        db,
        {
          ...publisher,
          article: { ...publisher.article, provider: undefined },
        },
        { fetch, log, now, listed: { items: [item], errors: [] } },
      );
      inserted += saved.inserted;
      const [row] = await db
        .select({ id: articles.id, publishedAt: articles.publishedAt, body: articles.body })
        .from(articles)
        .where(
          and(
            eq(articles.media, publisher.media),
            eq(articles.urlKey, urlKey(item.url, publisher.list.articleId)),
            eq(articles.bodyStatus, 'ok'),
            sql`CHAR_LENGTH(${articles.body}) > 0`,
          ),
        )
        .limit(1);
      if (!row) {
        errors.push(`${item.url}: no stored full text`);
        continue;
      }
      if (row.publishedAt.getTime() !== item.publishedAt.getTime()) {
        errors.push(`${item.url}: stored publication conflicts with original page; review before attribution`);
        continue;
      }
      if ((row.body ?? '').replace(/\s/g, '') !== item.verifiedContent.body.replace(/\s/g, '')) {
        errors.push(`${item.url}: stored body differs from verified public body; review before attribution`);
        continue;
      }
      await db.insert(articleDiscoveries).ignore().values({
        articleId: row.id,
        media: spec.media,
        discoveryUrl: candidate.discoveryUrl,
        discoveredAt: started,
      });
      stored++;
    }
    if (!stored && !errors.length) errors.push('No original-publisher full text verified and stored');
    await db
      .update(crawlRuns)
      .set({
        finishedAt: now(),
        status: stored ? 'ok' : 'failed',
        fetched: stored,
        inserted,
        detail: errors.length ? errors.join('\n').slice(0, 4000) : null,
      })
      .where(eq(crawlRuns.id, run.id));
    log.info({ media: spec.media, stored, inserted }, 'crawl discovery source');
    return { items: stored, inserted, errors };
  } catch (error) {
    await db
      .update(crawlRuns)
      .set({ finishedAt: now(), status: 'failed', detail: String(error).slice(0, 4000) })
      .where(eq(crawlRuns.id, run.id));
    throw error;
  }
}
