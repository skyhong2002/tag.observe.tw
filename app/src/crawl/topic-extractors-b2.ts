import * as cheerio from 'cheerio';
import { resolveUrl, stripTracking } from './text.ts';
import { extractTopics, type TopicItem, type TopicRule } from './topics.ts';

// 聯合早報 /special/<x> are permanent beats (中美关系, 台海局势) that never
// close; /specials/<x> are event pages (elections, budgets) left to auto.
export function zaobaoSpecials(html: string, rule: TopicRule): TopicItem[] {
  return extractTopics(html, rule).map((t) => (/\/special\/[^/]+$/.test(new URL(t.url).pathname) ? { ...t, kind: 'topic' } : t));
}

// 女人迷 特別企劃: brand packages carry a 品牌贊助 badge on their card.
export function womanyCollections(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  const sponsored = new Set(
    $('.collection-item:has(.sponsorship) a[href]')
      .toArray()
      .flatMap((a) => {
        const url = resolveUrl($(a).attr('href') ?? '', rule.url);
        return url ? [stripTracking(url)] : [];
      }),
  );
  return extractTopics(html, rule).map((t) => ({ ...t, sponsored: sponsored.has(t.url) }));
}

// 地球圖輯隊 links each topic with ?redirect=<listing page> (its back link), so
// a topic's URL would change as it moves down the list; keep the page-1 form
// that existing rows were stored under.
export function wycTopics(html: string, rule: TopicRule): TopicItem[] {
  return extractTopics(html, rule).map((t) => ({ ...t, url: t.url.replace(/(\/topic\/\d+\/1)(?:\?redirect=\d+)?$/, '$1?redirect=1') }));
}
