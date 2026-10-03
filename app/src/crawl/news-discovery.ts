import * as cheerio from 'cheerio';
import { extractArticle, parsePublished } from './article.ts';
import type { FeedItem } from './feed.ts';
import { parseFeed } from './feed.ts';
import type { FetchResult } from './fetch.ts';
import { fetchText, fetchViaCurl } from './fetch.ts';
import { discoverMsn } from './news-msn.ts';
import { discoverPnn } from './news-pnn.ts';
import { parsePublicJson, publicArticleHtml } from './news-public-html.ts';
import { newsSiteEvidence } from './news-site-rules.ts';
import { decodeEntities } from './text.ts';

export interface NewsDiscoveryConfig {
  homeUrl: string;
  feedUrls?: string[];
  /** Reviewed publisher-owned article hosts; never inferred from page links. */
  articleHosts?: string[];
  /** Only enable for reviewed official feeds publishing complete public text. */
  feedBody?: 'full-text';
  /** Reviewed public WordPress REST posts endpoints. */
  apiUrls?: string[];
  articlePattern?: string;
  maxArticles?: number;
  /** Reviewed low-frequency publishers: keep actual dates of latest older posts. */
  includeArchive?: boolean;
  /** Restrict discovery to reviewed feeds (e.g. one publisher's news section). */
  feedOnly?: boolean;
  /** Explicit transport for publishers whose public TLS endpoint rejects Node. */
  transport?: 'curl';
  /** Per-request allowance for reviewed slow publishers, capped at 20 seconds. */
  requestTimeoutMs?: number;
  /** Article-level provider credit required for reviewed syndication sources. */
  provider?: string;
  /** Reviewed archive permalinks when a discontinued publisher has no listing. */
  articleUrls?: string[];
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
  strategy: 'rss' | 'sitemap' | 'html' | 'api' | 'none';
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
      visit(parsePublicJson($(script).text()));
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
  const site = newsSiteEvidence($, url);
  const printedPublication = parsePublished(site.publishedRaw);
  if ('preferPrintedPublication' in site && site.preferPrintedPublication === true && printedPublication) publishedAt = printedPublication;
  else publishedAt ??= printedPublication;
  title ??= site.title;
  isArticle ||= site.isArticle;
  // This publisher's article template labels news as Product in JSON-LD.
  // Ignore that label only on reviewed DOC article routes with scoped evidence.
  if (hostKey(new URL(url)) === 'my-formosa.com.tw' && site.isArticle && /^\/DOC_\d+\.htm$/.test(new URL(url).pathname)) isProduct = false;
  return { publishedAt, isArticle, isProduct, blocked, title };
}

