import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** Own Drupal feature introduction, separate from the bundle's constituent news nodes. */
export function ithomeFeatureDescription($: CheerioAPI, value: string): { body: string; selector: string } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const id = /^\/article\/(\d+)$/.exec(url.pathname)?.[1];
  if (!['www.ithome.com.tw', 'ithome.com.tw'].includes(url.hostname) || !id) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const selector = `article#node-${id}.node-featured-story`;
  const main = $(selector);
  if (main.length !== 1 || !main.children('header').children('h1').length) return null;
  const body = main
    .children('.row-fluid')
    .children('.field-name-body')
    .children('.field-items')
    .children('.field-item')
    .children('p')
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
  return body ? { body, selector } : null;
}
