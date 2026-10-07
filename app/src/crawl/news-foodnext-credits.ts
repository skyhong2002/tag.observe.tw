import type { CheerioAPI } from 'cheerio';
import { reporterNames } from './byline.ts';
import { urlKey } from './text.ts';

/** FoodNext puts its interview/writer declaration after a separate takeaways block. */
export function foodNextCredits($: CheerioAPI, value: string): { authors: string[]; provider: null } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!['www.foodnext.net', 'foodnext.net'].includes(url.hostname) || !/^\/(?:issue|news\/newsnow)\/paper\/\d+$/.test(url.pathname))
    return null;
  const canonical = $('link[rel="canonical"]').attr('href') ?? $('meta[property="og:url"]').attr('content');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const main = $('div:has(> h1):has(> .post-content)').first();
  if (!main.length) return null;
  const declaration = main.children('.post-content').children('p').first().text().normalize('NFKC').replace(/\s+/g, ' ').trim();
  const combined =
    /^採訪\s*=\s*([\p{Script=Han}]{2,5}(?:\s*[、，,]\s*[\p{Script=Han}]{2,5}){0,5})\s*撰文\s*=\s*([\p{Script=Han}]{2,5}(?:\s*[、，,]\s*[\p{Script=Han}]{2,5}){0,5})$/u.exec(
      declaration,
    );
  if (combined) {
    const reporters = reporterNames(`文／${combined[1]}`);
    const writers = reporterNames(`文／${combined[2]}`);
    if (reporters.length && writers.length) return { authors: [...new Set([...reporters, ...writers])], provider: null };
    return null;
  }
  if (/^撰文\s*=\s*食力企劃$/u.test(declaration)) return { authors: ['食力企劃'], provider: null };
  const written = /^撰文\s*=\s*([\p{Script=Han}]{2,5}(?:\s*[、，,]\s*[\p{Script=Han}]{2,5}){0,5})$/u.exec(declaration);
  const authors = written ? reporterNames(`文／${written[1]}`) : [];
  return authors.length ? { authors, provider: null } : null;
}
