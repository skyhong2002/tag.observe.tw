import * as cheerio from 'cheerio';
import { extractArticle } from './article.ts';
import type { FeedItem } from './feed.ts';
import { fetchText } from './fetch.ts';
import type { NewsDiscoveryConfig, NewsDiscoveryOptions, NewsDiscoveryResult } from './news-discovery.ts';

const FEED = 'https://pnn.tw/api/pnn/v4/posts/?show=12&page=1&categories=5d039be0ca1a4445124ee877';
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalize = (value: string) => value.normalize('NFC').replace(/[\s\u200b-\u200d\ufeff]/g, '');
interface PnnCandidate {
  id: string;
  url: string;
  originUrl: string;
  title: string;
  provider: string;
}

/** Reviewed public CNA syndication only, not PTT reposts or arbitrary API URLs. */
export function pnnCandidates(raw: unknown): PnnCandidate[] {
  const rows = record(raw).success;
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  return rows.flatMap((entry) => {
    const row = record(entry);
    const id = text(row.postId);
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id) || seen.has(id) || !/^中央社(?: CNA)?$/.test(text(row.reference)))
      return [];
    try {
      const viewer = new URL(text(row.viewerURL));
      const origin = new URL(text(row.originURL));
      if (
        !/^https?:$/.test(viewer.protocol) ||
        viewer.hostname !== 'pnn5.aotter.net' ||
        viewer.pathname !== `/viewer/${id}` ||
        viewer.username ||
        viewer.password ||
        viewer.search ||
        viewer.hash
      )
        return [];
      if (
        origin.protocol !== 'https:' ||
        origin.hostname !== 'www.cna.com.tw' ||
        !/^\/news\/a[a-z]{3}\/\d{12}\.aspx$/.test(origin.pathname) ||
        origin.username ||
        origin.password ||
        origin.search ||
        origin.hash
      )
        return [];
      const title = text(row.title);
      if (title.length < 8) return [];
      viewer.protocol = 'https:';
      seen.add(id);
      return [{ id, url: viewer.href, originUrl: origin.href, title, provider: text(row.reference) }];
    } catch {
      return [];
    }
  });
}

