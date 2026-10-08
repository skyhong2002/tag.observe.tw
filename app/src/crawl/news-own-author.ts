import type { CheerioAPI } from 'cheerio';

const compact = (s: string) => s.replace(/\s+/g, '').trim();
interface StructuredArticle {
  '@type': string;
  mainEntityOfPage?: string | { '@id'?: string };
  headline?: string;
  articleSection?: string;
  author?: { '@type'?: string; name?: string; url?: string };
  publisher?: { '@type'?: string; name?: string; url?: string };
}

/** Only replace template authors after matching the article's own identity. */
export function ownArticleAuthors($: CheerioAPI, value: string): string[] | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!['ct.org.tw', 'www3.nhk.or.jp', 'www.tmnu.org.tw'].includes(url.hostname)) return null;
  const declared = $('meta[property="og:url"]').attr('content');
  if (declared !== value) return null;
  const title = $('meta[property="og:title"]').attr('content') ?? '';
  if (url.hostname === 'ct.org.tw' && url.pathname === '/html/news/3-3.php') {
    const id = url.searchParams.get('article');
    if (!id || !/^\d+$/.test(id)) return null;
    const heading = $('.nine.wide.column > h1.ui.header.my-0');
    if (heading.length !== 1 || !title || compact(heading.text()) !== compact(title)) return null;
    const slot = heading.parent().find('div.author');
    const link = slot.find('.writer > a');
    if (slot.length !== 1 || link.length !== 1 || !slot.find(`[onclick="add_trace('N','${id}','');"]`).length) return null;
    try {
      const target = new URL(link.attr('href') ?? '', value);
      if (
        target.origin !== url.origin ||
        target.pathname !== '/html/search/author.php' ||
        target.searchParams.get('select_type') !== 'news'
      )
        return null;
      // Preserve the explicitly displayed collective credit without inventing a person.
      if (link.text().trim() === '論壇報編採' && target.searchParams.get('author') === '論壇報編採') return ['論壇報編採'];
    } catch {
      return null;
    }
    return null;
  }
  const articles: StructuredArticle[] = [];
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      const parsed = JSON.parse($(node).text());
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        if (item && ['Article', 'NewsArticle'].includes(item['@type'])) articles.push(item);
      }
    } catch {
      // Malformed or unrelated structured data is not evidence.
    }
  });
  if (articles.length !== 1) return null;
  const article = articles[0];
  const own = typeof article.mainEntityOfPage === 'string' ? article.mainEntityOfPage : article.mainEntityOfPage?.['@id'];
  if (own !== value || !title || typeof article.headline !== 'string' || !article.headline) return null;
  if (url.hostname === 'www3.nhk.or.jp' && /^\/nhkworld\/zt\/news\/nd-[\da-z]+\/$/.test(url.pathname)) {
    const heading = $('.p-article__head > h1.c-title > .c-title__text');
    if (
      heading.length !== 1 ||
      compact(heading.text()) !== compact(article.headline) ||
      compact(title) !== compact(article.headline + ' | NHK WORLD-JAPAN News')
    )
      return null;
    if (
      article.author?.['@type'] === 'Organization' &&
      article.publisher?.['@type'] === 'Organization' &&
      article.author.name === 'NHK WORLD' &&
      article.publisher.name === article.author.name &&
      article.author.url === 'https://www3.nhk.or.jp/nhkworld/' &&
      article.publisher.url === article.author.url
    )
      return [];
  }
  if (url.hostname === 'www.tmnu.org.tw' && /^\/news\/\d+$/.test(url.pathname)) {
    const heading = $('.article-heading > h1.article-sebhead');
    const body = $('.article-body > .article-content.c-editor');
    if (
      heading.length !== 1 ||
      body.length !== 1 ||
      compact(heading.text()) !== compact(article.headline) ||
      typeof article.articleSection !== 'string' ||
      !article.articleSection ||
      compact(title) !== compact(article.headline + '_' + article.articleSection + ' | 綜合新聞')
    )
      return null;
    if (
      article.author?.name !== 'TMNU台灣多媒體新聞聯合網' ||
      article.publisher?.name !== article.author.name ||
      article.publisher?.['@type'] !== 'Organization'
    )
      return null;
    const names = body
      .children('p')
      .slice(0, 4)
      .map((_, p) => {
        if ($(p).find('a,blockquote').length) return null;
        return /^TMNU記者\s+([\p{Script=Han}]{2,5})[／/]綜合報導$/u.exec($(p).text().trim())?.[1] ?? null;
      })
      .get()
      .filter(Boolean);
    return names.length === 1 ? names : [];
  }
  return null;
}
