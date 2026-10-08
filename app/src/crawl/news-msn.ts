import * as cheerio from 'cheerio';
import { extractArticle, parsePublished } from './article.ts';
import { reporterNames } from './byline.ts';
import type { FeedItem } from './feed.ts';
import { fetchText } from './fetch.ts';
import type { NewsDiscoveryConfig, NewsDiscoveryOptions, NewsDiscoveryResult } from './news-discovery.ts';
import { publisherSummary } from './summary.ts';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Read the anonymous feed key from the exact publisher bundle that uses it.
 * Never evaluate JavaScript or read a user/account token. */
export function msnPublicFeedKey(bundle: string): string | null {
  for (const match of bundle.matchAll(/(?:let|const|var)\s+([\w$]+)\s*=\s*["']([A-Za-z0-9]{30,80})["']/g)) {
    const following = bundle.slice(match.index + match[0].length, match.index + match[0].length + 1800);
    if (following.includes(`.set("apikey",${match[1]})`) && following.includes('service/news/feed')) return match[2];
  }
  return null;
}

export function msnFeedArticles(raw: unknown): Array<{ id: string; url: string }> {
  const rows = record(raw).value;
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const cards = record(row).subCards;
    if (!Array.isArray(cards)) return [];
    return cards.flatMap((entry) => {
      const card = record(entry);
      const id = text(card.id);
      if (card.type !== 'article' || card.locale !== 'zh-tw' || !/^AA[A-Za-z0-9]{4,20}$/.test(id) || seen.has(id)) return [];
      try {
        const url = new URL(text(card.url));
        if (
          url.protocol !== 'https:' ||
          url.hostname !== 'www.msn.com' ||
          !url.pathname.startsWith('/zh-tw/') ||
          !url.pathname.endsWith(`/ar-${id}`)
        )
          return [];
        url.search = '';
        url.hash = '';
        seen.add(id);
        return [{ id, url: url.href }];
      } catch {
        return [];
      }
    });
  });
}

/** The body field is Microsoft's publicly rendered licensed partner text.
 * An abstract, feed snippet, or premium provider label alone is never body proof. */
export function msnTvbsSource(raw: unknown): string | null {
  const detail = record(raw);
  const source = text(detail.sourceHref);
  if (text(record(detail.provider).name) !== 'TVBS新聞網' || !/^https:\/\/news\.tvbs\.com\.tw\/[a-z]+\/\d+$/.test(source)) return null;
  if (
    !Array.isArray(detail.authors) ||
    detail.authors.length !== 1 ||
    !/^[\p{Script=Han}]{2,5}\s+[\p{Script=Han}]{2,5}\s+新聞中心$/u.test(text(record(detail.authors[0]).name))
  )
    return null;
  return source;
}

function tvbsReporter(raw: unknown, original: string, item: FeedItem): string | null {
  const source = msnTvbsSource(raw);
  if (!source || !item.verifiedContent) return null;
  const detail = record(raw),
    $ = cheerio.load(original);
  const compact = (s: string) => s.normalize('NFKC').replace(/\s/g, '');
  if (
    $('link[rel="canonical"]').attr('href') !== source ||
    $('h1[data-section="article-title"]').length !== 1 ||
    compact($('h1[data-section="article-title"]').text()) !== compact(item.title)
  )
    return null;
  const credits = [
    ...new Set(
      $('main [data-section="article-contributors"] span.caption-12-medium')
        .toArray()
        .map((n) => compact($(n).text()))
        .filter((s) => /^記者:/.test(s)),
    ),
  ];
  if (credits.length !== 1) return null;
  const match = /^記者:([\p{Script=Han}]{2,5})\|攝影:([\p{Script=Han}]{2,5})\|責任編輯:新聞中心$/u.exec(credits[0]);
  if (!match || compact(text(record((detail.authors as unknown[])[0]).name)) !== match[1] + match[2] + '新聞中心') return null;
  if ($('main .article-editor-content').length !== 1) return null;
  const origin = extractArticle(original, source, { bodySelector: 'main .article-editor-content' });
  if (origin.bodyStatus !== 'ok' || !origin.body) return null;
  const paragraphs = item.verifiedContent.body.split(/\n\s*\n/).filter((p) => compact(p).length > 20);
  if (paragraphs.length < 2 || paragraphs.some((p) => !compact(origin.body!).includes(compact(p)))) return null;
  return match[1];
}

