import type { CheerioAPI } from 'cheerio';

/** Own article IDs, dated paper source link and explicit reporter header or wire closing credit. */
export function peopleCredits($: CheerioAPI, value: string): { authors: string[]; provider: string } | null {
  const url = new URL(value);
  const path = /^\/n1\/(\d{4})\/(\d{2})(\d{2})\/c(\d+)-(\d+)\.html$/.exec(url.pathname);
  if (!/(?:^|\.)people\.com\.cn$/.test(url.hostname) || !path) return null;
  if (
    $('meta[name="contentid"]').attr('content') !== path[5] ||
    $('meta[name="catalogs"]').attr('content') !== path[4] ||
    $('meta[name="publishdate"]').attr('content') !== `${path[1]}-${path[2]}-${path[3]}`
  )
    return null;
  const main = $('.rm_txt > .col.col-1');
  const heading = main.children('h1');
  const body = main.children('.rm_txt_con').children('#rm_txt_zw');
  const source = /^来源：(人民日报(?:海外版)?)$/.exec($('meta[name="source"]').attr('content') ?? '')?.[1];
  if (
    main.length !== 1 ||
    heading.length !== 1 ||
    body.length !== 1 ||
    !heading.text().trim() ||
    !$('title').text().trim().startsWith(heading.text().trim()) ||
    !source
  )
    return null;
  const origin = main.children('.channel').children('.col-1-1').children('a');
  const edition = source === '人民日报海外版' ? 'rmrbhwb' : 'rmrb';
  if (origin.length !== 1 || origin.text().trim() !== '人民网－' + source) return null;
  try {
    const original = new URL(origin.attr('href') ?? '', value);
    const expected = new RegExp(`^/${edition}/pc/content/${path[1]}${path[2]}/${path[3]}/content_\\d+\\.html$`);
    if (original.hostname !== 'paper.people.com.cn' || !expected.test(original.pathname)) return null;
  } catch {
    return null;
  }
  const slot = main.children('.author.cf');
  if (slot.length !== 1) return null;
  const credit = slot.text().trim().replace(/\s+/g, ' ');
  // Two-character names are typeset with internal spacing in this paper's explicit reporter slot.
  const spaced = /^本报记者 ([\p{Script=Han}]) ([\p{Script=Han}]) ([\p{Script=Han}]{2,5})$/u.exec(credit);
  if (spaced) return { authors: [spaced[1] + spaced[2], spaced[3]], provider: source };
  const named = /^本报记者 ([\p{Script=Han}]{2,5}(?: [\p{Script=Han}]{2,5}){0,7})$/u.exec(credit);
  if (named) return { authors: named[1].split(' '), provider: source };
  if (!credit && source === '人民日报海外版') {
    const closing = body.children('p').last().text().trim().replace(/\s+/g, ' ');
    const wire = /^（据新华社北京电 记者([\p{Script=Han}]{2,5}(?:、[\p{Script=Han}]{2,5}){1,7})）$/u.exec(closing);
    if (wire) return { authors: wire[1].split('、'), provider: source };
  }
  // Numeric CMS metadata is not an individual writer; preserve an unknown byline as empty.
  return /^\d{3,8}$/.test($('meta[name="author"]').attr('content') ?? '') ? { authors: [], provider: source } : null;
}
