import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** Remove only a corroborated, terminal related-story list from structured prose. */
export function marieclaireStructuredBody($: CheerioAPI, value: string, node: Record<string, unknown>): unknown {
  const body = node.articleBody;
  if (typeof body !== 'string' || /<\/?[a-z][^>]*>/i.test(body)) return body;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return body;
  }
  const id = /^\/[a-z-]+\/[a-z-]+\/(\d+)$/.exec(url.pathname)?.[1];
  if (!['www.marieclaire.com.tw', 'marieclaire.com.tw'].includes(url.hostname) || !id) return body;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return body;
  } catch {
    return body;
  }
  const main = $(`article > .articleContent#content${id}[itemprop="articleBody"]`);
  if (main.length !== 1 || main.parent().children('h1').text().trim() !== node.headline) return body;
  const compact = (text: string) => text.replace(/\s/g, '');
  if (compact(main.text()) !== compact(body)) return body;
  const label = main.children('p.extendArticle');
  const list = label.next('ul.extendArticle');
  if (label.length !== 1 || list.length !== 1 || !/^延伸閱讀[：:]$/.test(label.text().trim())) return body;
  if (
    list
      .nextAll()
      .toArray()
      .some((element) => $(element).text().trim())
  )
    return body;
  const links = list.find('li > a[href]');
  if (!links.length || links.length !== list.children('li').length) return body;
  for (const link of links.toArray()) {
    try {
      const target = new URL($(link).attr('href') ?? '', value);
      if (target.hostname !== url.hostname || !/^\/[a-z-]+\/[a-z-]+\/\d+$/.test(target.pathname) || !$(link).text().trim()) return body;
    } catch {
      return body;
    }
  }
  const suffix = label.text() + list.text();
  return body.endsWith(suffix) ? body.slice(0, -suffix.length).trimEnd() : body;
}
