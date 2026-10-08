import type { CheerioAPI } from 'cheerio';

/** The own numeric WordPress article and complete browser-title suffix corroborate its headline. */
export function contentPlatformTitle($: CheerioAPI, value: string): string | null {
  const url = new URL(value);
  const id = /^\/articles\/(\d+)\/[^/?]+\/$/.exec(url.pathname)?.[1];
  if (
    url.hostname !== 'www.contentplatform.info' ||
    !id ||
    $('link[rel="canonical"]').attr('href') !== value ||
    !($('body').attr('class') ?? '').split(/\s+/).includes(`postid-${id}`)
  )
    return null;
  const headings = $('.tdb-single-title h1.tdb-title-text');
  if (headings.length !== 1 || $('h1').length !== 1) return null;
  const headline = headings.text().replace(/\s+/g, ' ').trim();
  const browserTitle = $('title').text().replace(/\s+/g, ' ').trim();
  if (!headline || browserTitle !== `${headline} | 報新聞 Mega News`) return null;
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle && ogTitle.replace(/\s+/g, ' ').trim() !== browserTitle) return null;
  return headline;
}

/** Reviewed own RSS descriptions beginning with this explicit photo role are captions. */
export function contentPlatformFeedCaption(summary: string, value?: string): boolean {
  if (!value || !summary.startsWith('《圖說》')) return false;
  try {
    const url = new URL(value);
    return url.hostname === 'www.contentplatform.info' && /^\/articles\/\d+\/[^/?]+\/$/.test(url.pathname);
  } catch {
    return false;
  }
}
