import type { CheerioAPI } from 'cheerio';

const compact = (s: string) => s.normalize('NFKC').replace(/\s/g, '');
export function ngmSummary($: CheerioAPI, value: string, summary: string): string | null {
  const url = new URL(value);
  if (
    url.hostname !== 'www.natgeomedia.com' ||
    !/^\/[a-z]+\/article\/content-\d+\.html$/.test(url.pathname) ||
    $('meta[property="og:url"]').attr('content') !== value
  )
    return null;
  const heading = $('.content-title-area > h1.content-title');
  if (heading.length !== 1 || !heading.text().trim()) return null;
  const suffix = '- 國家地理雜誌中文網';
  if (compact($('meta[property="og:title"]').attr('content') ?? '') !== compact(heading.text() + ' ' + suffix)) return null;
  if (!summary.endsWith(suffix)) return null;
  const excerpt = summary.slice(0, -suffix.length).trim();
  const first = $('.art-w65-left article.text-black > p').first().text();
  return excerpt.length >= 40 && compact(first).startsWith(compact(excerpt)) ? excerpt : null;
}
