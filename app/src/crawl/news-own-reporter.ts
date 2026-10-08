import type { CheerioAPI } from 'cheerio';

const compact = (value: string) => value.replace(/\s+/g, '');
const names = '[\\p{Script=Han}]{2,5}(?:、[\\p{Script=Han}]{2,5}){0,4}';

/** Own article identity and explicit role slots distinguish reporters from subjects and photographers. */
export function ownReporterAuthors($: CheerioAPI, value: string): string[] | null {
  const url = new URL(value);
  if (!['news.ustv.com.tw', 'www.stheadline.com'].includes(url.hostname) || url.search || url.hash) return null;
  const canonical = $('link[rel="canonical"]');
  const og = $('meta[property="og:url"]');
  if (canonical.length !== 1 || og.length !== 1) return null;
  try {
    if (new URL(og.attr('content') ?? '').href !== url.href) return null;
    const declared = new URL(canonical.attr('href') ?? '');
    if (url.hostname === 'news.ustv.com.tw' && declared.protocol === 'http:') declared.protocol = 'https:';
    if (declared.href !== url.href) return null;
  } catch {
    return null;
  }
  const title = $('meta[property="og:title"]').attr('content') ?? '';
  if (url.hostname === 'news.ustv.com.tw' && /^\/newsdetail\/\d{8}A\d+$/.test(url.pathname)) {
    const article = $('main#newsdetail');
    const heading = article.children('.subject');
    const slot = article.children('.social-area').children('.reporter');
    if (
      article.length !== 1 ||
      heading.length !== 1 ||
      !heading.text().trim() ||
      !compact(title).startsWith(compact(heading.text()) + '|') ||
      !compact(title).endsWith('|非凡新聞') ||
      slot.length !== 1
    )
      return null;
    const links = slot.children('a');
    if (links.length < 1 || links.length > 2 || slot.children().length !== links.length) return null;
    const writer = links.eq(0).text().trim();
    const photographer = links.eq(1).text().trim();
    if (!/^[\p{Script=Han}]{2,5}$/u.test(writer)) return null;
    const expected = `非凡新聞/記者${writer}${links.length === 2 ? `,攝影${photographer}` : ''}`;
    if (compact(slot.text()) !== expected || (links.length === 2 && !/^[\p{Script=Han}]{2,5}$/u.test(photographer))) return null;
    for (const link of links.toArray()) {
      try {
        const target = new URL($(link).attr('href') ?? '', value);
        if (target.origin !== url.origin || !/^\/reporter\/\d+$/.test(target.pathname) || target.search || target.hash) return null;
      } catch {
        return null;
      }
    }
    return [writer];
  }
  const id = /^\/[^/]+\/(\d+)\/[^/]+$/.exec(url.pathname)?.[1];
  if (url.hostname !== 'www.stheadline.com' || !id) return null;
  const container = $(`#articlecontent_${id}`);
  const heading = container.children('.article-title').children('h1');
  const article = container.find(`article[id="${id}"]`);
  const body = article.children('[itemprop="articleBody"].content-body');
  if (
    container.length !== 1 ||
    heading.length !== 1 ||
    !title ||
    compact(heading.text()) !== compact(title) ||
    article.length !== 1 ||
    body.length !== 1
  )
    return null;
  const paragraphs = body.children().not('ad');
  let last = paragraphs.last();
  // A separately labeled final photographer never becomes a reporter.
  if (last.is('p') && !last.children().length && new RegExp(`^攝影[：:]\\s*${names}$`, 'u').test(last.text().trim()))
    last = paragraphs.eq(-2);
  if (!last.is('p') || last.children().length) return null;
  const credit = new RegExp(`^記者(?:[：:]\\s*|\\s+)(${names})$`, 'u').exec(last.text().trim());
  return credit ? [...new Set(credit[1].split('、'))] : null;
}
