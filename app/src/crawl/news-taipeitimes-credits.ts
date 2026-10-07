import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** An agency in this paper's main byline supplies the story, not just a photo. */
export function taipeiTimesCredits($: CheerioAPI, value: string): { authors: string[]; provider: string } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    !['www.taipeitimes.com', 'taipeitimes.com'].includes(url.hostname) ||
    !/^\/News\/[^/]+\/archives\/\d{4}\/\d{2}\/\d{2}\/\d+$/.test(url.pathname)
  )
    return null;
  const canonical = $('link[rel="canonical"]').attr('href') ?? $('meta[property="og:url"]').attr('content');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const main = $('#left_blake > .archives');
  const byline = main.children('ul.boxTitle').children('li').children('.name');
  if (main.length !== 1 || main.children('h1').length !== 1 || byline.length !== 1) return null;
  const credit = byline.text().replace(/\s+/g, ' ').trim();
  const agency = /^(AFP|AP|Reuters), [A-Z][A-Z .'-]{1,60}(?:, [A-Z][A-Z .'-]{1,20})?$/u.exec(credit)?.[1];
  return agency ? { authors: [agency], provider: agency } : null;
}
