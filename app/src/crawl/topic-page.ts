import * as cheerio from 'cheerio';
import { parsePublished } from './article.ts';
import { dateFromAttr, dateFromText } from './story-date.ts';
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
  date?: string; // ISO publish date the topic page (or the story's own page) shows, if any
  /** The story's own page was read and shows no publish date: not fetched again. */
  dateless?: true;
  /** The link as found on the topic page (not stored: the key is kept). */
  url?: string;
}

const DEPTH = 4;
const TWO_LEVEL = new Set(['com.tw', 'org.tw', 'net.tw', 'gov.tw', 'edu.tw', 'idv.tw', 'co.uk', 'com.hk', 'co.jp', 'com.cn', 'com.sg']);
/** example.com.tw for news.example.com.tw: topic sites (topic.udn.com) link stories on the main host (udn.com). */
export function registrable(host: string): string {
  const parts = host.toLowerCase().split('.');
  const last2 = parts.slice(-2).join('.');
  return parts.length > 2 && TWO_LEVEL.has(last2) ? parts.slice(-3).join('.') : last2;
}

/** The topic page's share image, for listings that give no cover (navigation
 *  bars, client-rendered cards). Outlet-wide logos are filtered by the caller. */
export function topicPageImage(html: string, pageUrl: string): string | null {
  const $ = cheerio.load(html);
  const raw = $('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"], meta[itemprop="image"]')
    .map((_, el) => $(el).attr('content') ?? '')
    .get()
    .map((v) =>
      v
        .trim()
        .replace(/^url\((.*?)\)?$/s, '$1')
        .trim(),
    )
    .find((v) => v && !/^data:/i.test(v));
  if (!raw) return null;
  try {
    const u = new URL(raw, pageUrl);
    return /^https?:$/.test(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

type Node = ReturnType<cheerio.CheerioAPI>[number];
const DATE_ATTRS = ['datetime', 'data-time', 'data-date', 'data-published', 'data-timestamp'];
const DATED = 'time, [datetime], [data-time], [data-date], [data-published], [data-timestamp], [content]';
const DATE_PROP = /date|time|publish/i;

// A byline or date line; longer text is a headline or summary, whose dates
// ("2011年10月5日，賈伯斯與世長辭") are not the story's.
const SHORT = 40;
const short = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= SHORT ? t : '';
};

/** A date shown in or on an element: date attributes first, then short text. */
function dateIn($: cheerio.CheerioAPI, el: cheerio.Cheerio<Node>, now: Date): Date | null {
  for (const e of [...el.toArray(), ...el.find(DATED).toArray()]) {
    const $e = $(e);
    for (const attr of DATE_ATTRS) {
      const d = dateFromAttr($e.attr(attr), now);
      if (d) return d;
    }
    const prop = `${$e.attr('itemprop') ?? ''} ${$e.attr('property') ?? ''} ${$e.attr('name') ?? ''}`;
    if ($e.attr('content') && DATE_PROP.test(prop)) {
      const d = dateFromAttr($e.attr('content'), now);
      if (d) return d;
    }
  }
  for (const e of [...el.toArray(), ...el.find('*').toArray()]) {
    const text = short($(e).text());
    const d = text && dateFromText(text, now);
    if (d) return d;
  }
  // A date line beside a headline in one element: its own text node.
  for (const e of [...el.toArray(), ...el.find('*').toArray()])
    for (const c of (e as { children?: Node[] }).children ?? []) {
      const text = c.type === 'text' && short((c as { data?: string }).data ?? '');
      const d = text && dateFromText(text, now);
      if (d) return d;
    }
  return null;
}

type Ld = Record<string, unknown>;
function ldNodes($: cheerio.CheerioAPI): Ld[] {
  const out: Ld[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) for (const x of v) visit(x);
    else if (v && typeof v === 'object') {
      out.push(v as Ld);
      for (const x of Object.values(v)) visit(x);
    }
  };
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      visit(JSON.parse($(s).text()));
    } catch {
      // Malformed JSON-LD is common; skip it.
    }
  });
  return out;
}
function ldUrl(n: Ld): string | undefined {
  const main = n.mainEntityOfPage;
  for (const v of [n.url, n['@id'], n.item, main && typeof main === 'object' ? (main as Ld)['@id'] : main])
    if (typeof v === 'string' && v) return v;
}
function ldDate(n: Ld, now: Date): Date | null {
  const item = n.item && typeof n.item === 'object' ? (n.item as Ld) : undefined;
  for (const v of [n.datePublished, n.dateCreated, n.dateModified, item?.datePublished, item?.dateModified])
    if (typeof v === 'string') {
      const d = dateFromAttr(v, now);
      if (d) return d;
    }
  return null;
}
function keyOf(url: string, base: URL | string, articleId?: string): string | null {
  try {
    return urlKey(new URL(url, base).href, articleId);
  } catch {
    return null;
  }
}

