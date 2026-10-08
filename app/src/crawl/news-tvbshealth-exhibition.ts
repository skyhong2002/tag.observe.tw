import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** Health 2.0's reviewed sleep exhibition puts its written report in sibling sections. */
export function tvbsHealthExhibition($: CheerioAPI, value: string): { body: string; authors: string[] } | null {
  const url = new URL(value);
  if (url.hostname !== 'health.tvbs.com.tw' || !/^\/exhibition\/insomnia\/2024\/article_\d+-\d+\.html$/.test(url.pathname)) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const header = $('body > section.content9').filter((_, node) => $(node).find('.title-wrapper > h1').length === 1);
  if (header.length !== 1 || $('h1').length !== 1) return null;
  const heading = header.find('.title-wrapper > h1').text().replace(/\s+/g, ' ').trim();
  if (!heading || !$('title').text().includes(heading)) return null;
  const paragraphs: string[] = [];
  for (const section of header.nextAll('section').toArray()) {
    const node = $(section);
    if (!node.is('.content1, .image3')) break;
    if (!node.hasClass('content1')) continue;
    for (const paragraph of node.find('> .container > .row > div > p.mbr-text').toArray()) {
      const own = $(paragraph).clone();
      own.find('script, style, iframe, button, [hidden], [aria-hidden="true"]').remove();
      own.find('br').replaceWith('\n');
      const text = own
        .text()
        .split(/\n+/)
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n\n');
      if (text) paragraphs.push(text);
    }
  }
  const body = paragraphs.join('\n\n');
  const description = $('meta[name="description"]').attr('content')?.replace(/\s+/g, ' ').trim();
  if (!description || !body.replace(/\s+/g, ' ').startsWith(description)) return null;
  const credit = header.find('.title-wrapper > p.mbr-text').clone();
  credit.find('br').replaceWith('\n');
  const authors = credit
    .text()
    .split('\n')
    .flatMap((line) => /^\s*◎\s*整理[／/]\s*([\p{Script=Han}]{2,5})\s*$/u.exec(line)?.[1] ?? []);
  return body ? { body, authors: [...new Set(authors)] } : null;
}
