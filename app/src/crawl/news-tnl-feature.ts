import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** Album introductions are separate from production-team credits and linked stories. */
export function tnlFeatureDescription($: CheerioAPI, value: string): { body: string; selector: string } | null {
  const url = new URL(value);
  if (!['www.thenewslens.com', 'thenewslens.com'].includes(url.hostname) || !/^\/feature\/[^/?#]+$/.test(url.pathname)) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const main = $('article.album-list-wrapper');
  const intro = main.children('section').children('.intro-wrapper');
  if (main.length !== 1 || intro.length !== 1 || intro.children('.item-info').children('h1.item-title').length !== 1) return null;
  const selector = 'article.album-list-wrapper > section > .intro-wrapper > .item-info > p';
  const body = $(selector)
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
  const description = $('meta[name="description"]').attr('content')?.replace(/\s+/g, ' ').trim();
  return body && description === body.replace(/\s+/g, ' ') ? { body, selector } : null;
}
