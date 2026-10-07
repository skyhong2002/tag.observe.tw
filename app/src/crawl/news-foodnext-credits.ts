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
  const interviewWriter = /^採訪\s*[·‧]\s*撰文\s*=\s*([\p{Script=Han}]{2,5})$/u.exec(declaration);
  if (interviewWriter) {
    const authors = reporterNames(`文／${interviewWriter[1]}`);
    if (authors.length) return { authors, provider: null };
  }
  // The parenthesis explicitly gives this writer's Latin alias followed by
  // a biographical affiliation. It is not a second author or a prose mention.
  const biography =
    /^撰文\s*=\s*([\p{Script=Han}]{1,8}(?:[·‧・.][\p{Script=Han}]{1,8}){1,3})\s*\(([A-Za-zÀ-ž][A-Za-zÀ-ž.'’ -]{1,80}),\s*([^()]{4,200})\)$/u.exec(
      declaration,
    );
  if (biography && /(?:大學|研究所|研究中心|學家)[。.]?$/u.test(biography[3])) {
    const name = biography[1];
    if (reporterNames(`文／${name.replace(/‧/g, '·')}`).length && reporterNames(`文／${biography[2].trim()}`).length)
      return { authors: [name], provider: null };
  }
  const written = /^撰文\s*=\s*([\p{Script=Han}]{2,5}(?:\s*[、，,]\s*[\p{Script=Han}]{2,5}){0,5})$/u.exec(declaration);
  const authors = written ? reporterNames(`文／${written[1]}`) : [];
  return authors.length ? { authors, provider: null } : null;
}
