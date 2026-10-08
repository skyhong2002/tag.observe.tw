import type { CheerioAPI } from 'cheerio';
import { reporterNames } from './byline.ts';
import { urlKey } from './text.ts';

/** A complete own reporter line follows an exact repeated title in the post's first two paragraphs. */
export function peopoReporter($: CheerioAPI, value: string): { author: string; title: string; credit: string; report: string } | null {
  const url = new URL(value);
  if (!['www.peopo.org', 'peopo.org'].includes(url.hostname) || !/^\/news\/\d+$/.test(url.pathname)) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const main = $('#block-peopo-content article.node--type-post.node--view-mode-full');
  const heading = main.children('header').find('h1');
  const paragraphs = main.children('.node__content').children('.field--name-body').children('p');
  const title = heading.text().trim();
  const compact = (text: string) => text.replace(/\s/g, '');
  if (main.length !== 1 || heading.length !== 1 || !title || compact(paragraphs.first().text()) !== compact(title)) return null;
  const slot = paragraphs.eq(1).children('span').children('strong');
  const credit = slot.text().trim();
  const own = /^［記者[／/]([\p{Script=Han}]{2,5})[／/][\p{Script=Han}]{1,10}報導］$/u.exec(credit);
  const text = paragraphs.eq(1).text().trim();
  if (slot.length !== 1 || !own || !text.startsWith(credit) || reporterNames(`記者${own[1]}`).length !== 1) return null;
  const report = text.slice(credit.length).trim();
  return report.length >= 80 ? { author: own[1], title, credit, report } : null;
}

export function peopoSummary($: CheerioAPI, value: string, summary: string): string | null {
  const own = peopoReporter($, value);
  if (!own || !summary.startsWith(own.title)) return null;
  const tail = summary.slice(own.title.length).trim();
  if (!tail.startsWith(own.credit)) return null;
  const excerpt = tail.slice(own.credit.length).trim();
  const compact = (text: string) => text.replace(/\s/g, '');
  const prose = excerpt.replace(/(?:\.{3}|…)+$/, '');
  return prose.length >= 20 && compact(own.report).startsWith(compact(prose)) ? excerpt : null;
}