/** Story dates from the page's JSON-LD (ItemList / CollectionPage entries
 *  with a url and datePublished), by url_key. */
function ldStoryDates($: cheerio.CheerioAPI, base: URL, articleId: string | undefined, now: Date): Map<string, Date> {
  const out = new Map<string, Date>();
  // Parse with room for dates up to 9 hours ahead: some CMSs (鏡報) write Taipei
  // time with a Z suffix, which puts recent stories in the future.
  const ahead = new Date(+now + 9 * 3600e3);
  for (const n of ldNodes($)) {
    const url = ldUrl(n);
    const key = url && keyOf(url, base, articleId);
    const date = key && ldDate(n, ahead);
    if (key && date && !out.has(key)) out.set(key, date);
  }
  // A future date means the page's zone is mislabelled: shift the whole page back.
  const shift = [...out.values()].some((d) => +d > +now + 300e3) ? 8 * 3600e3 : 0;
  for (const [key, d] of out) {
    const t = +d - shift;
    if (t > +now + 3600e3) out.delete(key);
    else if (shift) out.set(key, new Date(t));
  }
  return out;
}

// Publish-time metas: article:/og:published_time, itemprop datePublished and
// the CMS variants (pubdate, publish_date, my:publish_date, parsely-pub-date).
// Never modified/updated times: a page refreshed today is not news of today.
const PUBLISHED_META =
  /^(?:[\w-]+[:-])?(?:published[_-]?time|publish(?:ed)?[_-]?date|pub[_-]?date|date[_-]?published|publication[_-]?date)$/i;

/**
 * When a page that is one article was published: its publish-time meta (or
 * <time itemprop="datePublished">), else the datePublished/dateCreated of the
 * page's own Article in JSON-LD (its url is the page's, the canonical URL or
 * absent). Null when the page is not an article. A time in the future means
 * Taipei time labelled UTC (as on topic pages, ldStoryDates): it is shifted
 * back 8 hours, and rejected if still ahead.
 */
export function topicPageDate(html: string, pageUrl: string, now = new Date()): Date | null {
  const $ = cheerio.load(html);
  const ahead = new Date(+now + 9 * 3600e3);
  const settle = (d: Date | null) => {
    if (!d) return null;
    const t = +d > +now + 300e3 ? +d - 8 * 3600e3 : +d;
    return t > +now + 3600e3 ? null : new Date(t);
  };
  for (const el of $('meta[content], time[datetime], [itemprop][content]').toArray()) {
    const $e = $(el);
    const names = [$e.attr('property'), $e.attr('name'), $e.attr('itemprop')].filter(Boolean) as string[];
    if (!names.some((n) => PUBLISHED_META.test(n.trim()))) continue;
    const d = settle(dateFromAttr($e.attr('content') ?? $e.attr('datetime'), ahead));
    if (d) return d;
  }
  const own = new Set([keyOf(pageUrl, pageUrl)]);
  for (const sel of ['link[rel="canonical"]', 'meta[property="og:url"]']) {
    const href = $(sel).first().attr('href') ?? $(sel).first().attr('content');
    const key = href && keyOf(href, pageUrl);
    if (key) own.add(key);
  }
  for (const n of ldNodes($)) {
    if (!/Article|BlogPosting|Report/.test([n['@type']].flat().join(' '))) continue;
    const url = ldUrl(n);
    if (url && !own.has(keyOf(url, pageUrl))) continue;
    for (const v of [n.datePublished, n.dateCreated]) {
      const d = typeof v === 'string' ? settle(dateFromAttr(v, ahead)) : null;
      if (d) return d;
    }
  }
  return null;
}

