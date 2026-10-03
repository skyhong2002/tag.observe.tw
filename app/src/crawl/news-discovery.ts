import * as cheerio from 'cheerio';
import { extractArticle, parsePublished } from './article.ts';
import type { FeedItem } from './feed.ts';
import { parseFeed } from './feed.ts';
import type { FetchResult } from './fetch.ts';
import { fetchText } from './fetch.ts';
import { decodeEntities } from './text.ts';

export interface NewsDiscoveryConfig {
  homeUrl: string;
  feedUrls?: string[];
  articlePattern?: string;
  maxArticles?: number;
}
export interface NewsDiscoveryOptions {
  fetch?: typeof fetchText;
  now?: () => Date;
  /** Total source budget, including every discovery and article request. */
  timeoutMs?: number;
  maxRequests?: number;
}
export interface NewsDiscoveryResult {
  items: FeedItem[];
  errors: string[];
  strategy: 'rss' | 'sitemap' | 'html' | 'none';
  listingUrl: string | null;
  attempted: number;
  samples: Array<{ url: string; title: string; publishedAt: string; bodyLength: number }>;
}
const hostKey = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, '');
function absolute(raw: string, base: string): string | null {
  try {
    const url = new URL(raw, base);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch {
    return null;
  }
}
function articlePath(url: string): boolean {
  const { pathname, searchParams } = new URL(url);
  return (
    (pathname !== '/' || ['p', 'id', 'newsid', 'article_id'].some((key) => searchParams.has(key))) &&
    !/\/(?:category|tag|author|search|login|register|about|contact|privacy|shop|product|cart|video-category)(?:\/|\.|$)/i.test(pathname) &&
    !/\.(?:xml|gz|json|jpg|jpeg|png|gif|pdf|css|js|mp4)$/i.test(pathname)
  );
}

// Only the page entity can supply publication time. Dates on related article
// cards and sitemap lastmod values are deliberately not publication evidence.
function pageEvidence($: cheerio.CheerioAPI, url: string, html: string) {
  const metaDate = $(
    'meta[property="article:published_time"], meta[name="article:published_time"], meta[itemprop="datePublished"], ' +
      'meta[name="publish-date"], meta[name="my:publish_date"], meta[name="pubdate"]',
  )
    .toArray()
    .map((node) => parsePublished($(node).attr('content')))
    .find(Boolean);
  let publishedAt = metaDate ?? null;
  let isArticle = $('meta[property="og:type"][content="article"]').length > 0;
  let isProduct = $('meta[property="og:type"][content^="product"]').length > 0;
  let blocked = $('[data-paywall], [data-testid*="paywall"], #paywall').length > 0;
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    const types = [node['@type']].flat().map(String);
    const identity = node.url ?? node.mainEntityOfPage ?? node['@id'];
    const raw = typeof identity === 'string' ? identity : (identity as Record<string, unknown> | undefined)?.['@id'];
    const matching = !raw || (typeof raw === 'string' && absolute(raw, url) === absolute(url, url));
    if (matching) {
      if (types.some((type) => /(?:Article|BlogPosting)$/.test(type))) {
        isArticle = true;
        publishedAt ??= typeof node.datePublished === 'string' ? parsePublished(node.datePublished) : null;
        blocked ||= node.isAccessibleForFree === false || node.isAccessibleForFree === 'false';
      }
      if (types.includes('Product')) isProduct = true;
    }
    visit(node['@graph']);
    visit(node.mainEntity);
  };
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      visit(JSON.parse($(script).text()));
    } catch {
      // Invalid structured data cannot establish the page's date or identity.
    }
  }
  // WordPress's explicitly published time is useful when SEO metadata is absent.
  publishedAt ??= parsePublished(
    $(
      'article time.entry-date.published[datetime], article time[itemprop="datePublished"][datetime], .article-details[itemtype$="/Article"] time[itemprop="datePublished"][datetime]',
    )
      .first()
      .attr('datetime'),
  );
  // TaiwanHot labels publication time in the main article header. Never read
  // same-class timestamps from its related-story lists or an update label.
  const postTime = $('.content_wrapper > .top_title .post_time').first();
  const printedDate = postTime.text().trim();
  if (
    $('.content_wrapper .news_content').length &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(printedDate) &&
    !/更新|修訂|modified|updated/i.test(postTime.parent().text())
  ) {
    publishedAt ??= parsePublished(printedDate);
    isArticle = true;
  }

  // Founder newspaper archives publish explicit article metadata in a comment.
  // Require both the article type marker and its dedicated body element.
  const founder = /<!--enpproperty\s+([\s\S]*?)\/enpproperty-->/i.exec(html)?.[1];
  let title: string | null = null;
  if (founder && /<founder-type>1<\/founder-type>/i.test(founder) && $('founder-content').length) {
    const date = /<founder-date>(\d{4}-\d{2}-\d{2})<\/founder-date>/i.exec(founder)?.[1];
    publishedAt ??= date ? parsePublished(`${date}T00:00:00+08:00`) : null;
    title = decodeEntities(/<founder-title>([^<]+)<\/founder-title>/i.exec(founder)?.[1] ?? '').trim() || null;
    isArticle = true;
  }
  return { publishedAt, isArticle, isProduct, blocked, title };
}

