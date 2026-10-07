import { XMLParser } from 'fast-xml-parser';
import { publisherSummary } from './summary.ts';
import { decodeEntities, stripTags } from './text.ts';

export interface FeedItem {
  url: string;
  title: string;
  publishedAt: Date | null;
  /** Sitemap <lastmod>: last modification, NOT publication (often years after). */
  modifiedAt?: Date | null;
  category?: string;
  image?: string;
  tags?: string[];
  description?: string;
  summary?: string | null;
  summarySource?: string | null;
  creator?: string;
  /** Publisher's explicit full-content element; never synthesized from description. */
  contentHtml?: string;
  /** Explicit provider from the verified article, separate from reporter names. */
  verifiedProvider?: string | null;
  /** Body already validated by discovery; safe to persist without fetching twice. */
  verifiedContent?: { body: string; authors: string[]; bodySource: string; bodyStatus: 'ok' | 'short' };
}
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  textNodeName: '#text',
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ['item', 'url', 'entry', 'category', 'link', 'media:content', 'news:keywords', 'sitemap'].includes(name),
});

const text = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return text(o.__cdata ?? o['#text'] ?? o['@_href'] ?? '');
  }
  return '';
};
const date = (v: unknown): Date | null => {
  const s = text(v).trim();
  if (!s) return null;
  // Zone-less ISO times (top1health "2026-09-23T11:31:00") are Taiwan time,
  // whatever the host's TZ.
  const d = new Date(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s) ? `${s.replace(' ', 'T')}+08:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
};
const splitTags = (values: unknown[]): string[] =>
  values
    .flatMap((v) => text(v).split(/[,，、]/))
    .map((t) => decodeEntities(stripTags(t)).trim())
    .filter((t) => Buffer.byteLength(t) > 1);

export function parseFeed(xml: string): {
  kind: 'rss' | 'sitemap' | 'atom' | 'sitemapindex' | 'none';
  items: FeedItem[];
  children?: string[];
} {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml.replace(/^﻿/, ''));
  } catch {
    return { kind: 'none', items: [] };
  }
  const rss = (doc.rss as Record<string, unknown>)?.channel as Record<string, unknown> | undefined;
  if (rss?.item) return { kind: 'rss', items: (rss.item as Record<string, unknown>[]).map(rssItem).filter((i): i is FeedItem => !!i) };
  // RSS 1.0 (RDF, e.g. Taipei Times): <item>s are siblings of <channel>.
  const rdf = doc['rdf:RDF'] as Record<string, unknown> | undefined;
  if (rdf?.item) return { kind: 'rss', items: (rdf.item as Record<string, unknown>[]).map(rssItem).filter((i): i is FeedItem => !!i) };
  const urlset = doc.urlset as Record<string, unknown> | undefined;
  if (urlset?.url)
    return { kind: 'sitemap', items: (urlset.url as Record<string, unknown>[]).map(sitemapItem).filter((i): i is FeedItem => !!i) };
  const index = doc.sitemapindex as Record<string, unknown> | undefined;
  if (index?.sitemap) {
    const list = (Array.isArray(index.sitemap) ? index.sitemap : [index.sitemap]) as Record<string, unknown>[];
    const entries = list.map((e) => ({ url: text(e.loc).trim(), lastmod: date(e.lastmod) })).filter((e) => /^https?:\/\//.test(e.url));
    // Newest children first: by lastmod when present; otherwise indexes list
    // either oldest- or newest-first, so take both ends.
    const dated = entries.filter((e) => e.lastmod);
    const ordered = dated.length
      ? dated.sort((a, b) => (b.lastmod as Date).getTime() - (a.lastmod as Date).getTime()).map((e) => e.url)
      : [...entries.slice(0, 2), ...entries.slice(-2)].map((e) => e.url);
    return { kind: 'sitemapindex', items: [], children: [...new Set(ordered)] };
  }
  const feed = doc.feed as Record<string, unknown> | undefined;
  if (feed?.entry)
    return { kind: 'atom', items: (feed.entry as Record<string, unknown>[]).map(atomItem).filter((i): i is FeedItem => !!i) };
  return { kind: 'none', items: [] };
}
function rssItem(i: Record<string, unknown>): FeedItem | null {
  const url = text(i.link).trim() || text(i.guid).trim();
  if (!/^https?:\/\//.test(url)) return null;
  const media =
    (i['media:content'] as Record<string, unknown>[] | undefined)?.[0] ?? (i['media:thumbnail'] as Record<string, unknown> | undefined);
  const enclosure = i.enclosure as Record<string, unknown> | undefined;
  const image =
    text(media?.['@_url']) ||
    text(enclosure?.['@_url']) ||
    /<img[^>]+src=["']([^"']+)/i.exec(text(i['content:encoded']) + text(i.description))?.[1] ||
    undefined;
  return {
    url,
    title: decodeEntities(stripTags(text(i.title))).trim(),
    publishedAt: date(i.pubDate) ?? date(i.pubdate) ?? date(i['dc:date']),
    category: text((i.category as unknown[] | undefined)?.[0]).trim() || undefined,
    image,
    tags: i.category ? splitTags(i.category as unknown[]) : undefined,
    description:
      decodeEntities(stripTags(text(i.description)))
        .trim()
        .slice(0, 2000) || undefined,
    ...publisherSummary(text(i.description), 'feed:description', decodeEntities(stripTags(text(i.title))).trim()),
    creator: text(i['dc:creator']).trim() || undefined,
    contentHtml: text(i['content:encoded']).trim() || undefined,
  };
}
function sitemapItem(u: Record<string, unknown>): FeedItem | null {
  const url = text(u.loc).trim();
  if (!/^https?:\/\//.test(url)) return null;
  const news = u['news:news'] as Record<string, unknown> | undefined;
  const img = u['image:image'] as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const image = text(Array.isArray(img) ? img[0]?.['image:loc'] : img?.['image:loc']) || undefined;
  return {
    url,
    title: decodeEntities(stripTags(text(news?.['news:title']))).trim(),
    publishedAt: date(news?.['news:publication_date']),
    modifiedAt: date(u.lastmod),
    tags: news?.['news:keywords'] ? splitTags(news['news:keywords'] as unknown[]) : undefined,
    image,
  };
}
function atomItem(e: Record<string, unknown>): FeedItem | null {
  const links = (e.link as Record<string, unknown>[] | undefined) ?? [];
  const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
  const url = text(alt?.['@_href']).trim();
  if (!/^https?:\/\//.test(url)) return null;
  return {
    url,
    title: decodeEntities(stripTags(text(e.title))).trim(),
    publishedAt: date(e.published) ?? date(e.updated),
    tags: e.category ? (e.category as Record<string, unknown>[]).map((c) => text(c['@_term'])).filter(Boolean) : undefined,
    description:
      decodeEntities(stripTags(text(e.summary) || text(e.content)))
        .trim()
        .slice(0, 2000) || undefined,
    ...publisherSummary(text(e.summary), 'feed:summary', decodeEntities(stripTags(text(e.title))).trim()),
    creator: text((e.author as Record<string, unknown> | undefined)?.name).trim() || undefined,
  };
}