// How far after the headline a date line may sit (byline, share bar).
const BYLINE_REACH = 25;
/**
 * When a story's own page was published: topicPageDate, else a datePublished
 * in JSON-LD that does not parse as JSON (read as the article crawler does),
 * else the date line printed just after its headline (食力: <h1>…</h1><p
 * class="date">2015/10/08</p>) unless that line is an update time (更新/updated).
 */
export function storyPageDate(html: string, pageUrl: string, now = new Date()): Date | null {
  const meta = topicPageDate(html, pageUrl, now);
  if (meta) return meta;
  const raw = parsePublished(/"datePublished"\s*:\s*"([^"]+)"/.exec(html)?.[1]);
  if (raw && +raw <= +now + 3600e3 && raw.getUTCFullYear() >= 1995) return raw;
  const $ = cheerio.load(html);
  $('nav, aside, footer, script, style').remove();
  const all = $('body *').toArray();
  const h1 = all.indexOf($('h1').first()[0]);
  if (h1 < 0) return null;
  for (const el of all.slice(h1 + 1, h1 + 1 + BYLINE_REACH)) {
    const text = short($(el).text());
    if (!text || /更新|修改|update|modif/i.test(text)) continue;
    const d = dateFromText(text, now);
    if (d) return d;
  }
  return null;
}

/**
 * Link groups on a topic page (same registrable domain), keyed by container
 * signature, largest first. A story carries the date the page shows for it,
 * if any: from JSON-LD, the link itself, or the story's item — the largest
 * ancestor holding no other story of its group — and never from outside the
 * item, such as the page's own 更新時間 header.
 */
