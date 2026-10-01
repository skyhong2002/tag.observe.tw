import * as cheerio from 'cheerio';
import { urlKey } from './text.ts';

// A topic page (an outlet's 專題 page) lists the outlet's own stories on the
// topic, next to site-wide navigation, "latest news" sidebars and footers.
// Outlets mark these up differently, so instead of a rule per outlet the page's
// links are grouped by their container (the tag.class chain of the nearest
// ancestors): the topic's list is one such group. The caller picks the group
// (topics-job) and derives a tag from its stories (sharedTag).

export interface TopicStory {
  key: string; // url_key, comparable with articles.url_key
  title: string; // text of the story's list item, for stories we never crawled
}

const DEPTH = 4;
const TWO_LEVEL = new Set(['com.tw', 'org.tw', 'net.tw', 'gov.tw', 'edu.tw', 'idv.tw', 'co.uk', 'com.hk', 'co.jp', 'com.cn', 'com.sg']);
/** example.com.tw for news.example.com.tw: topic sites (topic.udn.com) link stories on the main host (udn.com). */
export function registrable(host: string): string {
  const parts = host.toLowerCase().split('.');
  const last2 = parts.slice(-2).join('.');
  return parts.length > 2 && TWO_LEVEL.has(last2) ? parts.slice(-3).join('.') : last2;
}

/** Link groups on a topic page (same registrable domain), keyed by container signature, largest first. */
export function topicPageGroups(html: string, pageUrl: string, articleId?: string): TopicStory[][] {
  const $ = cheerio.load(html);
  $('header, footer, nav, aside, script, style').remove();
  const base = new URL(pageUrl);
  const site = registrable(base.hostname);
  const groups = new Map<string, Map<string, string>>();
  $('a[href]').each((_, a) => {
    let u: URL;
    try {
      u = new URL($(a).attr('href') ?? '', base);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol) || registrable(u.hostname) !== site) return;
    if (u.pathname.replace(/\/+$/, '') === '' && !u.search) return;
    const sig = $(a)
      .parents()
      .slice(0, DEPTH)
      .toArray()
      .map((e) => `${(e as { tagName?: string }).tagName}.${($(e).attr('class') ?? '').trim().split(/\s+/)[0]}`)
      .join('<');
    // The list item carries the headline even when the link wraps only an
    // image or a date (華視's topic grid links its dates).
    const item = $(a).closest('li, article');
    const title = (item.length ? item.text() : $(a).text()).replace(/\s+/g, ' ').trim().slice(0, 160);
    const group = groups.get(sig) ?? new Map<string, string>();
    const key = urlKey(u.href, articleId);
    if ((group.get(key)?.length ?? 0) < title.length) group.set(key, title);
    groups.set(sig, group);
  });
  return [...groups.values()].map((g) => [...g].map(([key, title]) => ({ key, title }))).sort((a, b) => b.length - a.length);
}

/** A group reads like a story list when most items have headline-length text. */
export function looksLikeStories(group: TopicStory[]): boolean {
  const headlines = group.filter((s) => [...s.title.replace(/[\d\s\p{P}\p{S}]/gu, '')].length >= 8).length;
  return group.length >= 3 && headlines / group.length >= 0.6;
}

/**
 * The tag a topic page's own stories clearly share: in at least 2 of them and
 * half of them, or 3 and 30%. A tag used by over 300 articles this week (台股,
 * 台積電) needs half of the stories, so a finance show is not reduced to every
 * market story. Ties go to the more specific tag (fewer articles site-wide).
 * Returns null when the stories have nothing distinctive in common.
 */
const BROAD = 300;
export function sharedTag(storyTags: string[][], freq: (tag: string) => number | undefined): string | null {
  const n = storyTags.length;
  const count = new Map<string, number>();
  for (const tags of storyTags) for (const t of new Set(tags)) count.set(t, (count.get(t) ?? 0) + 1);
  const ok = [...count].filter(([t, c]) => {
    const f = freq(t);
    if (f === undefined) return false;
    const share = c / n;
    return f > BROAD ? c >= 2 && share >= 0.5 : (c >= 2 && share >= 0.5) || (c >= 3 && share >= 0.3);
  });
  ok.sort((a, b) => b[1] - a[1] || (freq(a[0]) ?? 0) - (freq(b[0]) ?? 0));
  return ok[0]?.[0] ?? null;
}
