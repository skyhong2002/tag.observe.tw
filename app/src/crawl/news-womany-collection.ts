import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** Collection pages publish an editorial introduction separate from linked story cards. */
export function womanyCollectionDescription($: CheerioAPI, value: string): string | null {
  const url = new URL(value);
  if (!['womany.net', 'www.womany.net'].includes(url.hostname) || !/^\/collections\/[^/?#]+$/.test(url.pathname)) return null;
  const main = $('.body > .container > div:has(> h1.seo-title)').first();
  if (!main.length) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const paragraphs: string[] = [];
  for (const section of main.children('section.component').toArray()) {
    const node = $(section);
    if (!['editor', 'emphasis', 'youtube', 'qa-fold', 'gallery', 'feature-intro'].some((type) => node.hasClass(type))) continue;
    const descriptions = node.children('.container').children('p.description');
    const hasDesktop = descriptions.toArray().some((p) => $(p).hasClass('desktop'));
    for (const paragraph of descriptions.toArray()) {
      if (hasDesktop && $(paragraph).hasClass('mobile')) continue;
      const text = $(paragraph).text().replace(/\s+/g, ' ').trim();
      if (text) paragraphs.push(text);
    }
  }
  return paragraphs.length ? paragraphs.join('\n\n') : null;
}
