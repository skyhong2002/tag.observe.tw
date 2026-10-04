import * as cheerio from 'cheerio';
import { decodeEntities, resolveUrl, stripTracking } from './text.ts';
import { cleanTopicHref, extractTopics, type TopicItem, type TopicRule } from './topics.ts';

// Topic listing extractors for outlets whose pages need more than link scraping.
// Function declarations (not consts): topics.ts imports this module while
// this module imports topics.ts, and declarations are ready before either runs.

const clip = (s: string) => decodeEntities(s.replace(/\s+/g, ' ').trim()).slice(0, 512);

/** 鏡週刊 /section/topic: the page renders 12 cards, its Next.js data carries 24 with covers. */
export function mirrorTopics(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  type Photo = { resized?: Record<string, string> } | null;
  let topics: { slug?: string; name?: string; heroImage?: Photo; og_image?: Photo }[];
  try {
    topics = JSON.parse($('script#__NEXT_DATA__').text()).props.pageProps.topics;
    if (!Array.isArray(topics)) throw Error('no topics');
  } catch {
    return extractTopics(html, rule);
  }
  return topics.flatMap((t) => {
    // A slug with a stray space (" forgedevidence") is CMS junk; cleanTopicHref drops it.
    const href = cleanTopicHref(`/topic/${t.slug ?? ''}`);
    const url = href && rule.pattern.test(href) ? resolveUrl(href, rule.url) : null;
    const title = clip(t.name ?? '');
    if (!url || title.length < 2) return [];
    const r = t.heroImage?.resized ?? t.og_image?.resized;
    const image = r?.w800 || r?.original || null;
    return [{ url: stripTracking(url), title, image, category: null }];
  });
}

/** 報導者's topic API (go-api.twreporter.org), the data behind /topics?page=N. */
export function twreporterTopics(json: string, rule: TopicRule): TopicItem[] {
  const data = JSON.parse(json) as {
    data?: { records?: { slug?: string; title?: string; og_image?: { resized_targets?: Record<string, { url?: string }> } }[] };
  };
  return (data.data?.records ?? []).flatMap((r) => {
    const url = r.slug ? `https://www.twreporter.org/topics/${encodeURIComponent(r.slug)}` : null;
    const title = clip(r.title ?? '');
    if (!url || title.length < 2 || !rule.pattern.test(url)) return [];
    const t = r.og_image?.resized_targets;
    return [{ url, title, image: t?.mobile?.url || t?.desktop?.url || null, category: null }];
  });
}

/** 太報 lists: page 1 is HTML, "more" pages are JSON wrapping the next cards' HTML. */
export function taisoundsTopics(body: string, rule: TopicRule): TopicItem[] {
  let html = body;
  if (/^\s*\{/.test(body)) html = (JSON.parse(body) as { htmlString?: string }).htmlString ?? '';
  return extractTopics(html, rule);
}
