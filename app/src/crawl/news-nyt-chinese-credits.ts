import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** Keep the own byline address separate from its sibling publication time and contributor footer. */
export function nytChineseCredits($: CheerioAPI, value: string): string[] | null {
  const url = new URL(value);
  if (url.hostname !== 'cn.nytimes.com' || !/^\/[a-z]+\/\d{8}\/[^/]+\/(?:zh-han[st]\/)?$/.test(url.pathname)) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const main = $('article.article-content');
  const header = main.children('.article-header');
  const heading = header.children('header').children('h1');
  if (
    main.length !== 1 ||
    header.length !== 1 ||
    heading.length !== 1 ||
    !heading.text().trim() ||
    !$('title').text().includes(heading.text().trim())
  )
    return null;
  const byline = header.find('.byline-row .byline > address');
  if (byline.length !== 1 || byline.find('time').length) return null;
  const names = byline
    .text()
    .trim()
    .split(/\s*[,，]\s*/u);
  if (!names.length || names.length > 8 || names.some((name) => !/^[\p{L}\p{M}][\p{L}\p{M} .’'·-]{1,100}$/u.test(name))) return null;
  return [...new Set(names)];
}
