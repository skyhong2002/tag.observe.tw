import type { CheerioAPI } from 'cheerio';
import { reporterNames } from './byline.ts';
import { urlKey } from './text.ts';

const compact = (text: string) => text.replace(/\s/g, '');

/** The complete opening writer declaration in the article's own content. */
export function iMediaWriter($: CheerioAPI, value: string): { author: string; prefix: string; prose: string } | null {
  const url = new URL(value);
  if (!['i-media.tw', 'www.i-media.tw'].includes(url.hostname) || !/^\/Article\/Detail\/\d+$/.test(url.pathname)) return null;
  const main = $('article.entry');
  const heading = main.children('h1.single-post__entry-title');
  if (main.length !== 1 || heading.length !== 1 || !heading.text().trim()) return null;
  const expectedTitle = `${heading.text().trim()} | i-media 愛傳媒`;
  if ($('title').text().trim() !== expectedTitle || $('meta[property="og:title"]').attr('content') !== expectedTitle) return null;
  // This publisher's OG URL omits the host. Its own share target supplies the complete identity.
  const share = main.children('.entry__article-wrap').children('.entry__share').find('.fb-share-button[data-href]');
  try {
    if (share.length !== 1 || urlKey(new URL(share.attr('data-href') ?? '', value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const contents = main.children('.entry__article-wrap').children('.entry__article').children('#articleContent');
  if (contents.length !== 1) return null;
  const paragraphs = contents.children('p');
  const prefix = paragraphs.first().text().trim();
  const credit = /^([\p{Script=Han}]{2,5})\s*[/／]\s*作家$/u.exec(prefix);
  if (!credit || reporterNames(`作者：${credit[1]}`).length !== 1) return null;
  const prose = paragraphs
    .slice(1)
    .toArray()
    .map((node) => $(node).text())
    .join(' ');
  return prose.trim() ? { author: credit[1], prefix, prose } : null;
}

export function iMediaWriterSummary($: CheerioAPI, url: string, summary: string): string | null {
  const writer = iMediaWriter($, url);
  if (!writer || !summary.startsWith(writer.prefix)) return null;
  const excerpt = summary.slice(writer.prefix.length).trim();
  const supplied = compact(excerpt.replace(/(?:\.{3}|…)$/, ''));
  return supplied && compact(writer.prose).startsWith(supplied) ? excerpt : null;
}
