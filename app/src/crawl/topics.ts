import * as cheerio from 'cheerio';
import { fetchText } from './fetch.ts';
import { decodeEntities, resolveUrl, stripTracking } from './text.ts';
import { registrable } from './topic-page.ts';

// Port of topic/maint/crawler/*_topic.php. The legacy scripts sliced HTML by
// literal markers that have since drifted for most sites; these rules match
// the current pages by link pattern instead. `TOPIC_LINKS` (app/src/topic-html.js)
// keeps the public listing URLs for the UI.
export interface TopicItem {
  url: string;
  title: string;
  image: string | null;
  category: string | null;
}
export interface TopicRule {
  media: string;
  /** Display name for outlets missing from app/data/favicon-catalog.json. */
  name?: string;
  /** The outlet's own share image (homepage og:image): cover for topics without one. */
  fallbackImage: string;
  url: string;
  pattern: RegExp;
  /** Only consider links inside this selector (skips nav/menu links). */
  scope?: string;
  /** Replaces link scraping for pages whose topics live in embedded data. */
  extract?: (html: string, rule: TopicRule) => TopicItem[];
  /** Selector for the cover image when the first <img> is an overlay. */
  image?: string;
  title?: (a: cheerio.Cheerio<import('domhandler').Element>, $: cheerio.CheerioAPI) => string;
  userAgent?: string;
  /** Additional official indexes; each has independent extraction and health. */
  listings?: Omit<TopicRule, 'media' | 'name' | 'fallbackImage' | 'listings'>[];
}

const textOf = (a: cheerio.Cheerio<import('domhandler').Element>) =>
  decodeEntities(a.text().replace(/\s+/g, ' ').trim()) ||
  decodeEntities(a.attr('title') ?? '') ||
  decodeEntities(a.find('img').attr('alt') ?? '');
// Card links whose visible text mixes date, counters and summary: take the heading.
const heading = (a: cheerio.Cheerio<import('domhandler').Element>) =>
  decodeEntities(a.find('h1,h2,h3,h4,h5').first().text().replace(/\s+/g, ' ').trim()) || textOf(a);