export function topicPageGroups(
  html: string,
  pageUrl: string,
  articleId?: string,
  { now = new Date() }: { now?: Date } = {},
): TopicStory[][] {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const ld = ldStoryDates($, base, articleId, now);
  $('header, footer, nav, aside, script, style').remove();
  const site = registrable(base.hostname);
  const self = urlKey(base.href, articleId);
  const links: Array<{ a: Node; sig: string; key: string; title: string; url: string }> = [];
  $('a[href]').each((_, a) => {
    let u: URL;
    try {
      u = new URL($(a).attr('href') ?? '', base);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol) || registrable(u.hostname) !== site) return;
    if (u.pathname.replace(/\/+$/, '') === '' && !u.search) return;
    const key = urlKey(u.href, articleId);
    // The page's own link (its title, a breadcrumb) is not one of its stories.
    if (key === self) return;
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
    links.push({ a, sig, key, title, url: u.href });
  });
  const bySig = new Map<string, typeof links>();
  for (const l of links) {
    const list = bySig.get(l.sig) ?? [];
    list.push(l);
    bySig.set(l.sig, list);
  }
  const groups: TopicStory[][] = [];
  for (const group of bySig.values()) {
    const chains = new Map(group.map((l) => [l, $(l.a).parents().toArray()]));
    // Which of the group's links each ancestor holds (up to three keys).
    const holdsKeys = (ls: typeof group) => {
      const holds = new Map<Node, Set<string>>();
      for (const l of ls)
        for (const p of chains.get(l) ?? []) {
          const keys = holds.get(p) ?? new Set<string>();
          if (keys.size < 3) keys.add(l.key);
          holds.set(p, keys);
        }
      return holds;
    };
    const all = holdsKeys(group);
    // A link repeated across items (a 新聞 label on every card) is not a story
    // of its own: its links' closest common ancestor holds other stories.
    const spread = new Set<string>();
    for (const key of new Set(group.map((l) => l.key))) {
      const ls = group.filter((l) => l.key === key);
      if (ls.length < 2) continue;
      const others = new Set(ls.slice(1).map((l) => chains.get(l)));
      const common = chains.get(ls[0])?.find((p) => [...others].every((c) => c?.includes(p)));
      if (common && (all.get(common)?.size ?? 0) >= 3) spread.add(key);
    }
    const holds = spread.size ? holdsKeys(group.filter((l) => !spread.has(l.key))) : all;
    // A lone story has no siblings to bound its item by: only its list item.
    const lone = new Set(group.map((l) => l.key).filter((k) => !spread.has(k))).size <= 1;
    const stories = new Map<string, TopicStory>();
    for (const l of group) {
      const story = stories.get(l.key) ?? { key: l.key, title: '', url: l.url };
      if (story.title.length < l.title.length) story.title = l.title;
      if (!story.date) {
        let date = ld.get(l.key) ?? dateIn($, $(l.a), now);
        if (!date && !spread.has(l.key)) {
          let item: Node | undefined = lone ? $(l.a).closest('li, article')[0] : undefined;
          if (!lone)
            for (const p of $(l.a).parents().toArray()) {
              if ((holds.get(p)?.size ?? 0) > 1 || (p as { tagName?: string }).tagName === 'body') break;
              item = p;
            }
          if (item) date = dateIn($, $(item), now);
        }
        if (date) story.date = date.toISOString();
      }
      stories.set(l.key, story);
    }
    groups.push([...stories.values()]);
  }
  return groups.sort((a, b) => b.length - a.length);
}

/** A group reads like a story list when most items have headline-length text. */
export function looksLikeStories(group: TopicStory[]): boolean {
  const headlines = group.filter((s) => headline(s.title)).length;
  return group.length >= 3 && headlines / group.length >= 0.6;
}

// Taxonomy and navigation pages: tag, category, author (womany /member/…),
// search and sponsored (newtalk /plan/view/…) listings are never one of the
// topic's stories.
const NAV_SEGMENT =
  /^(tags?|categor(y|ies)|cat|plans?|authors?|writers?|columnists?|search|keywords?|labels?|members?|login|signin|signup|register|subscribe|newsletter)$/i;
