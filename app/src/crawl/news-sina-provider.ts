import type { CheerioAPI } from 'cheerio';

const compact = (s: string) => s.replace(/\s/g, '');
export function sinaDeclaredProvider($: CheerioAPI, value: string): string | null {
  const url = new URL(value);
  if (
    url.hostname !== 'news.sina.cn' ||
    !/^\/sh\/\d{4}-\d{2}-\d{2}\/detail-[a-z0-9]+\.d\.html$/.test(url.pathname) ||
    $('meta[property="og:url"]').attr('content') !== value
  )
    return null;
  const own = $('article.art_box');
  const heading = own.children('h1.art_tit_h1');
  const body = own.children('.art_content');
  if (
    own.length !== 1 ||
    heading.length !== 1 ||
    body.length !== 1 ||
    !heading.text().trim() ||
    compact(heading.text()) !== compact($('meta[property="og:title"]').attr('content') ?? '')
  )
    return null;
  const credit = body.children('p.art_p').first().text().trim();
  const footer = body.children('p.art_p').last().text().trim();
  return credit === '来源：羊城晚报' && footer === '（羊城晚报•羊城派综合自潮新闻、羊城晚报•羊城派综合）' ? '羊城晚报' : null;
}

export function sinaOwnProse($: CheerioAPI, value: string): string | null {
  if (!sinaDeclaredProvider($, value)) return null;
  const body = $('article.art_box > .art_content');
  if (
    body
      .children()
      .toArray()
      .some((n) => {
        const child = $(n);
        if (child.is('p.art_p')) return false;
        if (child.text().trim()) return true;
        if (
          child.is('a[href="JavaScript:void(0)"]') &&
          child.children().length === 1 &&
          child.children('figure.art_img_mini.j_p_gallery').length === 1
        ) {
          const figure = child.children('figure');
          return (
            figure.children('img').length === 0 ||
            figure
              .find('*')
              .toArray()
              .some((el) => !$(el).is('img,h2.art_img_tit'))
          );
        }
        if (child.is('div#wx_pic') && /(?:^|;)\s*display\s*:\s*none\s*(?:;|$)/i.test(child.attr('style') ?? ''))
          return child.children().length !== 1 || child.children('img').length !== 1;
        return true;
      })
  )
    return null;
  const paragraphs = body
    .children('p.art_p')
    .toArray()
    .map((n) => {
      const copy = $(n).clone();
      copy.find('br').replaceWith('\n');
      return copy
        .text()
        .replace(/[^\S\n]+/g, ' ')
        .trim();
    })
    .filter(Boolean);
  const prose = paragraphs.join('\n\n');
  return compact(prose).length >= 200 ? prose : null;
}
