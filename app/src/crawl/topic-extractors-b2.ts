import { extractTopics, type TopicItem, type TopicRule } from './topics.ts';

// 聯合早報 /special/<x> are permanent beats (中美关系, 台海局势) that never
// close; /specials/<x> are event pages (elections, budgets) left to auto.
export function zaobaoSpecials(html: string, rule: TopicRule): TopicItem[] {
  return extractTopics(html, rule).map((t) => (/\/special\/[^/]+$/.test(new URL(t.url).pathname) ? { ...t, kind: 'topic' } : t));
}
