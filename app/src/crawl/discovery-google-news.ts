import { isIP } from 'node:net';
import * as cheerio from 'cheerio';
import { parseFeed } from './feed.ts';
import { fetchText, isPublicAddress } from './fetch.ts';

export interface GoogleNewsCandidate {
  url: string;
  title: string;
  discoveryUrl: string;
}

export interface GoogleNewsDiscoveryResult {
  items: GoogleNewsCandidate[];
  errors: string[];
  attempted: number;
}

export type GoogleNewsBrowserResolver = (url: string) => Promise<{ url: string | null; blocked: boolean }>;

const DEFAULT_RSS = 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant';
const googleHost = (host: string) =>
  /(^|\.)(google\.(?:[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})|googleusercontent\.com|gstatic\.com)$/.test(host);
const normalizedTitle = (value: string) => value.replace(/\s+/g, ' ').trim();

function safeUrl(value: string, base?: string): URL | null {
  try {
    const url = new URL(value, base);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (/(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/.test(host)) return null;
    if (isIP(host) && !isPublicAddress(host)) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function publisherUrl(value: string, base?: string): string | null {
  let url = safeUrl(value, base);
  if (!url) return null;
  // Older Google public links disclose the destination in a query parameter.
  // Opaque article tokens are deliberately not decoded using internal RPCs.
  if (['news.google.com', 'www.google.com'].includes(url.hostname) && ['/url', '/news/url'].includes(url.pathname))
    url = safeUrl(url.searchParams.get('url') ?? url.searchParams.get('q') ?? '');
  if (!url || googleHost(url.hostname) || url.pathname === '/') return null;
  return url.href;
}

function wrapper(value: string): boolean {
  const url = safeUrl(value);
  return !!url && url.hostname === 'news.google.com' && /^\/(?:rss\/)?(?:articles|read)\/[^/]+\/?$/.test(url.pathname);
}

function guarded(body: string, url: string, status: number): boolean {
  return (
    status === 429 ||
    status === 403 ||
    /(?:accounts|consent)\.google\.com\//.test(url) ||
    /google\.com\/sorry\//.test(url) ||
    /Our systems have detected unusual traffic|unusual traffic from your computer network|g-recaptcha/.test(body)
  );
}

/** Let Google's unmodified public page navigate normally. No private RPC is
 * constructed. Never load the publisher in Chromium: capture and abort the
 * top-level request, then let the caller's guarded HTTP crawler verify it. */
export const resolveGoogleNewsInBrowser: GoogleNewsBrowserResolver = async (url) => {
  if (!wrapper(url)) return { url: null, blocked: false };
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, timeout: 10000 });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const context = await browser.newContext({ locale: 'zh-TW', serviceWorkers: 'block' });
    const page = await context.newPage();
    let destination: string | null = null;
    let blocked = false;
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    timer = setTimeout(finish, 15000);
    await context.route('**/*', async (route) => {
      const request = route.request();
      const target = safeUrl(request.url());
      if (!target || guarded('', request.url(), 200)) {
        blocked = true;
        finish();
        await route.abort();
        return;
      }
      if (!googleHost(target.hostname)) {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
          destination = publisherUrl(target.href);
          finish();
        }
        await route.abort();
        return;
      }
      await route.continue();
    });
    page.on('response', (response) => {
      if ([403, 429].includes(response.status())) {
        blocked = true;
        finish();
      }
    });
    // A captured publisher navigation is intentionally aborted. Both that
    // navigation rejection and browser timeout are consumed without retry.
    void page
      .goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      .then(async () => {
        if (guarded(await page.content(), page.url(), 200)) {
          blocked = true;
          finish();
        }
      })
      .catch(() => finish());
    await finished;
    return { url: blocked ? null : destination, blocked };
  } finally {
    clearTimeout(timer);
    await browser.close();
  }
};

/** Discover publisher candidates only. Dates, full text and publisher identity
 * must be independently verified by the publisher ingestion path. */
