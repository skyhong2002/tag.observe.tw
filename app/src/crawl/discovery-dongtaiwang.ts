import * as cheerio from 'cheerio';
import { fetchText } from './fetch.ts';

export const DONGTAIWANG_LISTING_URL = 'https://dongtaiwang.com/loc/phome.php?v=0';

export interface DongtaiwangCandidate {
  url: string;
  title: string;
  discoveryUrl: string;
}

// Only direct article permalinks observed on the public portal. In particular,
// Epoch's nf*.htm#ID points to a list, and /dm/, /dt/ and /dmirror/ are proxies.
// Do not infer a permalink, publisher identity or date from those wrappers.
const articlePaths: Record<string, RegExp> = {
  'epochtimes.com': /^\/(?:gb|b5)\/\d{2,4}\/\d{1,2}\/\d{1,2}\/n\d+\.htm$/,
  'ntdtv.com': /^\/(?:gb|b5)\/\d{4}\/\d{2}\/\d{2}\/a\d+\.html$/,
  'minghui.org': /^\/mh\/articles\/\d{4}\/\d{1,2}\/\d{1,2}\/[^/]+-\d+\.html$/,
  'cn.secretchina.com': /^\/news\/(?:gb|b5)\/\d{4}\/\d{2}\/\d{2}\/\d+\.html$/,
  'soundofhope.org': /^\/post\/\d+\/?$/,
  'renminbao.com': /^\/rmb\/articles\/\d{4}\/\d{1,2}\/\d{1,2}\/\d+\.html$/,
  'aboluowang.com': /^\/\d{4}\/\d{4}\/\d+\.html$/,
};

function reviewedListing(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'dongtaiwang.com' &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === '/loc/phome.php'
    );
  } catch {
    return false;
  }
}

export function parseDongtaiwangListing(html: string, discoveryUrl = DONGTAIWANG_LISTING_URL): DongtaiwangCandidate[] {
  if (!reviewedListing(discoveryUrl)) return [];
  const $ = cheerio.load(html);
  const items = new Map<string, DongtaiwangCandidate>();
  $('#three_two_left .content_list a[href]').each((_, node) => {
    const title = $(node).text().replace(/\s+/g, ' ').trim();
    if (title.length < 6 || $(node).closest('nav, footer, aside, .ad, .ads, .advertisement, [hidden]').length) return;
    try {
      const url = new URL($(node).attr('href')!, discoveryUrl);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return;
      const path = articlePaths[url.hostname.replace(/^www\./, '')];
      if (!path?.test(url.pathname)) return;
      url.hash = '';
      for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
      // Dates and full text must come from the publisher's subsequent validation.
      if (!items.has(url.href)) items.set(url.href, { url: url.href, title, discoveryUrl });
    } catch {
      // An invalid link cannot identify an original article.
    }
  });
  return [...items.values()];
}

export async function discoverDongtaiwang({
  fetch = fetchText,
  maxArticles = 60,
}: {
  fetch?: typeof fetchText;
  maxArticles?: number;
} = {}) {
  const result: { items: DongtaiwangCandidate[]; errors: string[]; listingUrl: string | null; attempted: number } = {
    items: [],
    errors: [],
    listingUrl: null,
    attempted: 1,
  };
  try {
    const response = await fetch(DONGTAIWANG_LISTING_URL, { timeout: 15000, retries: 0 });
    if (response.status !== 200) {
      result.errors.push(`Dongtaiwang listing HTTP ${response.status}`);
      return result;
    }
    if (!reviewedListing(response.url)) {
      result.errors.push('Dongtaiwang listing redirected outside the reviewed portal');
      return result;
    }
    result.listingUrl = response.url;
    const limit = Number.isFinite(maxArticles) ? Math.max(0, Math.min(100, Math.floor(maxArticles))) : 60;
    result.items = parseDongtaiwangListing(response.body, response.url).slice(0, limit);
    if (!result.items.length) result.errors.push('Dongtaiwang listing contains no reviewed original article links');
  } catch (error) {
    result.errors.push(`Dongtaiwang listing: ${error instanceof Error ? error.message : String(error)}`);
  }
  return result;
}
