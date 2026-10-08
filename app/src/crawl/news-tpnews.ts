import type { CheerioAPI } from 'cheerio';

const compact = (s: string) => s.normalize('NFKC').replace(/\s/g, '');

export function tpNewsArticle($: CheerioAPI, value: string) {
  const url = new URL(value);
  const id = /^\/tpnews-local-news-collection\/local\/\d{4}\/\d{2}\/\d{2}\/(\d+)\//.exec(url.pathname)?.[1];
  if (url.hostname !== 'tpnews.org' || !id || $('link[rel="canonical"]').attr('href') !== value || !$('body').hasClass('postid-' + id))
    return null;
  const own = $('article.p-entry.l-primary > .p-entry__inner');
  const heading = own.children('.p-entry__header').children('h1.p-entry__title');
  const body = own.children('.p-entry__body');
  if (own.length !== 1 || heading.length !== 1 || body.length !== 1) return null;
  const declarations: { headline: string; mainEntityOfPage?: { '@id'?: string }; url?: string }[] = [];
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      const data = JSON.parse($(node).text());
      if (data?.['@type'] === 'NewsArticle' && typeof data.headline === 'string') declarations.push(data);
    } catch {}
  });
  if (
    declarations.length !== 1 ||
    declarations[0].url !== value ||
    declarations[0].mainEntityOfPage?.['@id'] !== value ||
    compact(declarations[0].headline) !== compact(heading.text())
  )
    return null;
  const paragraphs = body.children('div').children('p');
  const lead =
    paragraphs
      .toArray()
      .map((p) => $(p).text().trim())
      .find(Boolean) ?? '';
  // This editor is explicitly credited for writing the report, not responsibility editing.
  const name = /^【民眾網編輯([\p{Script=Han}]{2,5})(?:基隆|臺北)報導】/u.exec(lead)?.[1];
  if (!name) return null;
  const source = paragraphs.last();
  const links = source.children('a');
  let provider: string | null = null;
  let originalUrl: string | null = null;
  if (
    links.length === 2 &&
    source.text().trim().startsWith('原始新聞來源 ') &&
    compact(links.eq(0).text()) === compact(heading.text()) &&
    links.eq(1).text().trim() === '臺灣郵報'
  ) {
    try {
      const original = new URL(links.eq(0).attr('href') ?? '', value);
      if (
        original.protocol === 'https:' &&
        original.hostname === 'taiwanpost.net' &&
        /^\/\d{4}\/local\/\d+\/$/.test(original.pathname) &&
        links.eq(1).attr('href') === 'https://taiwanpost.net/'
      ) {
        provider = '臺灣郵報';
        originalUrl = original.href;
      }
    } catch {}
  }
  return { authors: [name], provider, originalUrl, body, lead };
}

/** Strip only the caption that the own publisher description actually copied. */
export function tpNewsSummary($: CheerioAPI, url: string, summary: string): string | null {
  const own = tpNewsArticle($, url);
  if (!own) return null;
  const captions = own.body
    .find('figure.wp-caption > figcaption.wp-caption-text')
    .toArray()
    .map((n) => $(n).text().trim());
  const caption = captions.find((s) => /^圖說[：:]/u.test(s) && summary.startsWith(s));
  if (!caption) return null;
  const remainder = summary.slice(caption.length).trim();
  return remainder.length >= 20 && compact(own.lead).startsWith(compact(remainder)) ? remainder : '';
}