/** A link to a taxonomy or navigation page rather than a story. */
export function isNavigationKey(key: string): boolean {
  const path = key.replace(/^[^/#?]*/, '');
  if (path.startsWith('#')) return false; // host#articleId: an article
  return path
    .split('?')[0]
    .split('/')
    .some((seg) => NAV_SEGMENT.test(seg));
}

/**
 * The URL pattern of a url_key, for comparing a link with the outlet's article
 * URLs: host, the first path segment as is, later segments as # (digits only),
 * 9 (with digits: dates, slugs with ids) or _ (words). Queries are left out
 * (tracking and referral parameters vary):
 * newtalk.tw/news/view/2026-10-01/1063052 -> newtalk.tw/news/_/9/#.
 */
export function keyShape(key: string): string {
  const host = /^[^/#?]*/.exec(key)?.[0] ?? '';
  const rest = key.slice(host.length);
  if (rest.startsWith('#')) return `${host}#`;
  const segs = rest.split('?')[0].split('/').filter(Boolean);
  return `${host}/${segs.map((s, i) => (/^\d+$/.test(s) ? '#' : /\d/.test(s) ? '9' : i === 0 ? s.toLowerCase() : '_')).join('/')}`;
}

/** Shapes (keyShape) covering at least 2% of an outlet's article url_keys. */
export function articleShapes(keys: string[]): Set<string> {
  const count = new Map<string, number>();
  for (const k of keys) count.set(keyShape(k), (count.get(keyShape(k)) ?? 0) + 1);
  return new Set([...count].filter(([, n]) => n >= 2 && n >= keys.length * 0.02).map(([s]) => s));
}

/** What the outlet's other pages and our crawl say about a topic page's links. */
export interface StoryEvidence {
  /** Site furniture: the link is also on the outlet's other topic pages. */
  furniture: (key: string) => boolean;
  /** We crawled the story. */
  crawled: (key: string) => boolean;
  /** URL shapes of the outlet's articles (articleShapes); empty when unknown. */
  shapes?: Set<string>;
}

// Links whose text is a short label (tag, section, author names) rather than
// a headline. Untitled links (image-only cards) are not labels.
function labelLinks(group: TopicStory[]): boolean {
  const titles = group.map((s) => s.title).filter(Boolean);
  return titles.length >= 3 && titles.filter((t) => headline(t)).length / titles.length < 0.3;
}
const headline = (title: string) => [...title.replace(/[\d\s\p{P}\p{S}]/gu, '')].length >= 8;

/**
 * The topic's own story list among a topic page's link groups. Navigation and
 * taxonomy links (isNavigationKey) are dropped from every group; groups mostly
 * of such links, of short labels or of site furniture are skipped. Of the rest,
 * the group with the most stories we crawled (at least 2) wins, ties going to
 * more stories with an on-page date, then to links shaped like the outlet's
 * article URLs. Failing that (older stories, outlets we do not crawl), the
 * group that reads like headlines (looksLikeStories), preferring links shaped
 * like the outlet's articles, then the largest.
 */
export function pickTopicStories(groups: TopicStory[][], ev: StoryEvidence): TopicStory[] {
  const shapes = ev.shapes ?? new Set<string>();
  const share = (g: TopicStory[], f: (s: TopicStory) => boolean) => g.filter(f).length / g.length;
  const scored = groups
    .map((all) => ({ all, g: all.filter((s) => !isNavigationKey(s.key)) }))
    // A group mostly of navigation links is a taxonomy block, not a list with
    // a tag link on each card.
    .filter(({ all, g }) => g.length > all.length / 2 && !labelLinks(g) && share(g, (s) => ev.furniture(s.key)) <= 0.5)
    .map(({ all, g }) => ({
      all,
      g,
      crawled: g.filter((s) => ev.crawled(s.key)).length,
      dated: g.filter((s) => s.date).length,
      articles: shapes.size && share(g, (s) => shapes.has(keyShape(s.key))) >= 0.5 ? 1 : 0,
    }));
  const [best] = scored
    .filter((s) => s.crawled >= 2)
    .sort((a, b) => b.crawled - a.crawled || b.dated - a.dated || b.articles - a.articles || b.g.length - a.g.length);
  if (best) return best.g;
  // The list as laid out (its cards' tag links included) reads like headlines.
  const [listed] = scored
    .filter((s) => looksLikeStories(s.all))
    .sort((a, b) => b.articles - a.articles || b.g.length - a.g.length || b.dated - a.dated);
  if (listed) return listed.g;
  // Last resort: a page laying out its own few stories and the outlet's whole
  // catalogue in one container (食力's issue pages: the issue's articles, then
  // every other issue) has only furniture-heavy groups. What is left of a
  // group once the furniture is dropped is the topic's list when it is all
  // dated headlines, unlike a sidebar's not-yet-seen leftovers.
  const [rest] = groups
    .map((all) => all.filter((s) => !isNavigationKey(s.key) && !ev.furniture(s.key)))
    .filter((g) => g.length >= 2 && g.every((s) => s.date && headline(s.title)))
    .sort((a, b) => b.length - a.length);
  return rest ?? [];
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
