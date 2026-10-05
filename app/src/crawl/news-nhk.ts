import { load } from 'cheerio';
import type { FeedItem } from './feed.ts';
import { fetchText } from './fetch.ts';
import type { NewsDiscoveryConfig, NewsDiscoveryOptions, NewsDiscoveryResult } from './news-discovery.ts';

const origin = 'https://www3.nhk.or.jp';
const listing = `${origin}/nhkworld/data/zt/news/all.json`;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

// These are the public static JSON files used by NHK's own Traditional Chinese news page.
// NHK WORLD has no per-article publication time: public_at (JSON and the page's
// datePublished) is the regeneration stamp of the whole listing, identical for every
// story. The story id carries its publication date (YYYYMMDD, Japan time) and
// updated_at is the per-story last edit, so the date comes from the id and the
// time of day from updated_at only when that edit happened on the same Japan day.
const JST_OFFSET_MS = 9 * 3600000;
export function nhkPublishedAt(id: string, updatedAt: unknown): Date | null {
  const match = /^(?:nd-)?(\d{4})(\d{2})(\d{2})[a-z0-9_]+$/i.exec(id);
  if (!match) return null;
  const [, y, m, d] = match;
  const dayStart = Date.UTC(Number(y), Number(m) - 1, Number(d)) - JST_OFFSET_MS;
  if (Number.isNaN(dayStart)) return null;
  const check = new Date(dayStart + JST_OFFSET_MS);
  if (check.getUTCFullYear() !== Number(y) || check.getUTCMonth() !== Number(m) - 1 || check.getUTCDate() !== Number(d)) return null;
  const edited = /^\d{13}$/.test(String(updatedAt)) ? Number(updatedAt) : Number.NaN;
  if (edited >= dayStart && edited < dayStart + 86400000) return new Date(edited);
  return new Date(dayStart);
}

export function nhkArticle(raw: unknown, id: string, now: Date): FeedItem | null {
  const row = record(record(raw).data);
  if (!/^(?:nd-)?\d{8}[a-z0-9]+$/.test(id) || row.id !== id || row.page_url !== `/nhkworld/zt/news/${id}/`) return null;
  if (typeof row.title !== 'string' || typeof row.detail !== 'string') return null;
  const publishedAt = nhkPublishedAt(id, row.updated_at);
  if (!publishedAt) return null;
  if (publishedAt.getTime() > now.getTime() + 86400000 || publishedAt.getTime() < now.getTime() - 14 * 86400000) return null;
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
  if (config.homeUrl !== `${origin}/nhkworld/zt/news/`) return result;
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
    const item = nhkArticle(await get(`${origin}/nhkworld/data/zt/news/${id}.json`), id, now);
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
  } else result.errors.push('No complete NHK article with a dated story id');
  return result;
}
