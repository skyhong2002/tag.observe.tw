import type { FeedItem } from './feed.ts';
import { between, decodeEntities, resolveUrl, stripTags } from './text.ts';

// Marker-based listing parser, the same slicing the legacy PHP does for the
// handful of media that expose no feed. Fields are literal start/end pairs.
export interface MarkerListSpec {
  itemStart: string;
  itemEnd: string;
  url: { start: string; end: string; prefix?: string };
  title: { start: string; end: string };
  time?: { start: string; end: string };
  image?: { start: string; end: string };
}
export function parseMarkerList(html: string, base: string, spec: MarkerListSpec): FeedItem[] {
  const items: FeedItem[] = [];
  let from = 0;
  for (let guard = 0; guard < 500; guard++) {
    const a = html.indexOf(spec.itemStart, from);
    if (a < 0) break;
    const b = html.indexOf(spec.itemEnd, a + spec.itemStart.length);
    const item = html.slice(a, b < 0 ? undefined : b);
    from = b < 0 ? html.length : b + spec.itemEnd.length;
    const href = between(item, spec.url.start, spec.url.end, 0, 1000).trim();
    if (!href) continue;
    const url = resolveUrl((spec.url.prefix ?? '') + href, base);
    if (!url) continue;
    const title = decodeEntities(stripTags(between(item, spec.title.start, spec.title.end, 0, 2000))).trim();
    if (!title) continue;
    const time = spec.time ? new Date(decodeEntities(stripTags(between(item, spec.time.start, spec.time.end, 0, 200))).trim()) : null;
    const image = spec.image ? resolveUrl(between(item, spec.image.start, spec.image.end, 0, 1000), base) : null;
    items.push({ url, title, publishedAt: time && !Number.isNaN(time.getTime()) ? time : null, image: image ?? undefined });
  }
  return items;
}

// Homepage/section-page link discovery for media without any feed: same-host
// anchors whose path matches the article pattern; title from the anchor text.
// publishedAt is unknown here and is filled in by the article stage.
import * as cheerio from 'cheerio';
export function discoverLinks(html: string, base: string, pattern: RegExp, minTitle = 8): FeedItem[] {
  const $ = cheerio.load(html);
  const host = new URL(base).host.replace(/^www\./, '');
  const out = new Map<string, FeedItem>();
  $('a[href]').each((_, el) => {
    const a = $(el);
    const href = a.attr('href') ?? '';
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      return;
    }
    if (abs.host.replace(/^www\./, '') !== host || !pattern.test(abs.pathname)) return;
    abs.hash = '';
    const url = abs.toString();
    const title = decodeEntities((a.text().replace(/\s+/g, ' ').trim() || a.attr('title') || a.find('img').attr('alt') || '').trim());
    if (title.length < minTitle) return;
    const img = a.find('img').first();
    const src = img.attr('data-src') || img.attr('data-original') || img.attr('src') || null;
    const prev = out.get(url);
    if (!prev || prev.title.length < title.length)
      out.set(url, {
        url,
        title: title.slice(0, 512),
        publishedAt: null,
        image: src && !/^data:/.test(src) ? (resolveUrl(src, base) ?? undefined) : prev?.image,
      });
  });
  return [...out.values()];
}