// Inspect publisher-delivered JSON without executing page JavaScript. Hydration
// URLs are discovery hints only: article pages must still establish date/body.
function hydrationLinks($: cheerio.CheerioAPI): Array<{ url: string; title: string }> {
  const links = new Map<string, string>();
  let visited = 0;
  const visit = (value: unknown, depth = 0) => {
    if (++visited > 18000 || depth > 18) return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, depth + 1);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    const title = [node.title, node.headline, node.name].find((x) => typeof x === 'string') as string | undefined;
    for (const key of ['url', 'href', 'link', 'articleUrl', 'shareUrl', 'permalink', 'web_url', 'canonical_url']) {
      if (typeof node[key] === 'string') links.set(node[key] as string, title ?? '');
    }
    for (const child of Object.values(node)) visit(child, depth + 1);
  };
  const parse = (raw: string) => {
    try {
      visit(JSON.parse(raw));
    } catch {
      /* Not all script data is JSON. */
    }
  };
  for (const script of $('script:not([src])').toArray()) {
    const raw = $(script).text();
    if (raw.length > 6 * 1024 * 1024) continue;
    if (/json/i.test($(script).attr('type') ?? '') || /^\s*[[{]/.test(raw)) parse(raw);
    for (const match of raw.matchAll(/self\.__next_f\.push\(\[\d+,((?:"(?:[^"\\]|\\.)*"))\]\)/g)) {
      try {
        const text = JSON.parse(match[1]) as string;
        for (const line of text.split('\n')) parse(line.replace(/^[\da-f]+:/i, ''));
      } catch {
        /* Malformed transport data is ignored. */
      }
    }
    // Assignment-based hydration can be non-JSON. Read quoted URL fields only;
    // never evaluate script code or treat its date strings as publication time.
    for (const match of raw.matchAll(/["'](?:url|href|link|articleUrl|shareUrl)["']\s*:\s*("(?:[^"\\]|\\.)*")/g)) {
      try {
        const url = JSON.parse(match[1]);
        if (typeof url === 'string' && !links.has(url)) links.set(url, '');
      } catch {
        /* Ignore invalid string. */
      }
    }
  }
  return [...links].slice(0, 1500).map(([url, title]) => ({ url, title }));
}

export async function discoverNews(config: NewsDiscoveryConfig, options: NewsDiscoveryOptions = {}): Promise<NewsDiscoveryResult> {
  const result: NewsDiscoveryResult = { items: [], errors: [], strategy: 'none', listingUrl: null, attempted: 0, samples: [] };
  const home = absolute(config.homeUrl, config.homeUrl);
  if (!home) return { ...result, errors: ['Invalid home URL'] };
  if (/^https:\/\/www\.msn\.com\/zh-tw\/news\/?(?:\?|$)/.test(home)) return discoverMsn(config, options);
  if (/^https:\/\/pnn\.tw\/?$/.test(home)) return discoverPnn(config, options);
  const allowedHosts = new Set([hostKey(new URL(home))]);
  for (const host of config.articleHosts ?? []) {
    if (/^[a-z0-9.-]+$/i.test(host)) allowedHosts.add(host.toLowerCase().replace(/^www\./, ''));
  }
  const belongs = (url: string) => allowedHosts.has(hostKey(new URL(url)));
  const fetcher = options.fetch && options.fetch !== fetchText ? options.fetch : config.transport === 'curl' ? fetchViaCurl : fetchText;
  const maxRequests = Math.max(1, Math.min(options.maxRequests ?? 18, 60));
  const maxArticles = Math.max(1, Math.min(config.maxArticles ?? 10, 30));
  const deadline = Date.now() + Math.max(1, options.timeoutMs ?? 45000);
  const now = (options.now?.() ?? new Date()).getTime();
  const recent = (date: Date | null) =>
    date && date.getTime() >= (config.includeArchive ? 0 : now - 14 * 86400000) && date.getTime() <= now + 3600000;
  const fetched = new Map<string, FetchResult | null>();
  const validated = new Set<string>();
  const accepted = new Set<string>();
  const unavailablePublicPages = new Set<string>();
  const rejected = new Map<string, { count: number; url: string }>();
  const reject = (reason: string, url: string) => {
    const prior = rejected.get(reason);
    rejected.set(reason, { count: (prior?.count ?? 0) + 1, url: prior?.url ?? url });
  };
  let stopped = false;
  let provider: RegExp | undefined;
  try {
    provider = config.provider ? new RegExp(config.provider, 'i') : undefined;
  } catch {
    return { ...result, errors: ['Invalid provider pattern'] };
  }
  let pattern: RegExp | undefined;
  try {
    pattern = config.articlePattern ? new RegExp(config.articlePattern) : undefined;
  } catch {
    result.errors.push('Invalid articlePattern; using generic discovery');
  }
  const budget = () => !stopped && result.attempted < maxRequests && Date.now() < deadline && result.items.length < maxArticles;
  const inArticleScope = (url: string) => {
    const parsed = new URL(url);
    return belongs(url) && articlePath(url) && (!pattern || pattern.test(parsed.pathname + parsed.search));
  };
  const get = async (url: string) => {
    if (fetched.has(url)) return fetched.get(url) ?? null;
    if (!budget()) return null;
    result.attempted++;
    fetched.set(url, null);
    try {
      const response = await fetcher(url, {
        timeout: Math.max(1, Math.min(Math.max(1000, Math.min(config.requestTimeoutMs ?? 8000, 20000)), deadline - Date.now())),
        retries: 0,
        maxBytes: 8 * 1024 * 1024,
      });
      if (response.status === 429) stopped = true;
      if (response.status < 200 || response.status >= 300) {
        if ([403, 404, 410].includes(response.status)) unavailablePublicPages.add(url);
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
  const acceptContent = (
    candidate: FeedItem,
    url: string,
    title: string,
    publishedAt: Date,
    detail: ReturnType<typeof extractArticle>,
    strategy: Exclude<NewsDiscoveryResult['strategy'], 'none'>,
    listingUrl: string,
    bodySource = detail.bodySource,
  ) => {
    if (accepted.has(url) || !detail.body || detail.bodyStatus !== 'ok') return;
    if (provider && !provider.test(detail.provider ?? '')) {
      reject('article provider does not match source', url);
      return;
    }
    accepted.add(url);
    result.items.push({
      ...candidate,
      url,
      title,
      publishedAt,
      image: detail.image ?? candidate.image,
      tags: detail.tags.length ? detail.tags : candidate.tags,
      verifiedContent: { body: detail.body, authors: detail.authors, bodySource, bodyStatus: 'ok' },
    });
    result.samples.push({
      url,
      title,
      publishedAt: publishedAt.toISOString(),
      bodyLength: Array.from(detail.body.replace(/\s/g, '')).length,
    });
    if (result.strategy === 'none') {
      result.strategy = strategy;
      result.listingUrl = listingUrl;
    }
  };
  const validate = async (candidate: FeedItem, strategy: 'rss' | 'sitemap' | 'html', listingUrl: string) => {
    const url = absolute(candidate.url, listingUrl);
    const validationKey = `${url}\t${candidate.publishedAt?.getTime() ?? ''}`;
    if (!url || !inArticleScope(url) || validated.has(validationKey) || !budget()) return;
    validated.add(validationKey);
    if (candidate.publishedAt && !recent(candidate.publishedAt)) {
      reject('feed publication outside14days', url);
      return;
    }
    const response = await get(url);
    if (!response) {
      if (
        !stopped &&
        unavailablePublicPages.has(url) &&
        config.feedBody === 'full-text' &&
        strategy === 'rss' &&
        candidate.contentHtml &&
        recent(candidate.publishedAt) &&
        candidate.title.length >= 4
      ) {
        const raw = candidate.contentHtml;
        if (/繼續閱讀|閱讀全文|阅读全文|read more|continue reading|subscriber.only|訂閱.{0,15}全文/i.test(cheerio.load(raw).text())) {
          reject('RSS excerpt marker', url);
          return;
        }
        const rendered = `<article><div itemprop="articleBody">${raw}</div></article>`;
        const content = extractArticle(rendered, url);
        if (pageEvidence(cheerio.load(rendered), url, rendered).blocked) {
          reject('RSS restricted content', url);
          return;
        }
        if (content.bodyStatus === 'ok' && content.body && Array.from(content.body.replace(/\s/g, '')).length >= 200) {
          acceptContent(candidate, url, candidate.title, candidate.publishedAt!, content, 'rss', listingUrl, 'rss:content:encoded');
        } else reject('RSS content is not complete public text', url);
      }
      return;
    }
    if (!inArticleScope(response.url)) {
      reject('redirect outside source article scope', response.url);
      return;
    }
    const articleHtml = publicArticleHtml(response.body, response.url);
    const $ = cheerio.load(articleHtml);
    if (hostKey(new URL(response.url)) === 'nommagazine.com' && /本文為精彩摘要[，,]\s*欲下載完整/.test($('.zh-content').text())) {
      reject('publisher labels body as excerpt', url);
      return;
    }
    const detail = extractArticle(articleHtml, response.url);
    const evidence = pageEvidence($, response.url, articleHtml);
    let canonical = detail.canonical ? absolute(detail.canonical, response.url) : response.url;
    const rawOgUrl = $('meta[property="og:url"]').attr('content') ?? '';
    // i-media's template emits https:///Article/Detail/:id (missing host).
    // Preserve the fetched URL only when the malformed field repeats its exact
    // reviewed article path; valid external canonical URLs remain rejected.
    if (
      hostKey(new URL(response.url)) === 'i-media.tw' &&
      evidence.isArticle &&
      /^https?:\/\/\/Article\/Detail\/\d+$/.test(rawOgUrl) &&
      rawOgUrl.replace(/^https?:\/\/\//, '/') === new URL(response.url).pathname
    )
      canonical = response.url;
    // These reviewed publisher templates drop .php from OG URLs, producing
    // a route that redirects away or loses the article.
    // Repair only this observed shape when both URLs name the same news ID.
    const fetchedUrl = new URL(response.url);
    if (
      hostKey(fetchedUrl) === 'tnews.cc' &&
      /^\/[\w]+\/News\/View\/\d+$/i.test(fetchedUrl.pathname) &&
      evidence.isArticle &&
      !$('link[rel="canonical"]').length &&
      canonical &&
      new URL(canonical).origin === fetchedUrl.origin &&
      new URL(canonical).pathname === '/' &&
      $('meta[property="og:url"]')
        .toArray()
        .some((node) => absolute($(node).attr('content') ?? '', response.url) === response.url)
    )
      canonical = response.url;
    if (
      ['biao-news.com', 'lai-media.net', 'nvns.net'].includes(hostKey(fetchedUrl)) &&
      evidence.isArticle &&
      fetchedUrl.pathname === '/news_view.php' &&
      canonical &&
      !$('link[rel="canonical"]').length
    ) {
      const declared = new URL(canonical);
      const id = fetchedUrl.searchParams.get('new_sn');
      if (hostKey(declared) === hostKey(fetchedUrl) && declared.pathname === '/news_view') {
        if (!id || !/^\d+$/.test(id) || declared.searchParams.get('new_sn') !== id) {
          reject('Publisher canonical article ID mismatch', response.url);
          return;
        }
        canonical = response.url;
      }
    }
    if (!canonical || !inArticleScope(canonical)) {
      reject('canonical outside source article scope', response.url);
      return;
    }
    if (accepted.has(canonical)) return;
    const publishedAt = evidence.publishedAt ?? candidate.publishedAt;
    const title = (evidence.title || detail.title || $('h1').first().text() || candidate.title).replace(/\s+/g, ' ').trim();
    const bodyLength = Array.from((detail.body ?? '').replace(/\s/g, '')).length;
    const reason =
      evidence.blocked || detail.bodyStatus === 'blocked'
        ? 'paywall or blocked page'
        : evidence.isProduct
          ? 'product page'
          : !publishedAt
            ? 'missing publication date'
            : !recent(publishedAt)
              ? 'publication outside14days'
              : title.length < 4
                ? 'missing article title'
                : detail.bodyStatus !== 'ok' || bodyLength < 120
                  ? `article body ${detail.bodyStatus} (${bodyLength}chars)`
                  : null;
    if (reason) {
      reject(reason, url);
      return;
    }
    // A dated page must still have article structure. This excludes navigation
    // and large product/listing pages carrying a generic global timestamp.
    if (!evidence.isArticle && !$('h1').length && !(strategy === 'rss' && candidate.title)) {
      reject('missing article structure', url);
      return;
    }
    if ($('article').length > 3 && !evidence.isArticle) {
      reject('article listing page', url);
      return;
    }
    acceptContent(candidate, canonical, title, publishedAt!, detail, strategy, listingUrl);
  };
  const scanFeed = async (url: string, cap: number) => {
    const response = await get(url);
    if (!response) return [] as string[];
    // Atom updated is modification time, just like sitemap lastmod.
    const parsed = parseFeed(response.body.replace(/<updated(?:\s[^>]*)?>[^<]*<\/updated>/gi, ''));
    const strategy = parsed.kind === 'sitemap' ? 'sitemap' : 'rss';
    const textPriority = (item: FeedItem) =>
      hostKey(new URL(item.url)) === 'news.qq.com' && /\/\d{8}A/.test(new URL(item.url).pathname) ? 1 : 0;
    const ordered = [...parsed.items].sort(
      (a, b) =>
        textPriority(b) - textPriority(a) ||
        (b.publishedAt?.getTime() ?? b.modifiedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? a.modifiedAt?.getTime() ?? 0),
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

  const reportNoArticles = (message: string) => {
    for (const [reason, info] of rejected) result.errors.push(`${reason}: ${info.count} candidate(s), e.g. ${info.url}`);
    if (result.attempted >= maxRequests) result.errors.push(`Request budget exhausted (${maxRequests})`);
    if (Date.now() >= deadline) result.errors.push('Source time budget exhausted');
    result.errors.push(message);
  };

  // Reviewed China Taiwan Net's official Sina account. Its public profile
  // bundle uses this listing endpoint; feed timestamps never replace article dates.
  if (home === 'https://k.sina.cn/media_m_1776346.html') {
    const endpoint = 'https://k.sina.cn/aj/newmedia/list?source=js&muid=1776346&page=1';
    const response = await get(endpoint);
    if (response) {
      try {
        const data = JSON.parse(response.body);
        if (data.status !== 0 || !Array.isArray(data.data)) throw new Error('Unexpected publisher feed');
        for (const row of data.data) {
          if (!budget()) break;
          if (row.mediaTypes !== 'news' || typeof row.link !== 'string') continue;
          const target = new URL(row.link);
          if (!['news.sina.com.cn', 'news.sina.cn'].includes(target.hostname)) continue;
          if (!/^https?:$/.test(target.protocol) || target.username || target.password) continue;
          target.protocol = 'https:';
          await validate({ url: target.href, title: typeof row.title === 'string' ? row.title : '', publishedAt: null }, 'html', endpoint);
        }
      } catch {
        result.errors.push('Invalid official Sina account listing');
      }
    }
    if (!result.items.length) reportNoArticles('No verified article from official Sina account');
    return result;
  }

  if (config.feedOnly) {
    for (const raw of config.feedUrls ?? []) {
      const url = absolute(raw, home);
      if (url && budget()) await scanFeed(url, maxRequests);
    }
    if (!result.items.length) reportNoArticles('No verified article in configured feeds');
    return result;
  }

  if (config.articleUrls?.length) {
    for (const url of config.articleUrls) await validate({ url, title: '', publishedAt: null }, 'html', home);
    if (!result.items.length) reportNoArticles('No verified article at configured archive URLs');
    return result;
  }

  // WordPress's public REST posts expose the publisher's full rendered body.
  // Only explicitly configured endpoints are read; protected/password posts and
  // summaries are excluded and links retain the original publisher identity.
  for (const raw of config.apiUrls ?? []) {
    if (!budget()) break;
    const apiUrl = absolute(raw, home);
    if (!apiUrl) continue;
    const response = await get(apiUrl);
    if (!response) continue;
    try {
      const records = JSON.parse(response.body);
      if (!Array.isArray(records)) {
        reject('public REST response is not a posts list', apiUrl);
        continue;
      }
      for (const row of records) {
        if (result.items.length >= maxArticles || stopped) break;
        const url = typeof row.link === 'string' ? absolute(row.link, home) : null;
        if (!url || !inArticleScope(url) || accepted.has(url)) continue;
        const content = row.content;
        const date = typeof row.date_gmt === 'string' ? row.date_gmt : '';
        const publishedAt = parsePublished(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(date) ? `${date}Z` : date);
        const title = typeof row.title?.rendered === 'string' ? cheerio.load(row.title.rendered).text().trim() : '';
        if (
          content?.protected !== false ||
          row.password ||
          (row.status && row.status !== 'publish') ||
          typeof content?.rendered !== 'string' ||
          !recent(publishedAt) ||
          title.length < 4
        ) {
          reject('REST article protected or missing publication fields', url);
          continue;
        }
        const plain = cheerio.load(content.rendered).text().trim();
        if (typeof row.excerpt?.rendered === 'string' && plain === cheerio.load(row.excerpt.rendered).text().trim()) {
          reject('REST content is an excerpt', url);
          continue;
        }
        const rendered = `<article><div itemprop="articleBody">${content.rendered}</div></article>`;
        const detail = extractArticle(rendered, url);
        if (pageEvidence(cheerio.load(rendered), url, rendered).blocked) {
          reject('REST restricted content', url);
          continue;
        }
        if (detail.bodyStatus !== 'ok') {
          reject(`REST body ${detail.bodyStatus}`, url);
          continue;
        }
        acceptContent({ url, title, publishedAt }, url, title, publishedAt!, detail, 'api', apiUrl, 'api:wordpress');
      }
    } catch {
      result.errors.push(`${apiUrl}: invalid public REST posts JSON`);
    }
  }
  if (result.items.length >= maxArticles) return result;

  // Official public JSON used by Hakka TV's own Vue application. These exact
  // endpoints require no token; do not consult member/admin or video APIs.
  if (hostKey(new URL(home)) === 'hakkatv.org.tw') {
    const listing = 'https://api.hakkatv.org.tw/api/news/index?per=12&sort[created_at]=desc';
    const response = await get(listing);
    if (response) {
      try {
        const rows = JSON.parse(response.body).data;
        for (const row of Array.isArray(rows) ? rows : []) {
          if (!budget()) break;
          if (!/^\d{10,}$/.test(String(row.id)) || row.status !== 1 || !recent(parsePublished(row.created_at))) continue;
          const articleUrl = new URL(`/news-detail/${row.id}`, home).href;
          const response = await get(`https://api.hakkatv.org.tw/api/news/read/${row.id}`);
          if (!response) continue;
          const record = JSON.parse(response.body);
          const publishedAt = parsePublished(record.created_at);
          if (
            String(record.id) !== String(row.id) ||
            record.status !== 1 ||
            !recent(publishedAt) ||
            typeof record.title !== 'string' ||
            record.title.length < 4 ||
            typeof record.content !== 'string'
          ) {
            reject('invalid public API article identity/date', articleUrl);
            continue;
          }
          const structured = JSON.stringify({
            '@type': 'NewsArticle',
            url: articleUrl,
            headline: record.title,
            articleBody: record.content,
            author: record.author ? { '@type': 'Person', name: record.author } : undefined,
          }).replace(/</g, '\\u003c');
          const detail = extractArticle(`<script type="application/ld+json">${structured}</script>`, articleUrl);
          if (detail.bodyStatus !== 'ok') {
            reject(`public API body ${detail.bodyStatus}`, articleUrl);
            continue;
          }
          acceptContent(
            {
              url: articleUrl,
              title: record.title,
              publishedAt,
              tags: Array.isArray(record.tag)
                ? record.tag.map((x: { tag?: string }) => x.tag).filter((x: unknown): x is string => typeof x === 'string')
                : undefined,
            },
            articleUrl,
            record.title,
            publishedAt!,
            detail,
            'api',
            listing,
            'api:hakkatv',
          );
        }
      } catch {
        result.errors.push('Invalid Hakka TV public news API response');
      }
    }
    if (result.items.length) return result;
  }

  // Miin's anonymous news feed and story endpoints are the same public API
  // used by /feed/news and /story/:id. Keep Miin's own author and article URL;
  // do not substitute the linked partner publishers or their full articles.
  if (hostKey(new URL(home)) === 'miin.cc') {
    const listing = 'https://api.miin.cc/web/feed/v3/news/story:list?limit=12&category=top';
    const response = await get(listing);
    if (response) {
      try {
        const rows = JSON.parse(response.body).stories;
        for (const row of Array.isArray(rows) ? rows : []) {
          if (!budget()) break;
          if (!Number.isSafeInteger(row.storyId) || row.state !== 'normal') continue;
          const articleUrl = new URL(`/story/${row.storyId}`, home).href;
          const response = await get(`https://api.miin.cc/web/story/v3/story?storyId=${row.storyId}`);
          if (!response) continue;
          const record = JSON.parse(response.body).story;
          const data = record?.data;
          const publishedAt = typeof data?.createAt === 'number' ? new Date(data.createAt * 1000) : null;
          if (
            record?.storyId !== row.storyId ||
            record?.state !== 'normal' ||
            !recent(publishedAt) ||
            !Array.isArray(data?.title) ||
            !Array.isArray(data?.content) ||
            data.content.some((span: { state?: string }) => span.state !== 'normal')
          ) {
            reject('invalid or restricted Miin story', articleUrl);
            continue;
          }
          const spanText = (spans: Array<{ text?: unknown; state?: string; type?: string }>) =>
            spans
              .filter((span) => span.state === 'normal' && span.type !== 'hashtag' && typeof span.text === 'string')
              .map((span) => span.text)
              .join('');
          const title = spanText(data.title).trim();
          const content = spanText(data.content);
          const author = data.author?.state === 'normal' ? data.author?.data?.nickname : undefined;
          if (title.length < 4) continue;
          const structured = JSON.stringify({
            '@type': 'NewsArticle',
            url: articleUrl,
            articleBody: content,
            author: typeof author === 'string' ? { '@type': 'Organization', name: author } : undefined,
          }).replace(/</g, '\\u003c');
          const detail = extractArticle(`<script type="application/ld+json">${structured}</script>`, articleUrl);
          if (detail.bodyStatus !== 'ok') {
            reject(`Miin body ${detail.bodyStatus}`, articleUrl);
            continue;
          }
          acceptContent({ url: articleUrl, title, publishedAt }, articleUrl, title, publishedAt!, detail, 'api', listing, 'api:miin');
        }
      } catch {
        result.errors.push('Invalid Miin public news API response');
      }
    }
    if (result.items.length) return result;
  }

  let homepage = await get(home);
  if (homepage && hostKey(new URL(homepage.url)) === 'daai.tv' && /^\/news(?:\/|$)/.test(new URL(homepage.url).pathname)) {
    // The official news listing embeds the complete modal story as a JSON
    // string. Its own updateUrlOnNewsModalOpen maps NewsID to /news/:NewsID.
    for (const match of homepage.body.matchAll(/var\s+news\s*=\s*'((?:\\.|[^'\\])*)'/g)) {
      if (result.items.length >= maxArticles || stopped) break;
      try {
        const raw = JSON.parse(`"${match[1].replace(/\\'/g, "'")}"`);
        const row = JSON.parse(raw.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t'));
        const publishedAt = parsePublished(row.NewsAirTime);
        if (
          !Number.isSafeInteger(row.NewsID) ||
          typeof row.Title !== 'string' ||
          row.Title.length < 4 ||
          typeof row.Description !== 'string' ||
          !recent(publishedAt)
        )
          continue;
        const url = new URL(`/news/${row.NewsID}`, homepage.url).href;
        const structured = JSON.stringify({ '@type': 'NewsArticle', url, articleBody: row.Description }).replace(/</g, '\\u003c');
        const detail = extractArticle(`<script type="application/ld+json">${structured}</script>`, url);
        if (detail.bodyStatus !== 'ok') {
          reject(`Daai modal body ${detail.bodyStatus}`, url);
          continue;
        }
        acceptContent(
          { url, title: row.Title, publishedAt },
          url,
          row.Title,
          publishedAt!,
          detail,
          'html',
          homepage.url,
          'html:daai-news-modal',
        );
      } catch {
        /* Malformed per-story data must not affect other news. */
      }
    }
    if (result.items.length) return result;
  }
  let base = home;
  const feedUrls = new Set<string>();
  for (const seed of config.feedUrls ?? []) {
    const url = absolute(seed, home);
    if (url) feedUrls.add(url);
  }
  const htmlCandidates = new Map<string, FeedItem & { score: number }>();
  const listingDates = new Map<string, number>();
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
      if (hostKey(new URL(base)) === 'graphics.thomsonreuters.com') {
        const date = parsePublished(anchor.find('small').text().trim());
        if (date) listingDates.set(url, date.getTime());
      }
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
      let publishedAt: Date | null = null;
      if (hostKey(new URL(base)) === 'idn.com.tw' && new URL(base).pathname === '/news/news_list.aspx') {
        const printed = anchor.closest('tr').find('td.body_9g').first().text().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(printed)) publishedAt = parsePublished(`${printed}T00:00:00+08:00`);
      }
      if (score || path.split('/').filter(Boolean).length >= 2 || title.length >= 16)
        if (score >= (htmlCandidates.get(url)?.score ?? -1)) htmlCandidates.set(url, { url, title, publishedAt, score });
    });
    for (const hint of hydrationLinks($)) {
      const url = absolute(hint.url, base);
      if (!url || !belongs(url) || !articlePath(url) || htmlCandidates.has(url)) continue;
      const parsed = new URL(url);
      if (pattern && !pattern.test(parsed.pathname + parsed.search)) continue;
      // A URL-only script hint needs an article-like route; generic config and
      // navigation links do not consume the article-fetch budget.
      const looksArticle =
        /\/(?:news|article|story|post|rain\/a)\//.test(parsed.pathname) || /\d{5,}|20\d{2}[/-]\d{2}/.test(parsed.pathname) || pattern;
      if (!looksArticle && hint.title.length < 8) continue;
      htmlCandidates.set(url, { url, title: hint.title.slice(0, 512), publishedAt: null, score: hint.title.length >= 8 ? 10 : 5 });
    }
    if (/wp-content|wp-includes|api\.w\.org/i.test(homepage.body)) feedUrls.add(new URL('/feed/', base).href);
  }
  const seededSitemaps: string[] = [];
  // Reserve discovery space for HTML/sitemaps if feeds are empty or stale.
  for (const url of [...feedUrls].slice(0, 3)) {
    if (!budget()) break;
    seededSitemaps.push(...(await scanFeed(url, 7)));
  }
  // These reviewed newspaper templates pin years-old stories above current
  // ones. Their increasing IDs rank discovery only; page dates still decide
  // whether an article is recent enough to accept.
  const serialHosts = new Set(['biao-news.com', 'nvns.net', 'lai-media.net', 'iw-times.com']);
  const serialHomeHost = hostKey(new URL(home));
  const articleSerial = (url: string): number | null => {
    const parsed = new URL(url);
    if (serialHomeHost === 'readr.tw' && hostKey(parsed) === serialHomeHost) {
      const id = /^\/post\/(\d+)$/.exec(parsed.pathname)?.[1];
      return id ? Number(id) : null;
    }
    if (!serialHosts.has(serialHomeHost) || hostKey(parsed) !== serialHomeHost || parsed.pathname !== '/news_view.php') return null;
    const id = parsed.searchParams.get('new_sn') ?? '';
    return /^\d{1,12}$/.test(id) ? Number(id) : null;
  };
  const htmlItems = [...htmlCandidates.values()].sort((a, b) => {
    if (serialHomeHost === 'graphics.thomsonreuters.com')
      return (listingDates.get(b.url) ?? 0) - (listingDates.get(a.url) ?? 0) || b.score - a.score;
    const aId = articleSerial(a.url);
    const bId = articleSerial(b.url);
    if (aId !== null && bId !== null) return bId - aId || b.score - a.score;
    if (aId !== null) return -1;
    if (bId !== null) return 1;
    return b.score - a.score;
  });
  for (const item of htmlItems.slice(0, 6)) await validate(item, 'html', base);
  if (budget() && result.items.length < Math.min(maxArticles, 4)) {
    const robots = await get(new URL('/robots.txt', base).href);
    const sitemapUrls = new Set<string>(seededSitemaps);
    for (const match of robots?.body.matchAll(/^Sitemap:\s*(\S+)/gim) ?? []) {
      const url = absolute(match[1], base);
      if (url && belongs(url)) sitemapUrls.add(url);
    }
    sitemapUrls.add(new URL('/sitemap.xml', base).href);
    const sitemapScore = (url: string) =>
      (/news|article|post/i.test(url) ? 5 : 0) +
      (/zh-tw|zh-hant/i.test(url) ? 4 : 0) -
      (/casualgames|products?|images?|videos?|categories|tags/i.test(url) ? 20 : 0);
    const queue = [...sitemapUrls].filter((url) => sitemapScore(url) > -10).sort((a, b) => sitemapScore(b) - sitemapScore(a));
    const seen = new Set<string>();
    for (let i = 0; i < queue.length && seen.size < 4 && budget(); i++) {
      const url = queue[i];
      if (seen.has(url)) continue;
      seen.add(url);
      const children = await scanFeed(url, 5);
      // News and current post sitemaps get priority over category/media maps.
      children.sort((a, b) => sitemapScore(b) - sitemapScore(a));
      queue.splice(i + 1, 0, ...children.filter((child) => !seen.has(child) && sitemapScore(child) > -10));
    }
  }
  for (const item of htmlItems.slice(6)) {
    if (!budget()) break;
    await validate(item, 'html', base);
  }
  if (budget() && !feedUrls.size && result.items.length === 0) await scanFeed(new URL('/feed/', base).href, 5);
  if (!result.items.length) reportNoArticles('No article with verified title, publication date and body found');
  return result;
}
