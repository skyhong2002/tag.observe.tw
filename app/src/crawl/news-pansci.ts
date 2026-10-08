import type { CheerioAPI } from 'cheerio';

const compact = (s: string) => s.normalize('NFKC').replace(/\s/g, '');

/** Infinite-scroll stories must not supply authors or prose for the requested story. */
export function pansciArticle($: CheerioAPI, value: string) {
  const url = new URL(value);
  const id = /^\/archives\/(\d+)$/.exec(url.pathname)?.[1];
  if (url.hostname !== 'pansci.asia' || !id || $('link[rel="canonical"]').attr('href') !== value) return null;
  const own = $(`section.load_post[data-post_id="${id}"]`);
  const heading = own.find('.post-title-box > h1');
  const body = own.find('.post-content-container');
  if (
    own.length !== 1 ||
    own.attr('data-url') !== value ||
    heading.length !== 1 ||
    body.length !== 1 ||
    !heading.text().trim() ||
    compact(own.attr('data-title') ?? '') !== compact(heading.text())
  )
    return null;
  const slot = heading.closest('section').find('.post-text-blue > a[rel="author"]');
  if (slot.length !== 1) return null;
  const author = slot.text().trim();
  try {
    const target = new URL(slot.attr('href') ?? '', value);
    if (target.origin !== url.origin || !/^\/archives\/author\/[a-z0-9-]+$/.test(target.pathname) || !author) return null;
  } catch {
    return null;
  }
  const children = body.children().toArray();
  // Require an entirely understood set of own blocks; unknown containers fall back.
  if (
    children.some(
      (n) =>
        !$(n).is('p,h2,h3,h4,ul,ol,blockquote,figure') &&
        !($(n).is('div[id^="pansc-"]') && ($(n).attr('class') ?? '').startsWith('pansc-')),
    )
  )
    return null;
  const prose = children
    .filter((n) => $(n).is('p,h2,h3,h4,ul,ol,blockquote'))
    .map((n) => {
      const copy = $(n).clone();
      copy.find('script,style,img,iframe').remove();
      copy.find('br').replaceWith('\n');
      copy.find('li').append('\n\n');
      return copy
        .text()
        .replace(/[^\S\n]+/g, ' ')
        .trim();
    })
    .filter(Boolean)
    .join('\n\n');
  if (compact(prose).length < 200) return null;
  const credit = body.children('ul.wp-block-list').first().children('li');
  const original = credit.eq(1).find('a').first();
  let provider: string | null = null;
  let originalUrl: string | null = null;
  let authors = [author];
  if (
    credit.eq(0).text().trim() === '作者／照護線上編輯部' &&
    credit.eq(1).text().trim().startsWith('本文轉載自 Care Online 照護線上《') &&
    compact(original.text()) === compact(heading.text())
  ) {
    try {
      const target = new URL(original.attr('href') ?? '', value);
      const organization = new URL(credit.eq(0).find('a').attr('href') ?? '', value);
      if (
        target.protocol === 'https:' &&
        target.hostname === 'www.careonline.com.tw' &&
        /^\/\d{4}\/\d{2}\/[a-z0-9-]+\.html$/.test(target.pathname) &&
        organization.href === 'https://www.careonline.com.tw/'
      ) {
        provider = 'Care Online 照護線上';
        originalUrl = target.href;
        authors = ['照護線上編輯部'];
      }
    } catch {
      // The own account remains usable when the explicit source link is invalid.
    }
  }
  return { body: prose, authors, provider, originalUrl };
}
