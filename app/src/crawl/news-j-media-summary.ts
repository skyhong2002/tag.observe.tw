import type { CheerioAPI } from 'cheerio';
import { reporterNames } from './byline.ts';
import { urlKey } from './text.ts';

const lead =
  /^(?:照片(?:取自|為)[^【]{1,60}\s*)?(?:【聚傳媒(?:特約)?記者([\p{Script=Han}]{2,5})報導】|【聚論壇([\p{Script=Han}]{2,5})專欄】)/u;
const compact = (text: string) => text.replace(/\s/g, '');

/** The main article's complete opening declaration, separate from its photo credit. */
export function jMediaLead($: CheerioAPI, value: string): { author: string; prefix: string; paragraph: string } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!['j-media.tw', 'www.j-media.tw'].includes(url.hostname) || !/^\/Article\/Detail\/\d+$/.test(url.pathname)) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const main = $('article.entry').filter((_, element) => $(element).children('.single-post__entry-header').children('h1').length > 0);
  if (main.length !== 1) return null;
  const paragraphs = main.children('.entry__article-wrap').children('.entry__article').children('div').children('p');
  let paragraph = paragraphs.first().text().trim();
  if (/^照片(?:取自|為)[^【。！？]{1,60}$/u.test(paragraph) && /^【(?:聚傳媒|聚論壇)/u.test(paragraphs.eq(1).text().trim()))
    paragraph = paragraphs
      .slice(0, 3)
      .toArray()
      .map((node) => $(node).text().trim())
      .join(' ');
  const own = lead.exec(paragraph);
  if (!own) return null;
  const author = own[1] ?? own[2];
  if (reporterNames(own[1] ? `記者${author}` : `作者：${author}`).length !== 1) return null;
  if (own[2]) {
    const heading = main.children('.single-post__entry-header').children('h1');
    if (heading.length !== 1 || !heading.text().trim().startsWith(`${author}》`)) return null;
  }
  return { author, prefix: own[0], paragraph };
}

/** Clean the exact opening photo/byline wrapper around a publisher-supplied excerpt. */
export function jMediaSummary($: CheerioAPI, value: string, summary: string): string | null {
  const own = jMediaLead($, value);
  const supplied = lead.exec(summary)?.[0];
  if (!own || !supplied || compact(own.prefix) !== compact(supplied)) return null;
  const excerpt = summary.slice(supplied.length).trim();
  const prose = excerpt.replace(/(?:\.{3}|…)$/, '');
  return prose && compact(own.paragraph.slice(own.prefix.length)).includes(compact(prose)) ? excerpt : null;
}
