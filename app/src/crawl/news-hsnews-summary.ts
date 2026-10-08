import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** Remove only the own unresolved module suffix after a publisher-supplied, corroborated excerpt. */
export function hsNewsSummary($: CheerioAPI, value: string, summary: string): string | null {
  const url = new URL(value);
  if (!['hsnews.com.tw', 'www.hsnews.com.tw'].includes(url.hostname) || !/^\/[a-z-]+\/[^/]+\.html$/.test(url.pathname)) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const main = $('.article-details');
  const heading = main.children('.article-header').children('h1');
  const prose = main.children('div[itemprop="articleBody"]');
  const compact = (text: string) => text.replace(/\s/g, '');
  if (
    main.length !== 1 ||
    heading.length !== 1 ||
    prose.length !== 1 ||
    !heading.text().trim() ||
    compact($('meta[property="og:title"]').attr('content') ?? '') !== compact(heading.text())
  )
    return null;
  if (!/\s+\{loadmoduleid\.\.\.$/.test(summary)) return null;
  const excerpt = summary.replace(/\s+\{loadmoduleid\.\.\.$/, '');
  const first = prose.children('p').first();
  return first.length === 1 && excerpt.length >= 40 && compact(first.text()) === compact(excerpt) ? excerpt : null;
}
