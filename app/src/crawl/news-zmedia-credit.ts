import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** The reviewed website-design company's metadata is a template credit, separate from article writers. */
export function zMediaTechnicalCredit($: CheerioAPI, value: string): boolean {
  const url = new URL(value);
  if (!['www.zmedia.com.tw', 'zmedia.com.tw'].includes(url.hostname) || !/^\/Document\/NewsDetail\/\d+$/.test(url.pathname)) return false;
  const identity = $('meta[property="og:url"]').attr('content');
  try {
    if (!identity || urlKey(new URL(identity, value).href) !== urlKey(value)) return false;
  } catch {
    return false;
  }
  const heading = $('section.newsDetail .article-group > .info-group > p.title');
  const title = heading.text().trim();
  return (
    heading.length === 1 &&
    !!title &&
    $('meta[property="og:title"]').attr('content') === title &&
    $('title').text().trim().endsWith(title) &&
    $('meta[name="author"]').attr('content') === 'UDIGIT TECHNOLOGY CO.,LTD.'
  );
}