export async function discoverNews(config: NewsDiscoveryConfig, options: NewsDiscoveryOptions = {}): Promise<NewsDiscoveryResult> {
  const result: NewsDiscoveryResult = { items: [], errors: [], strategy: 'none', listingUrl: null, attempted: 0, samples: [] };
  const home = absolute(config.homeUrl, config.homeUrl);
  if (!home) return { ...result, errors: ['Invalid home URL'] };
  const allowedHosts = new Set([hostKey(new URL(home))]);
  const belongs = (url: string) => allowedHosts.has(hostKey(new URL(url)));
  const fetcher = options.fetch ?? fetchText;
  const maxRequests = Math.max(1, Math.min(options.maxRequests ?? 18, 60));
  const maxArticles = Math.max(1, Math.min(config.maxArticles ?? 10, 30));
  const deadline = Date.now() + Math.max(1, options.timeoutMs ?? 45000);
  const now = (options.now?.() ?? new Date()).getTime();
  const recent = (date: Date | null) => date && date.getTime() >= now - 14 * 86400000 && date.getTime() <= now + 3600000;
  const fetched = new Map<string, FetchResult | null>();
  const validated = new Set<string>();
  const accepted = new Set<string>();
  let stopped = false;
  let pattern: RegExp | undefined;
  try {
    pattern = config.articlePattern ? new RegExp(config.articlePattern) : undefined;
  } catch {
    result.errors.push('Invalid articlePattern; using generic discovery');
  }
  const budget = () => !stopped && result.attempted < maxRequests && Date.now() < deadline && result.items.length < maxArticles;
  const get = async (url: string) => {
    if (fetched.has(url)) return fetched.get(url) ?? null;
    if (!budget()) return null;
    result.attempted++;
    fetched.set(url, null);
    try {
      const response = await fetcher(url, {
        timeout: Math.max(1, Math.min(8000, deadline - Date.now())),
        retries: 0,
        maxBytes: 4 * 1024 * 1024,
      });
      if (response.status === 429) stopped = true;
      if (response.status < 200 || response.status >= 300) {
        result.errors.push(`${url}: HTTP ${response.status}`);
        return null;
      }
      fetched.set(url, response);
      fetched.set(response.url, response);
      return response;
    } catch (error) {
      result.errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };
  const validate = async (candidate: FeedItem, strategy: 'rss' | 'sitemap' | 'html', listingUrl: string) => {
    const url = absolute(candidate.url, listingUrl);
    const validationKey = `${url}\t${candidate.publishedAt?.getTime() ?? ''}`;
    if (!url || !belongs(url) || !articlePath(url) || validated.has(validationKey) || !budget()) return;
    validated.add(validationKey);
    if (candidate.publishedAt && !recent(candidate.publishedAt)) return;
    const response = await get(url);
    if (!response || !belongs(response.url) || !articlePath(response.url)) return;
    const $ = cheerio.load(response.body);
    const detail = extractArticle(response.body, response.url);
    const evidence = pageEvidence($, response.url, response.body);
    const canonical = detail.canonical ? absolute(detail.canonical, response.url) : response.url;
    if (!canonical || !belongs(canonical) || !articlePath(canonical) || accepted.has(canonical)) return;
    const publishedAt = evidence.publishedAt ?? candidate.publishedAt;
    const title = (evidence.title || detail.title || $('h1').first().text() || candidate.title).replace(/\s+/g, ' ').trim();
    const bodyLength = Array.from((detail.body ?? '').replace(/\s/g, '')).length;
    if (
      !recent(publishedAt) ||
      title.length < 4 ||
      detail.bodyStatus !== 'ok' ||
      bodyLength < 120 ||
      evidence.isProduct ||
      evidence.blocked
    )
      return;
    // A dated page must still have article structure. This excludes navigation
    // and large product/listing pages carrying a generic global timestamp.
    if (!evidence.isArticle && !$('h1').length && !(strategy === 'rss' && candidate.title)) return;
    if ($('article').length > 3 && !evidence.isArticle) return;
    accepted.add(canonical);
    result.items.push({
      ...candidate,
      url: canonical,
      title,
      publishedAt,
      image: detail.image ?? candidate.image,
      tags: detail.tags.length ? detail.tags : candidate.tags,
    });
    result.samples.push({ url: canonical, title, publishedAt: publishedAt!.toISOString(), bodyLength });
    if (result.strategy === 'none') {
      result.strategy = strategy;
      result.listingUrl = listingUrl;
    }
  };
  const scanFeed = async (url: string, cap: number) => {
    const response = await get(url);
    if (!response) return [] as string[];
    // Atom updated is modification time, just like sitemap lastmod.
    const parsed = parseFeed(response.body.replace(/<updated(?:\s[^>]*)?>[^<]*<\/updated>/gi, ''));
    const strategy = parsed.kind === 'sitemap' ? 'sitemap' : 'rss';
    const ordered = [...parsed.items].sort(
      (a, b) => (b.publishedAt?.getTime() ?? b.modifiedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? a.modifiedAt?.getTime() ?? 0),
    );
    let attempts = 0;
    for (const item of ordered) {
      if (!budget() || attempts >= cap) break;
      const before = result.attempted;
      await validate(item, strategy, response.url);
      if (result.attempted > before) attempts++;
    }
    return (parsed.children ?? []).filter((child) => belongs(child));
  };

  let homepage = await get(home);
  let base = home;
  const feedUrls = new Set<string>();
  for (const seed of config.feedUrls ?? []) {
    const url = absolute(seed, home);
    if (url) feedUrls.add(url);
  }
  const htmlCandidates = new Map<string, FeedItem & { score: number }>();
  if (homepage) {
    base = homepage.url;
    allowedHosts.add(hostKey(new URL(base)));
    // Static newspaper archives use a same-site meta refresh to today's issue.
    // Follow at most two hops; never follow refreshes into a different host.
    for (let hop = 0; hop < 2 && budget(); hop++) {
      const doc = cheerio.load(homepage.body);
      const refresh = doc('meta[http-equiv]')
        .filter((_, node) => (doc(node).attr('http-equiv') ?? '').toLowerCase() === 'refresh')
        .first()
        .attr('content');
      const target = /;\s*url\s*=\s*['"]?([^'";]+)['"]?\s*$/i.exec(refresh ?? '')?.[1];
      const nextUrl = target ? absolute(target.trim(), base) : null;
      if (!nextUrl || !belongs(nextUrl) || fetched.has(nextUrl)) break;
      const next = await get(nextUrl);
      if (!next || !belongs(next.url)) break;
      homepage = next;
      base = next.url;
    }
    const $ = cheerio.load(homepage.body);
    $('link[rel="alternate"]').each((_, node) => {
      if (!/(?:rss|atom)\+xml/i.test($(node).attr('type') ?? '')) return;
      const url = absolute($(node).attr('href') ?? '', base);
      if (url && belongs(url) && !/\/comments\/feed(?:\/|$)/i.test(url)) feedUrls.add(url);
    });
    $('a[href]').each((_, node) => {
      const anchor = $(node);
      const url = absolute(anchor.attr('href') ?? '', base);
      if (!url || !belongs(url) || !articlePath(url)) return;
      const title = (anchor.attr('title')?.trim() || anchor.text().trim() || anchor.find('img').attr('alt')?.trim() || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (title.length < 8 || anchor.closest('nav, footer, [role="navigation"]').length) return;
      const path = new URL(url).pathname;
      if (pattern && !pattern.test(path + new URL(url).search)) return;
      let score = /\/(?:news|article|story|post|realtime|archives)\b/i.test(path) ? 5 : 0;
      score += /\d{4,}/.test(url) ? 4 : 0;
      score += /[-_]/.test(path) ? 1 : 0;
      score += anchor.closest('article, h2, h3').length ? 3 : 0;
      // URL dates only rank discovery candidates; validation still requires
      // explicit publisher/feed publication metadata and a complete body.
      const datedPath = /\/(20\d{2})[/-](\d{2})(?:[/-](\d{2}))?(?:[/-]|$)/.exec(path);
      if (datedPath) {
        const hint = Date.parse(`${datedPath[1]}-${datedPath[2]}-${datedPath[3] ?? '01'}T00:00:00+08:00`);
        score += hint >= now - 35 * 86400000 && hint <= now + 86400000 ? 6 : -8;
      }
      if (score || path.split('/').filter(Boolean).length >= 2 || title.length >= 16)
        if (score >= (htmlCandidates.get(url)?.score ?? -1)) htmlCandidates.set(url, { url, title, publishedAt: null, score });
    });
    if (/wp-content|wp-includes|api\.w\.org/i.test(homepage.body)) feedUrls.add(new URL('/feed/', base).href);
  }
  const seededSitemaps: string[] = [];
  // Reserve discovery space for HTML/sitemaps if feeds are empty or stale.
  for (const url of [...feedUrls].slice(0, 3)) {
    if (!budget()) break;
    seededSitemaps.push(...(await scanFeed(url, 7)));
  }
  const htmlItems = [...htmlCandidates.values()].sort((a, b) => b.score - a.score);
  for (const item of htmlItems.slice(0, 6)) await validate(item, 'html', base);
  if (budget() && result.items.length < Math.min(maxArticles, 4)) {
    const robots = await get(new URL('/robots.txt', base).href);
    const sitemapUrls = new Set<string>(seededSitemaps);
    for (const match of robots?.body.matchAll(/^Sitemap:\s*(\S+)/gim) ?? []) {
      const url = absolute(match[1], base);
      if (url && belongs(url)) sitemapUrls.add(url);
    }
    sitemapUrls.add(new URL('/sitemap.xml', base).href);
    const queue = [...sitemapUrls];
    const seen = new Set<string>();
    for (let i = 0; i < queue.length && seen.size < 4 && budget(); i++) {
      const url = queue[i];
      if (seen.has(url)) continue;
      seen.add(url);
      const children = await scanFeed(url, 5);
      // News and current post sitemaps get priority over category/media maps.
      children.sort((a, b) => Number(/news|post/i.test(b)) - Number(/news|post/i.test(a)));
      queue.splice(i + 1, 0, ...children.filter((child) => !seen.has(child)));
    }
  }
  for (const item of htmlItems.slice(6)) {
    if (!budget()) break;
    await validate(item, 'html', base);
  }
  if (budget() && !feedUrls.size && result.items.length === 0) await scanFeed(new URL('/feed/', base).href, 5);
  if (!result.items.length) result.errors.push('No recent article with verified title, publication date and body found');
  return result;
}
