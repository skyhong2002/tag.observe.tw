import * as cheerio from 'cheerio';
import { resolveUrl } from './text.ts';
import { extractTopics, nuxtTopics, type TopicItem, type TopicRule } from './topics.ts';

// Extractors for batch a2 outlets. Only referenced from inside function bodies
// so the circular import with topics.ts is safe.

/** 三立: /klist/ keyword feeds keep growing (議題); /project/ pages mix
 *  running programmes with one-off packages, so they stay auto. */
export function setnTopics(html: string, rule: TopicRule): TopicItem[] {
  return extractTopics(html, rule).map((item) => (/\/klist\//i.test(item.url) ? { ...item, kind: 'topic' } : item));
}

/** ETtoday /feature/index: the main list, plus the 熱門快報 sidebar whose
 *  feature links are paid promos (nofollow, e.g. 2021house) — kept as 合作. */
export function ettodayFeatureIndex(html: string, rule: TopicRule): TopicItem[] {
  const promos = extractTopics(html, { ...rule, scope: '#hot-events' }).map((item) => ({ ...item, sponsored: true }));
  const promoted = new Set(promos.map((item) => item.url));
  return [...extractTopics(html, { ...rule, scope: '.part_pictxt_2' }).filter((item) => !promoted.has(item.url)), ...promos];
}

/** 華視 /topic/: each topic record in the Nuxt payload also carries its latest
 *  articles with publishTime (Taipei, "YYYY-MM-DD HH:MM:SS"), so the listing
 *  alone can classify it. */
export function ctsTopics(html: string, rule: TopicRule): TopicItem[] {
  const items = nuxtTopics(html, rule);
  let data: unknown[];
  try {
    data = JSON.parse(cheerio.load(html)('script#__NUXT_DATA__').text());
  } catch {
    return items;
  }
  const at = (i: unknown) => (typeof i === 'number' ? data[i] : undefined);
  const dates = new Map<string, Date[]>();
  for (const o of data) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) continue;
    const r = o as Record<string, unknown>;
    const link = at(r.link);
    const list = at(r.articles);
    if (typeof link !== 'string' || !Array.isArray(list)) continue;
    const url = resolveUrl(link, rule.url);
    const found = list.flatMap((i) => {
      const a = at(i) as Record<string, unknown> | undefined;
      const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(at(a?.publishTime) ?? ''));
      return m ? [new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5]))] : [];
    });
    if (url && found.length) dates.set(url, found);
  }
  return items.map((item) => (dates.has(item.url) ? { ...item, storyDates: dates.get(item.url) } : item));
}

/** 民視 homepage: /topic/<slug>/ blocks are running topics (議題); the
 *  topic.ftvnews.com.tw microsites stay auto. Banners link a microsite's
 *  /index2 page and carry only a filename-like alt ("9in1"), so they count
 *  only once normalised and with a real name. */
export function ftvTopics(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  $('a[href*="topic.ftvnews.com.tw/"]').each((_, el) => {
    const a = $(el);
    a.attr('href', (a.attr('href') ?? '').replace(/\/index2(?=[?#]|$)/, ''));
    if (!a.text().trim() && !/[㐀-鿿]/.test(a.find('img').attr('alt') ?? '')) a.removeAttr('href');
  });
  return extractTopics($.html(), rule).map((item) =>
    new URL(item.url).hostname === 'www.ftvnews.com.tw' ? { ...item, kind: 'topic' } : item,
  );
}

/** 台視 /Projs/: a series name can hold spaces (/Proj/台視60  璀璨年代), which
 *  the generic href cleaner rejects as template junk; the encoded URL works. */
export function ttvProjects(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  $('a[href*="/Proj/"]').each((_, el) => {
    const a = $(el);
    a.attr(
      'href',
      (a.attr('href') ?? '').trim().replace(/\s/g, (c) => encodeURIComponent(c)),
    );
  });
  return extractTopics($.html(), rule);
}

// Focus+ packages that are recurring columns, not one-offs, besides the
// #columns block: the daily cover story and the deals column.
const NEXTAPPLE_COLUMNS = new Set(['cover-story', 'save-money']);
/** 壹蘋 Focus+ (special.nextapple.com): the footer lists every package by its
 *  plain name (cards prefix a rank and columns add a blurb). Columns are 議題;
 *  the rest mixes one-offs with running files, so auto. */
export function nextappleSpecial(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  const slug = (href: string) => /^https:\/\/special\.nextapple\.com\/([^/?#]+)/.exec(resolveUrl(href, rule.url) ?? '')?.[1];
  const columns = new Set(NEXTAPPLE_COLUMNS);
  $('#columns a[href]').each((_, el) => {
    const s = slug($(el).attr('href') ?? '');
    if (s) columns.add(s);
  });
  const out = new Map<string, TopicItem>();
  for (const item of extractTopics(html, { ...rule, scope: '.f-topics' })) {
    const s = slug(item.url);
    if (!s) continue;
    // The same package is linked with and without a trailing slash.
    const url = `https://special.nextapple.com/${s}`;
    if (!out.has(url)) out.set(url, { ...item, url, ...(columns.has(s) ? { kind: 'topic' as const } : {}) });
  }
  return [...out.values()];
}