export async function discoverGoogleNews(
  {
    rssUrl = DEFAULT_RSS,
    htmlUrl,
    maxItems = 20,
    maxRequests = 8,
  }: { rssUrl?: string; htmlUrl?: string; maxItems?: number; maxRequests?: number } = {},
  { fetch = fetchText, resolveInBrowser }: { fetch?: typeof fetchText; resolveInBrowser?: GoogleNewsBrowserResolver } = {},
): Promise<GoogleNewsDiscoveryResult> {
  const result: GoogleNewsDiscoveryResult = { items: [], errors: [], attempted: 0 };
  const itemLimit = Number.isFinite(maxItems) ? Math.max(0, Math.min(100, Math.floor(maxItems))) : 20;
  const requestLimit = Number.isFinite(maxRequests) ? Math.max(0, Math.min(30, Math.floor(maxRequests))) : 8;
  if (!itemLimit || !requestLimit) return result;
  const seen = new Set<string>();
  const queued = new Set<string>();
  const candidates: Array<{ url: string; title: string; discoveryUrl: string }> = [];
  const enqueue = (url: string, title: string, discoveryUrl: string) => {
    title = normalizedTitle(title);
    if (!title || queued.has(url) || candidates.length >= 100) return;
    queued.add(url);
    candidates.push({ url, title, discoveryUrl });
  };
  let stopped = false;
  let budgetReached = false;
  const read = async (url: string) => {
    if (stopped) return null;
    if (result.attempted >= requestLimit) {
      budgetReached = true;
      return null;
    }
    result.attempted++;
    try {
      const response = await fetch(url, { timeout: 15000, retries: 0 });
      if (guarded(response.body, response.url, response.status)) {
        result.errors.push(`${url}: access restriction (${response.status}); stopped without retry`);
        stopped = true;
        return null;
      }
      if (response.status < 200 || response.status >= 300) {
        result.errors.push(`${url}: HTTP ${response.status}`);
        return null;
      }
      return response;
    } catch (error) {
      result.errors.push(`${url}: ${String((error as Error).message)}`);
      return null;
    }
  };
  for (const [url, kind] of [
    [rssUrl, 'rss'],
    [htmlUrl, 'html'],
  ] as const) {
    if (!url) continue;
    const entry = safeUrl(url);
    if (entry?.hostname !== 'news.google.com' || (kind === 'rss' && !/^\/rss(?:\/|$)/.test(entry.pathname))) {
      result.errors.push(`${url}: expected an official Google News ${kind} URL`);
      continue;
    }
    const response = await read(entry.href);
    if (!response) continue;
    // A feed/listing redirect to another site is not evidence that its links
    // were actually discovered on Google News.
    if (safeUrl(response.url)?.hostname !== 'news.google.com') {
      result.errors.push(`${url}: listing left Google News`);
      continue;
    }
    if (kind === 'rss') {
      const feed = parseFeed(response.body);
      if (feed.kind !== 'rss' && feed.kind !== 'atom') result.errors.push(`${url}: not a news feed`);
      else for (const item of feed.items) enqueue(item.url, item.title, wrapper(item.url) ? item.url : entry.href);
    } else {
      const $ = cheerio.load(response.body);
      // Only headline links, never publisher home links, menus or arbitrary
      // external links elsewhere in the page.
      $('article a[href], h3 a[href], h4 a[href], a[href]:has(h3), a[href]:has(h4)').each((_, node) => {
        const href = safeUrl($(node).attr('href') ?? '', response.url)?.href;
        if (href && (wrapper(href) || publisherUrl(href))) enqueue(href, $(node).text(), wrapper(href) ? href : entry.href);
      });
    }
  }
  for (const candidate of candidates) {
    if (stopped || result.items.length >= itemLimit) break;
    let original = publisherUrl(candidate.url);
    if (!original && wrapper(candidate.url)) {
      const response = await read(candidate.url);
      if (!response) continue;
      original = publisherUrl(response.url);
      if (!original && safeUrl(response.url)?.hostname === 'news.google.com') {
        const $ = cheerio.load(response.body);
        const destinations = new Set<string>();
        const add = (value: string | undefined) => {
          const target = value && publisherUrl(value, response.url);
          if (target) destinations.add(target);
        };
        $('link[rel="canonical"][href]').each((_, node) => add($(node).attr('href')));
        $('meta[http-equiv]').each((_, node) => {
          if ($(node).attr('http-equiv')?.toLowerCase() !== 'refresh') return;
          const value = /^\s*\d+(?:\.\d+)?\s*;\s*url\s*=\s*(.*?)\s*$/i.exec($(node).attr('content') ?? '')?.[1];
          add(value?.replace(/^(['"])(.*)\1$/, '$2'));
        });
        $('a[href]').each((_, node) => {
          if (normalizedTitle($(node).text()) === candidate.title) add($(node).attr('href'));
        });
        if (destinations.size === 1) original = [...destinations][0];
      }
      if (!original && resolveInBrowser && result.attempted >= requestLimit) budgetReached = true;
      if (!original && resolveInBrowser && result.attempted < requestLimit) {
        result.attempted++;
        try {
          const resolved = await resolveInBrowser(candidate.url);
          if (resolved.blocked) {
            result.errors.push(`${candidate.url}: browser access restriction; stopped without retry`);
            stopped = true;
          } else if (resolved.url) original = publisherUrl(resolved.url);
        } catch (error) {
          result.errors.push(`${candidate.url}: browser resolver failed: ${String((error as Error).message)}`);
          // Missing browser/runtime and startup failures must not repeatedly
          // spawn new processes for every item in the same feed.
          stopped = true;
        }
      }
      if (!original) result.errors.push(`${candidate.url}: unresolved public redirect; no publisher URL`);
    }
    if (!original || seen.has(original)) continue;
    seen.add(original);
    result.items.push({ url: original, title: candidate.title, discoveryUrl: candidate.discoveryUrl });
  }
  if (budgetReached) result.errors.push(`Google News request budget reached (${requestLimit})`);
  return result;
}
