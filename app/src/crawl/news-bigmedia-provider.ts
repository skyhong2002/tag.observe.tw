import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** Known wire organization explicitly credited in this own article's header. */
export function bigMediaProvider($: CheerioAPI, value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!['www.bigmedia.com.tw', 'bigmedia.com.tw'].includes(url.hostname) || !/^\/article\/\d+$/.test(url.pathname)) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const main = $('article.article-read-block .article-header:has(> h1)').first();
  if (!main.length) return null;
  const credit = main
    .children('.article-meta')
    .children('span')
    .map((_, node) => $(node).text().replace(/\s+/g, ' ').trim())
    .get();
  const declared = $('meta#articleAuthor[property="article:author"]').attr('content')?.trim();
  return credit.some((text) => /^鉅聞天下[｜|]作者\s+PR Newswire$/u.test(text)) && declared === '鉅聞天下｜PR Newswire'
    ? 'PR Newswire'
    : null;
}
