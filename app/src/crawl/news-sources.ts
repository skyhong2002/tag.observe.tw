import audit from '../../data/news-crawl-audit.json' with { type: 'json' };
import catalog from '../../data/news-source-catalog.json' with { type: 'json' };
import type { SourceSpec } from './sources.ts';

export interface NewsSource {
  media: string;
  name: string;
  websiteUrl: string | null;
  referenceNames: string[];
  referenceRows: number[];
  existing: boolean;
  websiteEvidence: string | null;
  notes: string;
  feedUrls?: string[];
  articlePattern?: string;
  articleHosts?: string[];
  feedBody?: 'full-text';
  apiUrls?: string[];
  includeArchive?: boolean;
  feedOnly?: boolean;
  transport?: 'curl';
  requestTimeoutMs?: number;
  provider?: string;
  articleUrls?: string[];
}

export interface NewsCrawlAudit {
  media: string;
  websiteUrl: string | null;
  checkedAt: string;
  status: 'verified' | 'unavailable' | 'unresolved' | 'existing';
  strategy: 'rss' | 'sitemap' | 'html' | 'api' | 'existing' | 'none';
  listingUrl: string | null;
  articleCount: number;
  detail: string;
  samples: Array<{ url: string; title: string; publishedAt: string; bodyLength: number }>;
}

export function addNewsSources(
  existing: SourceSpec[],
  sources: NewsSource[] = catalog.sources as NewsSource[],
  results: NewsCrawlAudit[] = audit.results as NewsCrawlAudit[],
): SourceSpec[] {
  const ids = new Set(existing.map((source) => source.media));
  const byMedia = new Map(results.map((result) => [result.media, result]));
  const additions = sources
    .filter((source) => !ids.has(source.media))
    .map((source): SourceSpec => {
      const proof = byMedia.get(source.media);
      // An audit of another URL, a found feed, or an empty listing is not proof.
      const verified =
        source.websiteUrl != null && proof?.websiteUrl === source.websiteUrl && proof.status === 'verified' && proof.samples.length > 0;
      const feeds = [...(source.feedUrls ?? [])];
      if (verified && proof.listingUrl && (proof.strategy === 'rss' || proof.strategy === 'sitemap')) feeds.unshift(proof.listingUrl);
      return {
        media: source.media,
        group: verified ? 'hourly' : 'off',
        list: {
          urls: source.websiteUrl ? [{ cat: 'news', url: source.websiteUrl }] : [],
          ...(source.websiteUrl
            ? {
                autoDiscover: {
                  homeUrl: source.websiteUrl,
                  feedUrls: [...new Set(feeds)],
                  ...(source.articlePattern ? { articlePattern: source.articlePattern } : {}),
                  ...(source.articleHosts ? { articleHosts: source.articleHosts } : {}),
                  ...(source.feedBody ? { feedBody: source.feedBody } : {}),
                  ...(source.apiUrls ? { apiUrls: source.apiUrls } : {}),
                  ...(source.includeArchive ? { includeArchive: true } : {}),
                  ...(source.feedOnly ? { feedOnly: true } : {}),
                  ...(source.transport ? { transport: source.transport } : {}),
                  ...(source.requestTimeoutMs ? { requestTimeoutMs: source.requestTimeoutMs } : {}),
                  ...(source.provider ? { provider: source.provider } : {}),
                  ...(source.articleUrls ? { articleUrls: source.articleUrls } : {}),
                  maxArticles: 12,
                },
              }
            : {}),
        },
        article: { enabled: !!source.websiteUrl, batch: 12, delayMs: 1500, ...(source.provider ? { provider: source.provider } : {}) },
      };
    });
  return [...existing, ...additions];
}
