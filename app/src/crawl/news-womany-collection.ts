import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** The quiz introduction is publisher content; the play counter is interaction UI. */
export function womanyQuizDescription($: CheerioAPI, value: string): string | null {
  const url = new URL(value);
  if (!['womany.net', 'www.womany.net'].includes(url.hostname) || !/^\/collections\/[^/?#]+$/.test(url.pathname)) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  if ($('h1.seo-title').length !== 1) return null;
  const quiz = $('.entry-content:has(> .header > h2.quiz-title):has(> .btn-group > a#quiz-start[href="#"])');
  if (quiz.length !== 1 || quiz.closest('aside, nav, footer').length) return null;
  const description = quiz.children('.description');
  if (description.length !== 1 || description.children('p.quiz-playtime-counter').length !== 1) return null;
  const intro = description.children('p:not(.quiz-playtime-counter)');
  if (intro.length !== 1) return null;
  const body = intro.text().replace(/\s+/g, ' ').trim();
  const summary = $('meta[name="description"]').attr('content')?.replace(/\s+/g, ' ').trim();
  return body && body === summary ? body : null;
}

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
