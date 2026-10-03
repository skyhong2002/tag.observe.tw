import { load } from 'cheerio';
import type { FeedItem } from './feed.ts';
import { fetchText } from './fetch.ts';
import type { NewsDiscoveryConfig, NewsDiscoveryOptions, NewsDiscoveryResult } from './news-discovery.ts';

const origin = 'https://www3.nhk.or.jp';
const listing = `${origin}/nhkworld/data/zh/news/all.json`;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

// These are the public static JSON files used by NHK's own Chinese news page.
// public_at is publication; updated_at must never stand in for it.
export function nhkArticle(raw: unknown, id: string, now: Date): FeedItem | null {
  const row = record(record(raw).data);
  if (!/^(?:nd-)?\d{8}[a-z0-9]+$/.test(id) || row.id !== id || row.page_url !== `/nhkworld/zh/news/${id}/`) return null;
  if (typeof row.title !== 'string' || typeof row.detail !== 'string' || !/^\d{13}$/.test(String(row.public_at))) return null;
  const publishedAt = new Date(Number(row.public_at));
  if (publishedAt.getTime() > now.getTime() + 3600000 || publishedAt.getTime() < now.getTime() - 14 * 86400000) return null;
  const body = load(row.detail.replace(/<br\s*\/?\s*>/gi, '\n'))
    .text()
    .trim();
  const title = load(row.title).text().trim();
  if (title.length < 4 || Array.from(body.replace(/\s/g, '')).length < 200) return null;
  return {
    url: `${origin}${row.page_url}`,
    title,
    publishedAt,
    verifiedContent: { body, authors: [], bodySource: 'nhk:public-news-json', bodyStatus: 'ok' },
  };
}

export async function discoverNhk(config: NewsDiscoveryConfig, options: NewsDiscoveryOptions = {}): Promise<NewsDiscoveryResult> {
  const result: NewsDiscoveryResult = { items: [], errors: [], strategy: 'none', listingUrl: null, attempted: 0, samples: [] };
  if (config.homeUrl !== `${origin}/nhkworld/zh/news/`) return result;
  const fetcher = options.fetch ?? fetchText;
  const now = options.now?.() ?? new Date();
  const deadline = Date.now() + (options.timeoutMs ?? 45000);
  const maxRequests = Math.max(1, Math.min(30, options.maxRequests ?? 18));
  const maxArticles = Math.max(1, Math.min(12, config.maxArticles ?? 3));
  let stopped = false;
  const get = async (url: string): Promise<unknown> => {
    if (stopped || result.attempted >= maxRequests || Date.now() >= deadline) return null;
    result.attempted++;
    try {
      const response = await fetcher(url, { timeout: Math.min(8000, deadline - Date.now()), retries: 0, maxBytes: 4 * 1024 * 1024 });
      if (response.status === 429) stopped = true;
      if (response.status !== 200 || response.url !== url) {
        result.errors.push(`NHK public request failed or redirected: HTTP ${response.status}`);
        return null;
      }
      return JSON.parse(response.body);
    } catch {
      result.errors.push('NHK public JSON request failed');
      return null;
    }
  };
  const rows = record(await get(listing)).data;
  if (!Array.isArray(rows)) return result;
  const seen = new Set<string>();
  for (const candidate of rows) {
    if (result.items.length >= maxArticles || stopped || result.attempted >= maxRequests || Date.now() >= deadline) break;
    const id = record(candidate).id;
    if (typeof id !== 'string' || !/^(?:nd-)?\d{8}[a-z0-9]+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const item = nhkArticle(await get(`${origin}/nhkworld/data/zh/news/${id}.json`), id, now);
    if (!item?.verifiedContent || !item.publishedAt) continue;
    result.items.push(item);
    result.samples.push({
      url: item.url,
      title: item.title,
      publishedAt: item.publishedAt.toISOString(),
      bodyLength: Array.from(item.verifiedContent.body.replace(/\s/g, '')).length,
    });
  }
  if (result.items.length) {
    result.strategy = 'api';
    result.listingUrl = listing;
  } else result.errors.push('No complete NHK article with a verified publication date');
  return result;
}