function overlap(a: string, b: string): number {
  const grams = (text: string) => {
    const chars = Array.from(normalize(text));
    return new Set(chars.slice(0, -4).map((_, i) => chars.slice(i, i + 5).join('')));
  };
  const left = grams(a);
  const right = grams(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared++;
  // Both directions are essential: a matching opening excerpt is insufficient.
  return Math.min(shared / left.size, shared / right.size);
}

/** Use the matching original's actual publication metadata, never PNN's batch
 * publishedDate (observed several hours later, with millisecond batch stamps). */
export function pnnArticle(
  candidate: PnnCandidate,
  viewerHtml: string,
  originHtml: string,
  now: Date,
  includeArchive = false,
): FeedItem | null {
  const viewer = cheerio.load(viewerHtml);
  const original = cheerio.load(originHtml);
  for (const page of [viewer, original]) {
    if (
      page('[data-paywall], [data-testid*="paywall"], #paywall').length ||
      /"isAccessibleForFree"\s*:\s*(?:false|"false")/.test(page('script[type="application/ld+json"]').text())
    )
      return null;
  }
  const heading = viewer('#main > #header > h1').text().trim();
  const detail = extractArticle(originHtml, candidate.originUrl);
  if (normalize(heading) !== normalize(candidate.title) || normalize(detail.title ?? '') !== normalize(candidate.title)) return null;
  if (detail.canonical && detail.canonical !== candidate.originUrl) return null;
  const date = detail.publishedAt;
  if (!date || date.getTime() > now.getTime() + 3600000 || date.getTime() < (includeArchive ? 0 : now.getTime() - 14 * 86400000))
    return null;
  const originalParagraphs = original('.paragraph')
    .first()
    .children('p')
    .map((_, node) => original(node).text().trim())
    .get()
    .filter(Boolean);
  const container = viewer('#article-content > div')
    .filter((_, node) => /^（中央社記者/.test(viewer(node).children('p').first().text().trim()))
    .first();
  const hostedParagraphs = container
    .children('p')
    .map((_, node) => viewer(node).text().trim())
    .get()
    .filter(Boolean);
  if (originalParagraphs.length < 2 || hostedParagraphs.length < 2 || !/^（中央社記者/.test(originalParagraphs[0])) return null;
  if (overlap(hostedParagraphs.join('\n'), originalParagraphs.join('\n')) < 0.9) return null;
  // Check the closing paragraph separately, so omission of a short but relevant
  // final paragraph cannot slip under the whole-story similarity threshold.
  if (normalize(hostedParagraphs.at(-1) ?? '') !== normalize(originalParagraphs.at(-1) ?? '')) return null;
  const rendered = `<article><div itemprop="articleBody">${container
    .children('p')
    .toArray()
    .map((node) => viewer.html(node))
    .join('')}</div></article>`;
  const body = extractArticle(rendered, candidate.url);
  if (body.bodyStatus !== 'ok' || !body.body || Array.from(body.body.replace(/\s/g, '')).length < 200 || detail.bodyStatus !== 'ok')
    return null;
  return {
    url: candidate.url,
    title: heading,
    publishedAt: date,
    creator: candidate.provider,
    description: `供稿來源：${candidate.provider}。原文：${candidate.originUrl}`,
    image: detail.image ?? undefined,
    verifiedContent: {
      body: body.body,
      authors: [...new Set([candidate.provider, ...detail.authors])],
      bodySource: 'pnn:public-viewer:original-date-verified',
      bodyStatus: 'ok',
    },
  };
}

export async function discoverPnn(config: NewsDiscoveryConfig, options: NewsDiscoveryOptions = {}): Promise<NewsDiscoveryResult> {
  const result: NewsDiscoveryResult = { items: [], errors: [], strategy: 'none', listingUrl: null, attempted: 0, samples: [] };
  if (!/^https:\/\/pnn\.tw\/?$/.test(config.homeUrl)) return result;
  const fetcher = options.fetch ?? fetchText;
  const now = options.now?.() ?? new Date();
  const deadline = Date.now() + (options.timeoutMs ?? 45000);
  const maxRequests = Math.max(1, Math.min(30, options.maxRequests ?? 18));
  const maxArticles = Math.max(1, Math.min(12, config.maxArticles ?? 3));
  let stopped = false;
  const get = async (url: string): Promise<string | null> => {
    if (stopped || result.attempted >= maxRequests || Date.now() >= deadline) return null;
    result.attempted++;
    try {
      const response = await fetcher(url, { timeout: Math.min(8000, deadline - Date.now()), retries: 0, maxBytes: 4 * 1024 * 1024 });
      if (response.status === 429) stopped = true;
      if (response.status !== 200 || response.url !== url) {
        result.errors.push(`PNN public request failed or redirected: HTTP ${response.status}`);
        return null;
      }
      return response.body;
    } catch {
      result.errors.push('PNN public request failed or timed out');
      return null;
    }
  };
  const feed = await get(FEED);
  if (!feed) return result;
  let candidates: PnnCandidate[];
  try {
    candidates = pnnCandidates(JSON.parse(feed));
  } catch {
    result.errors.push('PNN public feed is not valid JSON');
    return result;
  }
  for (const candidate of candidates) {
    if (result.items.length >= maxArticles || stopped || result.attempted >= maxRequests || Date.now() >= deadline) break;
    const viewer = await get(candidate.url);
    if (!viewer) continue;
    const original = await get(candidate.originUrl);
    if (!original) continue;
    const item = pnnArticle(candidate, viewer, original, now, config.includeArchive);
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
    result.listingUrl = FEED;
  } else result.errors.push('No complete PNN-hosted article matched an original with verified publication date');
  return result;
}
