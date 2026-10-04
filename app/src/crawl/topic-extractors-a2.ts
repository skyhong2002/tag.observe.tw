import { extractTopics, type TopicItem, type TopicRule } from './topics.ts';

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