export function msnArticle(
  raw: unknown,
  candidate: { id: string; url: string },
  now: Date,
  includeArchive = false,
  original?: string,
): FeedItem | null {
  const detail = record(raw);
  if (detail.id !== candidate.id || detail.type !== 'article' || detail.locale !== 'zh-tw') return null;
  // provider.isPremium describes the partner, not a reader subscription. The
  // article's own explicit access flags decide whether it is publicly readable.
  if (
    detail.renderingRestriction !== 0 ||
    detail.subscriptionProductType !== 0 ||
    detail.isAccessibleForFree === false ||
    detail.isPaywalled === true
  )
    return null;
  const title = text(detail.title);
  const publishedAt = parsePublished(text(detail.publishedDateTime));
  if (
    !publishedAt ||
    publishedAt.getTime() > now.getTime() + 3600000 ||
    publishedAt.getTime() < (includeArchive ? 0 : now.getTime() - 14 * 86400000)
  )
    return null;
  const provider = text(record(detail.provider).name);
  const bodyHtml = text(detail.body);
  if (
    title.length < 4 ||
    !provider ||
    !bodyHtml ||
    /data-paywall|subscriber.only|訂閱.{0,15}全文|繼續閱讀|閱讀全文|continue reading/i.test(bodyHtml)
  )
    return null;
  const $ = cheerio.load(bodyHtml);
  if ($('[data-paywall], [data-testid*="paywall"], #paywall').length || $('p').length < 2) return null;
  const extracted = extractArticle(`<article><div itemprop="articleBody">${bodyHtml}</div></article>`, candidate.url);
  if (extracted.bodyStatus !== 'ok' || !extracted.body || Array.from(extracted.body.replace(/\s/g, '')).length < 200) return null;
  let sourceUrl = '';
  try {
    const source = new URL(text(detail.sourceHref));
    if (/^https?:$/.test(source.protocol) && !source.username && !source.password) sourceUrl = source.href;
  } catch {
    /* Missing provider URL is not replaced by an inferred address. */
  }
  const authors = Array.isArray(detail.authors)
    ? detail.authors.flatMap((author) => {
        const credit = text(record(author).name);
        if (!credit) return [];
        const newtalkName =
          provider === '新頭殼' &&
          sourceUrl &&
          ['newtalk.tw', 'www.newtalk.tw'].includes(new URL(sourceUrl).hostname) &&
          /^\/news\/view\/\d{4}-\d{2}-\d{2}\/\d+\/?$/.test(new URL(sourceUrl).pathname)
            ? /^Newtalk新聞\s*[|｜]\s*([\p{Script=Han}]{2,5})\s+綜合報導$/u.exec(credit)?.[1]
            : null;
        if (newtalkName) return [newtalkName];
        const names = reporterNames(credit);
        return names.length ? names : [credit];
      })
    : [];
  const images = Array.isArray(detail.imageResources) ? detail.imageResources : [];
  const image = images.map((entry) => text(record(entry).url)).find((url) => /^https:\/\//.test(url));
  const item: FeedItem = {
    url: candidate.url,
    title,
    publishedAt,
    creator: provider,
    description: `供稿來源：${provider}。${sourceUrl ? `原文：${sourceUrl}` : ''}`,
    ...publisherSummary(detail.abstract, 'api:msn:abstract', title),
    image,
    verifiedContent: {
      body: extracted.body,
      authors: [...new Set([provider, ...authors])],
      bodySource: 'msn:public-detail:body',
      bodyStatus: 'ok',
    },
  };
  const ownReporter = original ? tvbsReporter(raw, original, item) : null;
  if (ownReporter) item.verifiedContent!.authors = [provider, ownReporter];
  return item;
}

/** Scoped adapter for MSN Taiwan's ordinary anonymous news feed and reader API. */
export async function discoverMsn(config: NewsDiscoveryConfig, options: NewsDiscoveryOptions = {}): Promise<NewsDiscoveryResult> {
  const result: NewsDiscoveryResult = { items: [], errors: [], strategy: 'none', listingUrl: null, attempted: 0, samples: [] };
  if (!/^https:\/\/www\.msn\.com\/zh-tw\/news\/?(?:\?|$)/.test(config.homeUrl)) return result;
  const fetcher = options.fetch ?? fetchText;
  const now = options.now?.() ?? new Date();
  const deadline = Date.now() + (options.timeoutMs ?? 45000);
  const maxRequests = Math.max(1, Math.min(30, options.maxRequests ?? 18));
  const maxArticles = Math.max(1, Math.min(12, config.maxArticles ?? 3));
  let stopped = false;
  const get = async (url: string, partner = false): Promise<string | null> => {
    if (partner && !/^https:\/\/news\.tvbs\.com\.tw\/[a-z]+\/\d+$/.test(url)) return null;
    if (stopped || result.attempted >= maxRequests || Date.now() >= deadline) return null;
    result.attempted++;
    try {
      const response = await fetcher(url, { timeout: Math.min(8000, deadline - Date.now()), retries: 0, maxBytes: 4 * 1024 * 1024 });
      if (response.status === 429) stopped = true;
      if (response.status !== 200) {
        result.errors.push(`MSN public request: HTTP ${response.status}`);
        return null;
      }
      const target = new URL(response.url);
      if (target.protocol !== 'https:' || (partner ? target.href !== url : !['www.msn.com', 'assets.msn.com'].includes(target.hostname)))
        return null;
      return response.body;
    } catch {
      result.errors.push('MSN public request failed or timed out');
      return null;
    }
  };
  const homepage = await get(config.homeUrl);
  if (!homepage) return result;
  const $ = cheerio.load(homepage);
  const bundle = $('script[src]')
    .toArray()
    .map((node) => $(node).attr('src') ?? '')
    .find((url) => /^https:\/\/assets\.msn\.com\/bundles\/v1\/hub\/(?:latest|[\w.-]+)\/common\.[a-f0-9]+\.js$/.test(url));
  const key = bundle ? msnPublicFeedKey((await get(bundle)) ?? '') : null;
  if (!key) {
    result.errors.push('MSN anonymous feed configuration not found');
    return result;
  }
  const feedUrl = new URL('https://assets.msn.com/service/news/feed');
  feedUrl.search = new URLSearchParams({ query: 'topstories', market: 'zh-tw', $top: '20', apikey: key }).toString();
  const rawFeed = await get(feedUrl.href);
  if (!rawFeed) return result;
  let candidates: Array<{ id: string; url: string }>;
  try {
    candidates = msnFeedArticles(JSON.parse(rawFeed));
  } catch {
    result.errors.push('MSN public feed is not valid JSON');
    return result;
  }
  for (const candidate of candidates) {
    if (result.items.length >= maxArticles || stopped || result.attempted >= maxRequests || Date.now() >= deadline) break;
    const raw = await get(`https://assets.msn.com/content/view/v2/Detail/zh-tw/${candidate.id}`);
    if (!raw) continue;
    let item: FeedItem | null = null;
    try {
      const detail = JSON.parse(raw);
      item = msnArticle(detail, candidate, now, config.includeArchive);
      const source = item && msnTvbsSource(detail);
      if (source) {
        const original = await get(source, true);
        if (original) item = msnArticle(detail, candidate, now, config.includeArchive, original);
      }
    } catch {
      /* malformed public response is not body proof */
    }
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
    result.listingUrl = config.homeUrl;
  } else result.errors.push('No complete public MSN Taiwan article with verified publication date found');
  return result;
}