export const TOPIC_RULES: TopicRule[] = [
  // newtalk anchors carry the latest article title; the topic name is the URL slug.
  {
    media: 'newtalk',
    fallbackImage: 'https://newtalk.tw/images/ogimage.jpg',
    url: 'https://newtalk.tw/news/topics/list',
    pattern: /\/news\/topics\/view\/\d+/,
    title: (a) => {
      try {
        return decodeURIComponent((a.attr('href') ?? '').split('/').pop() ?? '');
      } catch {
        return '';
      }
    },
  },
  {
    media: 'setn',
    fallbackImage: 'https://attach.setn.com/images/setn_1200x676_20250103.png',
    url: 'https://www.setn.com/Plist.aspx',
    pattern: /\/(klist|project)\/\d+/i,
    title: (a) => a.find('.title').first().text().trim() || heading(a),
  },
  {
    media: 'cts',
    fallbackImage: 'https://news.cts.com.tw/assets/fb_img.jpg',
    url: 'https://news.cts.com.tw/topic/',
    pattern: /\/topic\/[0-9a-f-]{36}/,
    extract: nuxtTopics,
  },
  {
    media: 'ebc',
    fallbackImage: 'https://news.ebc.net.tw/img/ebc_news.jpg',
    url: 'https://news.ebc.net.tw/topic',
    pattern: /\/topic\/\d+/,
  },
  {
    media: 'cna',
    fallbackImage: 'https://imgcdn.cna.com.tw/www/images/pic_fb.jpg',
    url: 'https://www.cna.com.tw/list/newstopic.aspx',
    pattern: /\/topic\/newstopic\/\d+\.aspx/,
    listings: [
      {
        url: 'https://www.cna.com.tw/project/project_list/api/specialfeature.json',
        pattern: /\/(project|cards|story)\//,
        extract: cnaDigitalTopics,
      },
    ],
  },
  {
    media: 'tvbs',
    fallbackImage: 'https://news.tvbs.com.tw/assets/default_og_image.DD7eKhl_.png',
    url: 'https://news.tvbs.com.tw/pack/packnews',
    pattern: /\/(pack|topics)\/[a-z]*\/?\d+/,
  },
  // Each card also links its articles as hotTopic/N#topic-link-M; the JSON-LD
  // ItemList carries the clean topic names.
  {
    media: 'pts',
    fallbackImage: 'https://news.pts.org.tw/images/ptsnews-banner.jpg',
    url: 'https://news.pts.org.tw/hotTopic',
    pattern: /\/hotTopic\/\d+$/,
    extract: ldTopics,
  },
  {
    media: 'udn',
    fallbackImage: 'https://udn.com/static/img/UDN_BABY.png',
    url: 'https://topic.udn.com/issue/index',
    pattern: /topic\.udn\.com\/(issue\/cards|newstopic|event)\/[\w-]+/,
    title: heading,
  },
  // The homepage keyword bar (.h_kw) is LTN's curated list of running topics;
  // other /topic/ links on the page are per-article tags that churn hourly.
  {
    media: 'ltn',
    fallbackImage: 'https://news.ltn.com.tw/assets/images/all/250_ltn.png',
    url: 'https://news.ltn.com.tw/',
    pattern: /news\.ltn\.com\.tw\/topic\/[^/?#]+/,
    scope: '.h_kw',
    listings: [
      {
        url: 'https://features.ltn.com.tw/',
        pattern: /ltn\.com\.tw\//,
        scope: '.project',
        title: (a) => decodeEntities(a.find('img').attr('alt') ?? '') || heading(a),
      },
      {
        url: 'https://features.ltn.com.tw/special_topic',
        pattern: /features\.ltn\.com\.tw\/[^/?#]+/,
        scope: '.project',
        title: (a) => decodeEntities(a.find('img').attr('alt') ?? '') || heading(a),
      },
    ],
  },
  {
    media: 'nextapple',
    fallbackImage: 'https://static.nextapple.tw/web/layout/img/index.jpg',
    url: 'https://news.nextapple.com/collection/topic',
    pattern: /\/collection\/topic\/[^/?#]+/,
  },
  {
    media: 'ctwant',
    fallbackImage: 'https://static.ctwant.com/images/dist/ctwant.jpg',
    url: 'https://www.ctwant.com/topic/',
    pattern: /\/topic\/\d+/,
    scope: '.p-topic__list',
    image: 'img.cover',
    title: heading,
  },
  {
    media: 'taisounds',
    fallbackImage: 'https://www.taisounds.com/images/default_og_img.png',
    url: 'https://www.taisounds.com/special/topiclist',
    pattern: /\/special\/topic\/\d+/,
    title: heading,
  },
  {
    media: 'upmedia',
    fallbackImage: 'https://www.upmedia.mg/images/sitelogo.png',
    url: 'https://www.upmedia.mg/tw/project',
    pattern: /\/tw\/project\/project-\d+/,
  },
  // /topic/ itself redirect-loops; the homepage lists the running topics, each
  // "more" link sitting next to its title (banners link to index2 pages).
  {
    media: 'ftv',
    fallbackImage: 'https://cdn.ftvnews.com.tw/client/images/img-default.jpg',
    url: 'https://www.ftvnews.com.tw/',
    pattern: /^\/topic\/[\w-]+\/?$|topic\.ftvnews\.com\.tw\/[\w-]+\/?$/,
    title: (a) => decodeEntities(a.parent().find('.tw-font-bold').first().text().trim()) || textOf(a),
  },
  {
    media: 'twreporter',
    fallbackImage: 'https://www.twreporter.org/images/og-image-large.jpg',
    name: '報導者',
    url: 'https://www.twreporter.org/topics',
    pattern: /^\/topics\/[\w-]+$/,
    title: heading,
  },
  // Covers are only in the RSC payload (the <img> is a loading gif).
  {
    media: 'mirrordaily',
    fallbackImage: 'https://www.mirrordaily.news/images-next/default-image.png',
    name: '鏡報',
    url: 'https://www.mirrordaily.news/topic',
    pattern: /^\/topic\/\w+$/,
    title: (a) => decodeEntities(a.find('p.font-bold').first().text().trim()) || textOf(a),
  },
  {
    media: 'ettoday',
    url: 'https://www.ettoday.net/feature/index',
    fallbackImage: 'https://cdn2.ettoday.net/style/ettoday2017/images/push.jpg',
    pattern: /\/feature\/(?!index(?:[/?#]|$))[^/?#]+/,
    scope: '.part_pictxt_2, .part_pictxt_1',
    title: heading,
  },
  {
    media: 'mirror',
    url: 'https://www.mirrormedia.mg/section/topic',
    fallbackImage: 'https://www.mirrormedia.mg/images-next/default-og-img.png',
    pattern: /^\/topic\/[^/?#]+$/,
    scope: 'main',
    title: (a) => a.find('[class*="ItemTitle"]').first().text().trim() || heading(a),
  },
  {
    media: 'gvm',
    url: 'https://www.gvm.com.tw/topic',
    fallbackImage: 'https://www.gvm.com.tw/public/images/og-img.jpg',
    pattern: /\/topic\/\d+$/,
    scope: '.info-cards',
    title: (a) => a.find('.info-cards_title').text().trim() || heading(a),
  },
  {
    media: 'cw',
    url: 'https://www.cw.com.tw/special',
    fallbackImage: 'https://www.cw.com.tw/assets_new/img/fbshare.jpg',
    pattern: /cw\.com\.tw\/feature\/[^/?#]+\/[^/?#]+/,
    scope: '.articleGroup',
    title: (a) => a.closest('section.article').find('h3').first().text().trim() || textOf(a),
  },
  {
    media: 'bnext',
    url: 'https://www.bnext.com.tw/topics',
    fallbackImage: '/favicons/bnext.png',
    pattern: /\/topic\/view\/\d+$/,
    title: (a) => heading(a.parent()),
  },
  {
    media: 'inside',
    url: 'https://www.inside.com.tw/features',
    fallbackImage: 'https://bucket-image.inkmaginecms.com/version/hd/1/image/2024/09/6E1YHpoonTPnJJLNMbuiSwIji7p44zz384wR6Ips.jpg',
    pattern: /\/feature\/[^/?#]+$/,
    scope: '.post_list',
    title: (a) => a.closest('.post_list_item').find('.post_title').text().trim() || textOf(a),
  },
  {
    media: 'nownews',
    url: 'https://www.nownews.com/topics/',
    fallbackImage: 'https://www.nownews.com/icon/banner.jpg',
    pattern: /nownews\.com\//,
    extract: nownewsTopics,
  },
  // The dedicated /topic index currently returns a challenge; the public
  // homepage also carries the editor-selected topic links (not article tags).
  {
    media: 'ctee',
    url: 'https://www.ctee.com.tw/',
    fallbackImage: 'https://static.ctee.com.tw/img/ctee-logo-main.png?20260825',
    pattern: /ctee\.com\.tw\/topic\/[^/?#]+\/\d+-\d+/,
    title: heading,
  },
];

export function extractTopics(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  const out = new Map<string, { url: string; title: string; guessed: boolean; image: string | null }>();
  (rule.scope ? $(rule.scope).find('a[href]') : $('a[href]')).each((_, el) => {
    const a = $(el);
    const href = a.attr('href') ?? '';
    if (!rule.pattern.test(href)) return;
    const resolved = resolveUrl(href, rule.url);
    if (!resolved || registrable(new URL(resolved).hostname) !== registrable(new URL(rule.url).hostname)) return;
    const url = stripTracking(resolved);
    let title = rule.title ? rule.title(a, $) : textOf(a);
    // Anchor text that is just a date/time or a generic label is not a topic
    // name; use the card heading instead.
    let guessed = false;
    if (!title || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(title) || /^(→\s*)?(看更多|more|更多|閱讀|詳全文)/i.test(title)) {
      const card = a.closest('li, article, div');
      const heading = decodeEntities(card.find('h1,h2,h3,h4,.title,[class*=title]').first().text().replace(/\s+/g, ' ').trim());
      if (heading) [title, guessed] = [heading, true];
    }
    if (!title || title.length < 2 || /^(→\s*)?(看更多|more|更多|閱讀)/i.test(title)) return;
    const imgSel = rule.image ?? 'img';
    const imgEl = a.find(imgSel).first().length ? a.find(imgSel).first() : a.closest('li, article, div').find(imgSel).first();
    const imgSrc = imgEl.attr('data-src') || imgEl.attr('data-original') || imgEl.attr('src') || null;
    const image = imgSrc && !/^data:|loading\.gif|imageholder|placeholder/i.test(imgSrc) ? resolveUrl(imgSrc, rule.url) : null;
    // A "more" link's card heading can be an article inside the topic block
    // (EBC), so the topic link's own text wins over a guessed heading.
    const prev = out.get(url);
    const keepTitle = prev && (prev.guessed === guessed ? prev.title.length >= title.length : !prev.guessed);
    if (!prev || !keepTitle || (!prev.image && image))
      out.set(url, {
        url,
        title: keepTitle ? prev.title : title.slice(0, 512),
        guessed: keepTitle ? prev.guessed : guessed,
        image: image ?? prev?.image ?? null,
      });
  });
  return [...out.values()].map(({ url, title, image }) => ({ url, title, image, category: null }));
}

export function topicListings(rule: TopicRule): TopicRule[] {
  return [rule, ...(rule.listings ?? []).map((listing) => ({ media: rule.media, fallbackImage: rule.fallbackImage, ...listing }))];
}

export async function fetchTopicListings(rule: TopicRule, fetch = fetchText) {
  const items = new Map<string, TopicItem>();
  const sources: { url: string; items: number; error?: string }[] = [];
  for (const listing of topicListings(rule)) {
    try {
      const res = await fetch(listing.url, { userAgent: listing.userAgent });
      if (res.status < 200 || res.status >= 400) throw Error(`HTTP ${res.status}`);
      const found = (listing.extract ?? extractTopics)(res.body, { ...listing, url: res.url || listing.url });
      if (!found.length) throw Error('no topic links matched');
      for (const item of found) if (!items.has(item.url)) items.set(item.url, item);
      sources.push({ url: listing.url, items: found.length });
    } catch (error) {
      sources.push({ url: listing.url, items: 0, error: (error as Error).message });
    }
  }
  return { items: [...items.values()], sources };
}

export async function fetchTopics(rule: TopicRule, fetch = fetchText): Promise<TopicItem[]> {
  const result = await fetchTopicListings(rule, fetch);
  if (!result.items.length) throw Error(result.sources.map((s) => `${s.url}: ${s.error}`).join('; '));
  return result.items;
}

export function cnaDigitalTopics(json: string, rule: TopicRule): TopicItem[] {
  const data = JSON.parse(json) as {
    NewsItems?: { PageUrl?: string; HeadLine?: string; Source?: string; ClassName?: string; IsAd?: string }[];
  };
  return (data.NewsItems ?? []).flatMap((item) => {
    const url = item.PageUrl && resolveUrl(item.PageUrl, rule.url);
    const title = decodeEntities(item.HeadLine?.trim() ?? '');
    if (!url || !title || item.IsAd === 'Y' || registrable(new URL(url).hostname) !== 'cna.com.tw' || !rule.pattern.test(url)) return [];
    return [
      {
        url: stripTracking(url),
        title: title.slice(0, 512),
        image: item.Source ? resolveUrl(item.Source, rule.url) : null,
        category: item.ClassName ?? null,
      },
    ];
  });
}

export function nownewsTopics(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  return $('a[data-sec="topics"][data-tracetype="brand"]')
    .toArray()
    .flatMap((el) => {
      const a = $(el),
        card = a.closest('.list-item');
      const url = resolveUrl(a.attr('href') ?? '', rule.url);
      const title = decodeEntities(card.find('.topic-title').text().trim());
      if (!url || !title || registrable(new URL(url).hostname) !== 'nownews.com') return [];
      const image = card.find('img').attr('src');
      return [{ url: stripTracking(url), title, image: image ? resolveUrl(image, rule.url) : null, category: null }];
    });
}

// Topic names from a JSON-LD ItemList, covers from the page's links.
export function ldTopics(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  const covers = new Map(extractTopics(html, rule).map((t) => [t.url, t.image]));
  const out = new Map<string, TopicItem>();
  $('script[type="application/ld+json"]').each((_, el) => {
    let doc: { '@type'?: string; itemListElement?: Array<{ url?: string; name?: string }> };
    try {
      doc = JSON.parse($(el).text());
    } catch {
      return;
    }
    if (doc['@type']?.toLowerCase() !== 'itemlist') return;
    for (const item of doc.itemListElement ?? []) {
      const url = item.url && resolveUrl(item.url, rule.url);
      const title = decodeEntities(item.name?.trim() ?? '');
      if (url && title && rule.pattern.test(url) && !out.has(url))
        out.set(url, { url, title: title.slice(0, 512), image: covers.get(url) ?? null, category: null });
    }
  });
  return out.size ? [...out.values()] : extractTopics(html, rule);
}

// Nuxt 3 pages serialise their state as a flat JSON array (devalue): objects
// hold indexes into the array. Topic records are the objects with a title,
// cover and a link matching the rule; anchors only exist for the nav subset.
export function nuxtTopics(html: string, rule: TopicRule): TopicItem[] {
  const $ = cheerio.load(html);
  let data: unknown[];
  try {
    data = JSON.parse($('script#__NUXT_DATA__').text());
  } catch {
    return extractTopics(html, rule);
  }
  const str = (i: unknown) => (typeof i === 'number' && typeof data[i] === 'string' ? (data[i] as string) : null);
  const out = new Map<string, TopicItem>();
  for (const o of data) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) continue;
    const r = o as Record<string, unknown>;
    const link = str(r.link);
    const title = str(r.title)?.trim();
    if (!link || !title || !rule.pattern.test(link)) continue;
    const url = resolveUrl(link, rule.url);
    const img = str(r.thumbImageUrl) ?? str(r.imageUrl);
    if (url && !out.has(url)) out.set(url, { url, title: title.slice(0, 512), image: img && resolveUrl(img, rule.url), category: null });
  }
  return out.size ? [...out.values()] : extractTopics(html, rule);
}
