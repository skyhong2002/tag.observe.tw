import type { CheerioAPI } from 'cheerio';

const compact = (s: string) => s.replace(/\s/g, '');
export function cctvDeclaredProvider($: CheerioAPI, value: string): string | null {
  const url = new URL(value);
  const route = /^\/(\d{4})\/(\d{2})\/(\d{2})\/ARTI[A-Za-z0-9]+\.shtml$/.exec(url.pathname);
  if (url.hostname !== 'news.cctv.com' || !route) return null;
  const header = $('.title_area');
  const heading = header.children('h1');
  const source = header.children('.info').children('span.source');
  if (
    header.length !== 1 ||
    heading.length !== 1 ||
    source.length !== 1 ||
    $('#text_area').length !== 1 ||
    !heading.text().trim() ||
    compact(heading.text()) !== compact($('meta[property="og:title"]').attr('content') ?? '') ||
    compact(heading.text()) !== compact($('meta[name="apple-mobile-web-app-title"]').attr('content') ?? '')
  )
    return null;
  const date = header.children('.info').children('span').last().text().trim();
  if (!date.startsWith(`${route[1]}年${route[2]}月${route[3]}日 `)) return null;
  // The own source field declares supplied copy. A mention in prose is insufficient.
  return source.text().trim() === '新华社' ? '新华社' : null;
}

export function cctvDeclaredAuthors($: CheerioAPI, value: string): string[] | null {
  if (cctvDeclaredProvider($, value) !== '新华社') return null;
  const credits = $('#text_area p')
    .slice(-4)
    .toArray()
    .map((n) => $(n).text().trim())
    .flatMap((text) => /^文字记者[：:]\s*([\p{Script=Han}、，,\s]+)$/u.exec(text)?.[1] ?? []);
  if (credits.length !== 1) return null;
  const names = credits[0].split(/[、，,]/).map((s) => s.trim());
  return names.length && names.every((s) => /^[\p{Script=Han}]{2,5}$/u.test(s)) ? [...new Set(names)] : null;
}
