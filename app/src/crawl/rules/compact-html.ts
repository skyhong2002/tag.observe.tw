import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

// A page skeleton for the model writing crawl rules: the element structure,
// selectors and metadata survive; scripts, styles and long prose do not.

const KEEP = new Set([
  'id',
  'class',
  'href',
  'datetime',
  'rel',
  'itemprop',
  'itemtype',
  'property',
  'name',
  'content',
  'role',
  'type',
  'lang',
]);
const DROP = 'style,noscript,template,svg,iframe,canvas,video,audio,picture source,link:not([rel="canonical"])';

/** Arrays keep a few items, strings a few dozen characters: the shape survives, the payload does not. */
export function pruneJson(value: unknown, items = 2, chars = 80, depth = 0): unknown {
  if (depth > 10) return '…';
  if (typeof value === 'string') return value.length > chars ? `${value.slice(0, chars)}…` : value;
  const next = (v: unknown) => pruneJson(v, items, chars, depth + 1);
  if (Array.isArray(value))
    return [...value.slice(0, items).map(next), ...(value.length > items ? [`…+${value.length - items} more`] : [])];
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, next(v)]));
  return value;
}
const shownJson = (source: string, max = 4000) => {
  try {
    const shown = JSON.stringify(pruneJson(JSON.parse(source)));
    return shown.length > max ? `${shown.slice(0, max)}…` : shown;
  } catch {
    return source.length > max ? `${source.slice(0, max)}…` : source;
  }
};
/** The longest prefix of `text` within `maxBytes` UTF-8 bytes. */
export function utf8Prefix(text: string, maxBytes: number) {
  const bytes = Buffer.from(text);
  if (bytes.length <= maxBytes) return text;
  return bytes.subarray(0, maxBytes).toString('utf8').replace(/�+$/, '');
}

export function compactHtml(html: string, maxBytes = 48 * 1024): string {
  const xml = /^\s*(?:<\?xml|<(?:rss|feed|urlset|sitemapindex)\b)/.test(html.slice(0, 500));
  const $ = cheerio.load(html, { xml });
  $(DROP).remove();
  $('script').each((_, el) => {
    const node = $(el);
    if (node.is('script[type="application/ld+json"]')) node.text(shownJson(node.text()));
    else node.remove();
  });
  $('*').each((_, el) => {
    if (el.type !== 'tag') return;
    for (const name of Object.keys(el.attribs)) {
      const value = el.attribs[name];
      if (!KEEP.has(name) && !name.startsWith('data-')) delete el.attribs[name];
      else if (value.length > 160) el.attribs[name] = `${value.slice(0, 160)}…`;
    }
  });
  const shorten = (node: AnyNode) => {
    if (node.type === 'text') {
      const value = node.data.replace(/\s+/g, ' ');
      node.data = value.length > 120 ? `${value.slice(0, 120)}…` : value;
    } else if ('children' in node && !('name' in node && node.name === 'script')) for (const child of node.children) shorten(child);
  };
  for (const node of $.root().children().toArray()) shorten(node);
  return utf8Prefix(((xml ? null : $('html').html()) ?? $.root().html() ?? '').replace(/\n\s*\n+/g, '\n'), maxBytes);
}

/** A page whose articles only a browser would see: little text and few links of its own. */
export function scriptShell(html: string, url: string) {
  const $ = cheerio.load(html);
  const host = new URL(url).hostname;
  const links = $('a[href]')
    .toArray()
    .filter((a) => {
      try {
        return new URL($(a).attr('href') || '', url).hostname === host;
      } catch {
        return false;
      }
    }).length;
  $('script,style,noscript,template').remove();
  return $('body').text().replace(/\s+/g, '').length < 400 && links < 8;
}
