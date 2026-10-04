import { extractTopics, type TopicItem, type TopicRule } from './topics.ts';

// Extractors for batch a2 outlets. Only referenced from inside function bodies
// so the circular import with topics.ts is safe.

/** 三立: /klist/ keyword feeds keep growing (議題); /project/ pages mix
 *  running programmes with one-off packages, so they stay auto. */
export function setnTopics(html: string, rule: TopicRule): TopicItem[] {
  return extractTopics(html, rule).map((item) => (/\/klist\//i.test(item.url) ? { ...item, kind: 'topic' } : item));
}
