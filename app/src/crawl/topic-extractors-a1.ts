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
