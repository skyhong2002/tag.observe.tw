import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** Use own visible paragraphs when structured text omits a headline subject at a paragraph's start. */
export function cnaVerifiedParagraphs($: CheerioAPI, value: string, node: Record<string, unknown>): string | null {
  const body = node.articleBody;
  if (typeof body !== 'string' || /<\/?[a-z][^>]*>/i.test(body) || typeof node.headline !== 'string') return null;
  const url = new URL(value);
  if (!['www.cna.com.tw', 'cna.com.tw'].includes(url.hostname) || !/^\/news\/[a-z]+\/\d{12}\.aspx$/.test(url.pathname)) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const compact = (text: string) => text.replace(/\s/g, '');
  const main = $('.centralContent');
  const heading = main.children('h1');
  const photo = main.children('.fullPic');
  const leading = photo.children('figure').children('figcaption.picinfo');
  const prose = photo.next('.paragraph');
  if (
    main.length !== 1 ||
    heading.length !== 1 ||
    compact(heading.text()) !== compact(node.headline) ||
    photo.length !== 1 ||
    leading.length !== 1 ||
    prose.length !== 1 ||
    !compact(body).startsWith(compact(leading.text()))
  )
    return null;
  let structured = compact(body);
  for (const caption of leading.add(prose.find('figure > figcaption.picinfo')).toArray()) {
    const marked = compact($(caption).text());
    const at = structured.indexOf(marked);
    if (!marked || at < 0 || structured.indexOf(marked, at + 1) !== -1) return null;
    structured = structured.slice(0, at) + structured.slice(at + marked.length);
  }
  const paragraphNodes = prose.children('p');
  for (const element of paragraphNodes.add(paragraphNodes.find('*')).toArray()) {
    const own = $(element);
    if (
      own.closest('[hidden], [aria-hidden="true"]').length ||
      /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(own.attr('style') ?? '')
    )
      return null;
  }
  const paragraphs = paragraphNodes
    .toArray()
    .map((element) => $(element).text().trim())
    .filter(Boolean);
  const texts = paragraphs.map(compact);
  if (texts.length < 2 || !structured.startsWith(texts[0]) || structured === texts.join('')) return null;
  let matches = 0;
  for (let index = 1; index < texts.length; index++) {
    for (let length = 2; length <= 5; length++) {
      const prefix = texts[index].slice(0, length);
      if (!/^[\p{Script=Han}]{2,5}$/u.test(prefix) || !compact(node.headline).includes(prefix)) continue;
      const candidate = [...texts];
      candidate[index] = candidate[index].slice(length);
      if (candidate.join('') === structured) matches++;
    }
  }
  // The complete report must differ only by one explicitly visible headline subject, never inferred prose.
  return matches === 1 ? paragraphs.join('\n\n') : null;
}

/** Own marked photo captions are separate from the CNA report's prose. */
export function cnaStructuredBody($: CheerioAPI, value: string, node: Record<string, unknown>): unknown {
  const body = node.articleBody;
  if (typeof body !== 'string' || /<\/?[a-z][^>]*>/i.test(body)) return body;
  const url = new URL(value);
  if (!['www.cna.com.tw', 'cna.com.tw'].includes(url.hostname) || !/^\/news\/[a-z]+\/\d{12}\.aspx$/.test(url.pathname)) return body;
  try {
    const canonical = $('link[rel="canonical"]').attr('href');
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return body;
  } catch {
    return body;
  }
  const main = $('.centralContent');
  const heading = main.children('h1');
  const compact = (text: string) => text.replace(/\s/g, '');
  if (main.length !== 1 || heading.length !== 1 || typeof node.headline !== 'string' || compact(heading.text()) !== compact(node.headline))
    return body;
  const photo = main.children('.fullPic');
  const caption = photo.children('figure').children('figcaption.picinfo');
  const prose = photo.next('.paragraph');
  if (photo.length !== 1 || caption.length !== 1 || prose.length !== 1 || !prose.children('p').length) return body;
  const prefix = compact(caption.text());
  if (!prefix || !compact(body).startsWith(prefix)) return body;
  let end = 0;
  let consumed = 0;
  for (const character of body) {
    end += character.length;
    if (!/\s/u.test(character)) consumed += character.length;
    if (consumed >= prefix.length) break;
  }
  const remaining = body.slice(end).trimStart();
  const firstParagraph = compact(prose.children('p').first().text());
  if (!firstParagraph || !compact(remaining).startsWith(firstParagraph)) return body;
  let cleaned = remaining;
  for (const element of prose.find('figure > figcaption.picinfo').toArray()) {
    const marked = compact($(element).text());
    const text = compact(cleaned);
    const position = text.indexOf(marked);
    if (!marked || position < 0) continue;
    // A caption repeated in actual prose is ambiguous; keep the proven prefix-only correction.
    if (text.indexOf(marked, position + 1) !== -1) return remaining;
    let offset = 0;
    let count = 0;
    let start = -1;
    for (const character of cleaned) {
      if (!/\s/u.test(character)) {
        if (count === position) start = offset;
        count += character.length;
      }
      offset += character.length;
      if (count === position + marked.length) break;
    }
    if (start < 0) return remaining;
    cleaned = cleaned.slice(0, start) + cleaned.slice(offset);
  }
  const ownProse = prose
    .children('p')
    .toArray()
    .map((element) => $(element).text())
    .join('');
  // Remove inner/trailing captions only when all remaining text is exactly the own written paragraphs.
  return compact(cleaned) === compact(ownProse) ? cleaned.trim() : remaining;
}
