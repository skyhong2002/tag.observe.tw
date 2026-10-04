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
