import type { CheerioAPI } from 'cheerio';
import { decodeEntities } from './text.ts';

const compact = (value: string) =>
  decodeEntities(value)
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\\r\\n/g, ' ')
    .replace(/[\s\u200b-\u200d\ufeff]/g, '');

/** This own prose wrapper has an ad-like name; the own BlogPosting independently corroborates every visible block. */
export function dacotaOwnProse($: CheerioAPI, value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.origin !== 'https://dacota.tw' || !/^\/blog\/post\/[^/]+$/.test(url.pathname) || url.search || url.hash) return null;
  if ($('link[rel="canonical"]').attr('href') !== value || $('meta[property="og:url"]').attr('content') !== value) return null;
  const ids = ($('body').attr('class') ?? '').split(/\s+/).filter((name) => /^postid-\d+$/.test(name));
  if (ids.length !== 1) return null;
  const own = $(`main#genesis-content > article.post-${ids[0].slice(7)}.entry`);
  const heading = own.children('.entry-header').children('h1.entry-title[itemprop="headline"]');
  const author = own.children('.entry-header').find('.entry-author-link[rel="author"] .entry-author-name');
  const prose = own.children('.entry-content').children('div.Zi_ad_ar_iR');
  if (own.length !== 1 || heading.length !== 1 || !heading.text().trim() || author.length !== 1 || prose.length !== 1) return null;
  const schemas: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      const parsed = JSON.parse($(node).text());
      for (const item of Array.isArray(parsed) ? parsed : (parsed?.['@graph'] ?? [parsed]))
        if (item?.['@type'] === 'BlogPosting') schemas.push(item);
    } catch {
      // A malformed or unrelated schema cannot establish ownership.
    }
  });
  if (schemas.length !== 1) return null;
  const schema = schemas[0];
  const entity = schema.mainEntityOfPage as { '@id'?: string } | undefined;
  const writer = schema.author as { '@type'?: string; name?: string } | undefined;
  if (
    entity?.['@id'] !== value ||
    typeof schema.headline !== 'string' ||
    compact(schema.headline) !== compact(heading.text()) ||
    typeof schema.description !== 'string' ||
    writer?.['@type'] !== 'Person' ||
    writer.name !== author.text().trim()
  )
    return null;
  const clone = prose.clone();
  clone.find('script,style,noscript,iframe,img,video,audio').remove();
  const blocks: string[] = [];
  clone.children('p,h1,h2,h3,ul,ol').each((_, node) => {
    const elements = $(node).is('ul,ol') ? $(node).children('li').toArray() : [node];
    for (const element of elements) {
      const text = $(element)
        .text()
        .replace(/[\u200b-\u200d\ufeff]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) blocks.push(text);
    }
  });
  const body = blocks.join('\n\n');
  if (compact(body).length < 200 || compact(clone.text()) !== compact(body)) return null;
  const description = compact(schema.description);
  let cursor = 0;
  for (const block of blocks) {
    const position = description.indexOf(compact(block), cursor);
    if (position < 0) return null;
    cursor = position + compact(block).length;
  }
  return body;
}

/** Prefer the own headline corroborated by the same verified prose/schema over a stale OG title. */
export function dacotaHeadline($: CheerioAPI, value: string): string | null {
  if (!dacotaOwnProse($, value)) return null;
  const id = /(?:^|\s)postid-(\d+)(?=\s|$)/.exec($('body').attr('class') ?? '')?.[1];
  return $(`main#genesis-content > article.post-${id}.entry > .entry-header > h1.entry-title`).text().replace(/\s+/g, ' ').trim();
}

/** Preserve the supplied RSS excerpt, removing only the exact own title/publication trailer. */
export function dacotaFeedSummary(summary: string, heading: string | null, value?: string): string {
  if (!value || !heading) return summary;
  try {
    const url = new URL(value);
    if (url.origin !== 'https://dacota.tw' || !/^\/blog\/post\/[^/]+$/.test(url.pathname) || url.search || url.hash) return summary;
    const trailer = `The post ${heading} first appeared on 雲爸的私處.`;
    if (!summary.endsWith(trailer)) return summary;
    return summary
      .slice(0, -trailer.length)
      .trim()
      .replace(/\s*繼續閱讀$/u, '')
      .trim();
  } catch {
    return summary;
  }
}
