import type { CheerioAPI } from 'cheerio';
import { reporterNames } from './byline.ts';
import { urlKey } from './text.ts';

const compact = (value: string) => value.replace(/\s/g, '');

/** Own article identity, written paragraphs and the separately declared reporter slot. */
export function mdnKidsArticle($: CheerioAPI, value: string): { prose: string; author: string | null } | null {
  const url = new URL(value);
  if (
    !['www.mdnkids.com', 'mdnkids.com'].includes(url.hostname) ||
    url.pathname !== '/content.asp' ||
    !/^[a-z0-9]{10,24}$/i.test(url.searchParams.get('Link_String_') ?? '')
  )
    return null;
  const identity = $('meta[property="og:url"]').attr('content');
  try {
    if (!identity || urlKey(new URL(identity, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const main = $('.page_main_box');
  const heading = main.children('.col.col-md-12').children('.row').children('h2');
  if (
    main.length !== 1 ||
    heading.length !== 1 ||
    !heading.text().trim() ||
    !compact($('title').text()).startsWith(compact(heading.text()))
  )
    return null;
  const body = main
    .children('.col.col-md-12')
    .children('div')
    .filter((_, node) => $(node).children('p').length > 0);
  if (body.length !== 1) return null;
  const prose = body
    .children('p')
    .toArray()
    .map((node) => $(node).text())
    .join('\n\n');
  if (!prose.trim()) return null;
  const slot = heading.next('div').children('span');
  const credit = slot.text().trim();
  const own = /^([\p{Script=Han}]{2,5})[／/]\s*[\p{Script=Han}]{1,10}報導\s*[（(]\d{4}\/\d{1,2}\/\d{1,2}[）)]$/u.exec(credit);
  const author = slot.length === 1 && own && reporterNames(`作者：${own[1]}`).length === 1 ? own[1] : null;
  return { prose, author };
}

export function mdnKidsFullDescription($: CheerioAPI, url: string, summary: string): boolean {
  const own = mdnKidsArticle($, url);
  return own !== null && compact(own.prose) === compact(summary);
}
