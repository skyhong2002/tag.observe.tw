import type { CheerioAPI } from 'cheerio';

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const compact = (value: string) => value.replace(/\s+/g, '');
function sameArticle(value: string | undefined, url: URL): boolean {
  try {
    const declared = new URL(value ?? '');
    return (
      declared.origin === url.origin &&
      decodeURIComponent(declared.pathname) === decodeURIComponent(url.pathname) &&
      !declared.search &&
      !declared.hash
    );
  } catch {
    return false;
  }
}

/** Own WordPress identity and headline corroborate the publisher suffix and explicit reprint footer. */
export function yesMediaArticle(
  $: CheerioAPI,
  value: string,
): { title: string; provider: string | null; originalUrl: string | null; authors?: string[] } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.origin !== 'https://www.yesmedia.com.tw' || !/^\/[^/]+\/$/.test(url.pathname) || url.search || url.hash) return null;
  const canonical = $('link[rel="canonical"]');
  const ogUrl = $('meta[property="og:url"]');
  if (
    !canonical.length ||
    !ogUrl.length ||
    !canonical.toArray().every((node) => sameArticle($(node).attr('href'), url)) ||
    !ogUrl.toArray().every((node) => sameArticle($(node).attr('content'), url))
  )
    return null;
  const classes = ($('body').attr('class') ?? '').split(/\s+/);
  const ids = classes.filter((name) => /^postid-\d+$/.test(name));
  if (!classes.includes('single-post') || ids.length !== 1) return null;
  const id = ids[0].slice('postid-'.length);
  const own = $(`article#post-${id}.post`);
  const headings = $('.the-post-header h1.post-title');
  if (own.length !== 1 || headings.length !== 1 || $('h1').length !== 1) return null;
  const title = clean(headings.text());
  const expected = `${title} - 是新聞 YesMedia | 網路原生即時新聞`;
  const ogTitles = $('meta[property="og:title"]');
  if (
    !title ||
    $('title').length !== 1 ||
    clean($('title').text()) !== expected ||
    !ogTitles.length ||
    !ogTitles.toArray().every((node) => [title, expected].includes(clean($(node).attr('content') ?? '')))
  )
    return null;
  let matched = 0;
  let conflicting = false;
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      const parsed = JSON.parse($(node).text());
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [parsed];
      for (const item of items) {
        if (!item || !['Article', 'NewsArticle'].includes(item['@type'])) continue;
        const page = typeof item.mainEntityOfPage === 'string' ? item.mainEntityOfPage : item.mainEntityOfPage?.['@id'];
        if (!sameArticle(page ?? item.url, url) || typeof item.headline !== 'string' || compact(item.headline) !== compact(title)) {
          conflicting = true;
          continue;
        }
        matched++;
      }
    } catch {
      // An invalid schema is not corroboration.
    }
  });
  if (!matched || conflicting) return null;
  const result: { title: string; provider: string | null; originalUrl: string | null; authors?: string[] } = {
    title,
    provider: null,
    originalUrl: null,
  };
  const wrappers = own.find('.post-content.entry-content > .dable-content-wrapper');
  if (wrappers.length !== 1) return result;
  // Reprint credits belong to the own leading paragraph, corroborated by its agency and desk header.
  const metaAuthors = $('meta[name="author"]');
  const visibleAuthors = $('.the-post-header [rel="author"]');
  const lead = wrappers
    .children('p')
    .filter((_, node) => !!clean($(node).text()))
    .first();
  if (
    metaAuthors.length === 1 &&
    visibleAuthors.length === 1 &&
    clean(visibleAuthors.text()) === '編採中心' &&
    lead.length === 1 &&
    !lead.find('a, blockquote, q, img, figure, figcaption').length
  ) {
    const agency = clean(metaAuthors.attr('content') ?? '');
    const text = clean(lead.text());
    const credit =
      agency === '商傳媒'
        ? /^商傳媒[｜|]([\p{Script=Han}]{2,5})[／/]((?:綜合外電|[\p{Script=Han}]{2,5}))報導$/u.exec(text)
        : agency === '觀傳媒'
          ? /^（觀傳媒[\p{Script=Han}]{2,8}新聞）【記者([\p{Script=Han}]{2,5})[／/][\p{Script=Han}]{2,5}報導】/u.exec(text)
          : agency === '點傳媒'
            ? /^【點傳媒[／/]總社長([\p{Script=Han}]{2,5})報導】/u.exec(text)
            : null;
    if (credit && !/(?:編輯|攝影|記者|受訪|中心|報導|責任|綜合|社長)/u.test(credit[1])) result.authors = [credit[1]];
  }
  const footer = wrappers.children('p').last();
  const links = footer.children('a');
  if (
    links.length !== 2 ||
    footer.children().length !== 2 ||
    compact(links.eq(0).text()) !== compact(title) ||
    links.eq(1).text().trim() !== '火報' ||
    compact(footer.text()) !== `這篇文章${compact(title)}最早出現於火報。`
  )
    return result;
  try {
    const source = new URL(links.eq(1).attr('href') ?? '');
    const original = new URL(links.eq(0).attr('href') ?? '');
    if (
      source.href !== 'https://firenews.com.tw/' ||
      original.origin !== source.origin ||
      !/^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/.test(original.pathname) ||
      original.search ||
      original.hash
    )
      return result;
    return { ...result, provider: '火報', originalUrl: original.href };
  } catch {
    return result;
  }
}
