import { decodeEntities, resolveUrl, stripTracking } from './text.ts';
import { registrable } from './topic-page.ts';
import { extractTopics, type TopicItem, type TopicRule } from './topics.ts';

// Function declarations only: topics.ts imports this file and the two modules
// reference each other's functions at call time, never while loading.

/** CNA 新聞專題: page 1 is the HTML list, later pages come from the list's own
 *  JSON API (POST WNewsList). Both include microsites such as netzero.cna.com.tw. */
export function cnaNewsTopics(body: string, rule: TopicRule): TopicItem[] {
  if (!body.trimStart().startsWith('{')) return extractTopics(body, rule);
  const data = JSON.parse(body) as {
    ResultData?: { Items?: { PageUrl?: string; HeadLine?: string; ImageS?: string; ImageM?: string }[] };
  };
  return (data.ResultData?.Items ?? []).flatMap((item) => {
    const url = item.PageUrl && resolveUrl(item.PageUrl.trim(), rule.url);
    const title = decodeEntities(item.HeadLine?.trim() ?? '');
    if (!url || !title || registrable(new URL(url).hostname) !== 'cna.com.tw' || !rule.pattern.test(url)) return [];
    const image = item.ImageM || item.ImageS;
    return [{ url: stripTracking(url), title: title.slice(0, 512), image: image ? resolveUrl(image, rule.url) : null, category: null }];
  });
}

/** udn.com/topic/index mixes topic.udn.com/event/ packages (one-off 專題, e.g.
 *  優人物 profiles, health awareness pages) with running newstopic/cards pages. */
export function udnTopicIndex(html: string, rule: TopicRule): TopicItem[] {
  return extractTopics(html, rule).map((t) => (/topic\.udn\.com\/event\//.test(t.url) ? { ...t, kind: 'feature' as const } : t));
}

/** LTN special_topic is a list of yearly microsites (2026九合一選舉, wbc2026,
 *  115年學測) plus a few running columns without a year (每日一台語,
 *  中英對照讀新聞) that keep publishing daily: those are 議題. */
export function ltnSpecialTopics(html: string, rule: TopicRule): TopicItem[] {
  return extractTopics(html, rule).map((t) => (/\d{4}/.test(new URL(t.url).pathname) ? t : { ...t, kind: 'topic' as const }));
}
