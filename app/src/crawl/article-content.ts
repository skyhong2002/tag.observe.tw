import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { normalizeAuthorCredits } from './byline.ts';
import { decodeEntities, urlKey } from './text.ts';

export interface ArticleContent {
  body: string | null;
  authors: string[];
  bodySource: string;
  bodyStatus: 'ok' | 'missing' | 'short' | 'blocked';
}

type ContentRules = { bodySelector?: string; bodyHtmlSelector?: string; bodyExcludeSelector?: string; authorSelector?: string };
type JsonNode = Record<string, unknown>;
type Candidate = { body: string; source: string };

// Count content, rather than whitespace or encoded bytes, for the minimum body.
const contentLength = (value: string) => Array.from(value.replace(/\s/g, '')).length;
const normalize = (value: string) =>
  decodeEntities(value)
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const BODY_SELECTORS = [
  '[itemprop="articleBody"]',
  '[data-article-body]',
  '#article-body',
  '#articleBody',
  '.article-body',
  '.article__body',
  '.article-content',
  '.article_content',
  '.articleContent',
  '.story-body',
  '.story_body',
  '#story_body_content',
  '.news-content',
  '.news_content',
  '#newsContent',
  '.caas-body',
  '.entry-content',
  '.post-content',
  '.td-post-content',
  '.elementor-widget-theme-post-content',
  'founder-content',
  '.PrimarySide > .paragraph',
  '.article-main',
  'article',
];
const REMOVE_ELEMENTS =
  'script, style, noscript, template, iframe, nav, aside, footer, form, button, figure, figcaption, img, video, audio, ' +
  '[hidden], [aria-hidden="true"], [role="navigation"], [role="complementary"], [itemprop="author"], [rel="author"], ' +
  '.ph_b, .appE1121, .udn-privilege-details, .further-reading__box';
// Match whole class/id words so a normal article's "loading" or "address"
// does not turn into an ad/challenge signal.
const EXCLUDED_CLASS =
  /(?:^|[\s_-])(?:ads?|advertisement|advertorial-widget|banner|recommend(?:ed|ation|ations)?|related|recirculation|promo|social|share|sharing|caption|credit|byline|author|paywall|subscribe|subscription|newsletter|comments?|tags?|breadcrumb|toolbar|outbrain|taboola)(?:$|[\s_-])/i;
const UI_TEXT =
  /^(?:廣告(?:[：: ]|$)|Advertisement\b|延伸閱讀[：:]?|相關(?:新聞|文章|報導)[：:]?|推薦閱讀[：:]?|更多(?:新聞|報導)[：:]?|責任編輯[：:]?|圖片來源[：:]?|圖[／/:：]|照片[／/:：]|訂閱(?:電子報|即可|後|會員)|登入(?:後|會員)|請(?:先)?登入|加入會員(?:即可|閱讀)|立即訂閱|subscribe\s+(?:to|now)|sign\s+in\s+to\s+(?:read|continue)|continue\s+reading\s+(?:by|with))/i;
const BLOCK_TEXT =
  /(?:驗證您(?:是|是否為)|確認您(?:是|是否為)|請完成驗證|檢查您的瀏覽器|verify (?:that )?you are (?:a )?human|checking your browser|just a moment|access denied|enable javascript and cookies|complete the security check|請(?:先)?登入.{0,20}(?:閱讀|全文)|訂閱.{0,20}(?:閱讀|全文)|subscribe to (?:read|continue)|sign in to (?:read|continue))/i;

function articleNodes($: cheerio.CheerioAPI, url: string): JsonNode[] {
  const found: JsonNode[] = [];
  // Visit only structural containers for the page entity. Related ItemList
  // entries can contain perfectly valid NewsArticles belonging to other URLs.
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const node = value as JsonNode;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (types.some((type) => typeof type === 'string' && /(?:^|[/#])(?:\w*Article|BlogPosting|LiveBlogPosting)$/.test(type))) {
      found.push(node);
    }
    visit(node['@graph']);
    visit(node['mainEntity']);
  };
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      visit(JSON.parse($(script).text()));
    } catch {
      // Malformed structured data must not prevent the DOM fallback.
    }
  }
  const canonical = $('link[rel="canonical"]').first().attr('href');
  const keys = new Set([urlKey(url)]);
  if (canonical) {
    try {
      keys.add(urlKey(new URL(canonical, url).href));
    } catch {
      // A malformed canonical must not discard the requested URL identity.
    }
  }
  const identity = (node: JsonNode): string[] => {
    const values = [node['url'], node['@id'], node['mainEntityOfPage']];
    return values.flatMap((value) => {
      const raw = typeof value === 'string' ? value : value && typeof value === 'object' ? (value as JsonNode)['@id'] : null;
      if (typeof raw !== 'string') return [];
      try {
        return [urlKey(new URL(raw, url).href)];
      } catch {
        return [];
      }
    });
  };
  const matching = found.filter((node) => identity(node).some((key) => keys.has(key)));
  // When the graph identifies this URL, other article entities are unrelated.
  return matching.length ? matching : found.filter((node) => identity(node).length === 0);
}

function excludedContainer(element: cheerio.Cheerio<AnyNode>): boolean {
  // Theme and taxonomy classes describe the page/article, not removable UI.
  if (element.is('body, html')) return false;
  const classes = (element.attr('class') ?? '')
    .split(/\s+/)
    .filter(
      (name) => !/^(?:(?:no|with|has)[-_]share(?:[-_]float)?|has-banner|social-(?:before|after)-title|comments-(?:on|off))$/.test(name),
    )
    .filter(
      (name) => !(element.is('.hentry, article.type-post') && (/^(?:tag|category|byline)-/.test(name) || name === 'post-style-banner')),
    )
    // UDN marks keywords inside prose with a.tag. They are words in the
    // sentence, not the separate tag navigation removed by its parent widget.
    .filter((name) => !(name === 'tag' && element.is('a') && element.closest('p').length > 0))
    .join(' ');
  return EXCLUDED_CLASS.test(`${classes} ${element.attr('id') ?? ''}`);
}

function cleanedRoot($: cheerio.CheerioAPI, node: AnyNode) {
  const root = $(node).clone();
  root.find(REMOVE_ELEMENTS).remove();
  root.find('*').each((_, child) => {
    const element = $(child);
    if (
      excludedContainer(element) ||
      /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(element.attr('style') ?? '')
    )
      element.remove();
  });
  // Keep deliberate line breaks inside paragraphs, then normalize each block.
  root.find('br').replaceWith('\n');
  return root;
}

function domBody($: cheerio.CheerioAPI, node: AnyNode, allowPlainText: boolean): string {
  const original = $(node);
  if (
    original
      .add(original.parents())
      .toArray()
      .some((ancestor) => {
        const element = $(ancestor);
        // ASP.NET sites wrap the entire article in their page form.
        return (element.is(REMOVE_ELEMENTS) && !element.is('form')) || excludedContainer(element);
      })
  )
    return '';
  const root = cleanedRoot($, node);
  const paragraphs = root.is('p') ? root : root.find('p');
  if (!paragraphs.toArray().some((paragraph) => normalize($(paragraph).text())) && allowPlainText) {
    root.find('h1, h2, h3, header').remove();
    root.find('div, section, blockquote, li').append('\n\n');
    return root
      .text()
      .split(/\n+/)
      .map(normalize)
      .filter((text) => text && !UI_TEXT.test(text) && !BLOCK_TEXT.test(text))
      .join('\n\n');
  }
  return paragraphs
    .toArray()
    .flatMap((paragraph) => {
      const element = $(paragraph);
      const text = normalize(element.text());
      const linked = normalize(element.find('a').text());
      if (!text || UI_TEXT.test(text) || BLOCK_TEXT.test(text)) return [];
      // Related headlines and navigation links often live in otherwise valid
      // article containers. Inline citations have a much lower link density.
      if (linked && contentLength(linked) / contentLength(text) > 0.6) return [];
      return [text];
    })
    .join('\n\n');
}

function structuredBody(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (/<\/?(?:p|div|br|section|article|figure|script)\b/i.test(value)) {
    const $ = cheerio.load(`<div id="structured-body">${value}</div>`);
    return domBody($, $('#structured-body')[0], true);
  }
  return value
    .split(/\n+/)
    .map(normalize)
    .filter((text) => text && !UI_TEXT.test(text) && !BLOCK_TEXT.test(text))
    .join('\n\n');
}

function authorNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(authorNames);
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return authorNames((value as JsonNode)['name']);
  return [];
}

const ORGANIZATION_CREDIT =
  /(?:新聞(?:網|雲|台)?|電子報|報社|通訊社|編輯(?:部|室)|綜合報導|中央社|路透社|法新社|美聯社|共同社|自由時報|聯合報|中國時報|工商時報|CTWANT|NOWnews|TVBS|ETtoday)|^(?:責任)?編輯[\s：:]/i;

function reporterNames(value: string): string[] {
  // A reporter declaration at the start of the article/byline is evidence;
  // a reporter mentioned later in the story is not its author.
  const text = normalize(value);
  const dispatch =
    /^[(（]\s*(?:中央社)?(?:特派)?記者\s*([\p{Script=Han}]{2,4})(?:台北|臺北|新北|桃園|台中|臺中|台南|臺南|高雄|基隆|新竹|苗栗|彰化|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|馬祖|東京|首爾|北京|上海|香港|曼谷|倫敦|巴黎|柏林|華盛頓|紐約|洛杉磯)\d{1,2}日電[)）]/u.exec(
      text,
    );
  if (dispatch) return [dispatch[1]];
  const match =
    /^(?:(?:聯合報|聯合晚報|經濟日報|中央社)[／/]\s*)?(?:文[／/]\s*)?(?:[〔【（(]\s*)?(?:特派)?記者\s*([\p{L}·．]+(?:[、,，]\s*[\p{L}·．]+)*)(?:\s*[／/:：]|\s+圖(?:文)?[／/]|[〕】）)]|$)/u.exec(
      text,
    );
  return match
    ? match[1]
        .split(/[、,，]/)
        .map(normalize)
        .filter((name) => name.length >= 2 && name.length <= 20)
    : [];
}

function scopedAuthorElements($: cheerio.CheerioAPI, selector: string): string[] {
  return $(selector)
    .toArray()
    .flatMap((node) => {
      const element = $(node);
      if (
        element
          .parents()
          .toArray()
          .some((parent) => {
            const ancestor = $(parent);
            return (
              ancestor.is('aside, nav, footer, [hidden], [aria-hidden="true"]') ||
              /(?:^|[\s_-])(?:related|recommend(?:ed|ation|ations)?|recirculation)(?:$|[\s_-])/i.test(
                `${ancestor.attr('class') ?? ''} ${ancestor.attr('id') ?? ''}`,
              )
            );
          })
      )
        return [];
      const name = normalize(element.attr('content') ?? (element.find('[itemprop="name"]').first().text() || element.text()));
      return name ? [name] : [];
    });
}

function extractAuthors($: cheerio.CheerioAPI, nodes: JsonNode[], rules: ContentRules): string[] {
  const finish = (names: string[]) =>
    normalizeAuthorCredits([
      ...new Set(
        names
          .flatMap((name) => (reporterNames(name).length ? reporterNames(name) : [normalize(name)]))
          .filter((name) => name && name.length <= 120 && !/^https?:\/\//i.test(name)),
      ),
    ]).slice(0, 30);
  if (rules.authorSelector) {
    const configured = finish(scopedAuthorElements($, rules.authorSelector));
    if (configured.length) return configured;
  }
  const structured = finish(nodes.flatMap((node) => authorNames(node['author'])));
  const declared = finish(scopedAuthorElements($, 'meta[name="author"], meta[property="article:author"]'));
  const human = (names: string[]) => names.filter((name) => !ORGANIZATION_CREDIT.test(name));
  const structuredPeople = nodes.flatMap((node) => {
    const values = Array.isArray(node['author']) ? node['author'] : [node['author']];
    return values.flatMap((value) => {
      if (value && typeof value === 'object' && /Organization$/.test(String((value as JsonNode)['@type']))) return [];
      return authorNames(value);
    });
  });
  const people = human(finish(structuredPeople));
  if (people.length) return people;
  const bylines = finish(scopedAuthorElements($, 'article [itemprop="author"], [rel="author"], .byline, .article-author'));
  if (human(bylines).length) return human(bylines);
  // Some sites put the only reporter credit in their first body paragraph.
  for (const selector of [...(rules.bodySelector ? [rules.bodySelector] : []), ...BODY_SELECTORS]) {
    for (const node of $(selector).toArray()) {
      const prefix = domBody($, node, selector !== 'article')
        .split('\n\n')
        .slice(0, 3);
      for (const paragraph of prefix) {
        const reporters = reporterNames(paragraph);
        if (reporters.length) return finish(reporters);
      }
    }
  }
  if (human(declared).length) return human(declared);
  // Preserve the publisher's declared organization/desk credit when no
  // reporter is given. A nonempty author credit does not establish a person.
  return structured.length ? structured : declared.length ? declared : bylines;
}

// These publishers explicitly label otherwise long article bodies as excerpts.
// This belongs in the shared extractor so already-indexed runArticles rows and
// structured-data fallbacks cannot bypass discovery's early rejection.
function publisherExcerpt($: cheerio.CheerioAPI, value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const mainText = (selector: string) =>
    $(selector)
      .filter((_, node) => !$(node).closest('aside, nav, footer, [role="complementary"]').length)
      .map((_, node) => $(node).text())
      .get()
      .join('\n');
  if (host === 'nommagazine.com' && /^\/(?!category\/|tag\/|page\/|author\/)[^/]+\/$/.test(url.pathname))
    return /本文為精彩摘要[，,]\s*欲下載完整/.test(mainText('.zh-content'));
  if (['tw.news.yahoo.com', 'tw.sports.yahoo.com'].includes(host) && /^\/(?:news\/)?[^/]+\.html$/.test(url.pathname))
    return /全文未完[，,、：:]\s*完整內容請見/.test(mainText('.caas-body, .module-article-body article'));
  if (host === 'epochtimes.com' && /^\/(?:gb|b5)\/\d{2,4}\/\d{1,2}\/\d{1,2}\/n\d+\.htm$/.test(url.pathname)) {
    const article = $('.article-main').first();
    const digest = /大[纪紀]元每天[为為][读讀]者梳理翻[墙牆]必看的文章/.test(article.text());
    const numberedLinks = article
      .find('p')
      .filter((_, node) => /^\s*\d+[.．、]/.test($(node).text()) && $(node).find('a[href]').length > 0);
    if (digest && numberedLinks.length >= 3) return true;
  }
  if (['ntdtv.com', 'soundofhope.org'].includes(host)) {
    const articlePath = host === 'ntdtv.com' ? /^\/(?:gb|b5)\/\d{4}\/\d{2}\/\d{2}\/a\d+\.html$/ : /^\/post\/\d+\/?$/;
    if (!articlePath.test(url.pathname)) return false;
    const article = $('[itemprop="articleBody"]').first();
    const text = normalize(article.text());
    const links = article
      .find('a[href]')
      .map((_, node) => normalize($(node).text()).replace(/^[【[]|[】\]]$/g, ''))
      .get();
    // These templates end a partial script with a link to the complete video.
    // Check before removing headings/links, which would erase the disclosure.
    if (links.some((label) => /^(?:[点點][击擊])?(?:[观觀]看|播放)完整(?:[视視][频頻]|影片)$/.test(label))) return true;
    if (
      host === 'soundofhope.org' &&
      /本期[节節]目[带帶]你/.test(text) &&
      links.some((label) => /^[点點][击擊][观觀]看更多[内內]容$/.test(label))
    )
      return true;
    if (host === 'ntdtv.com' && $('.featured_video').length && /《新[闻聞]大家[谈談]》[制製]作[组組]/.test(text)) {
      const prose = article
        .find('p')
        .map((_, node) => normalize($(node).text()))
        .get()
        .filter((line) => line && !/^《新[闻聞]大家[谈談]》[制製]作[组組]|^[（(]?[责責]任[编編][辑輯]/.test(line));
      if (prose.length <= 2 && contentLength(prose.join('')) < 600) return true;
    }
  }
  return false;
}

export function extractArticleContent($: cheerio.CheerioAPI, url: string, rules: ContentRules): ArticleContent {
  const isExcerpt = publisherExcerpt($, url);
  if (rules.bodyExcludeSelector) $(rules.bodyExcludeSelector).remove();
  const nodes = articleNodes($, url);
  const authors = extractAuthors($, nodes, rules);
  if (isExcerpt) return { body: null, authors, bodySource: 'publisher:excerpt', bodyStatus: 'short' };
  const candidates: Candidate[] = nodes
    .map((node) => ({ body: structuredBody(node['articleBody']), source: 'ld+json' }))
    .filter((candidate) => candidate.body);
  if (rules.bodyHtmlSelector) {
    for (const node of $(rules.bodyHtmlSelector).toArray()) {
      const body = structuredBody($(node).text());
      if (body) candidates.unshift({ body, source: 'selector' });
    }
  }
  const challenge =
    $('#challenge-form, #cf-challenge-running, #challenge-running, .cf-challenge').length > 0 || BLOCK_TEXT.test($('title').text());
  if (challenge) return { body: null, authors, bodySource: 'none', bodyStatus: 'blocked' };

  for (const selector of [...(rules.bodySelector ? [rules.bodySelector] : []), ...BODY_SELECTORS]) {
    // Multiple matches represent alternative containers, never concatenated
    // articles or related stories. Choose the first complete candidate below.
    for (const node of $(selector).toArray()) {
      const body = domBody($, node, selector !== 'article');
      if (body) candidates.push({ body, source: selector === rules.bodySelector ? 'selector' : selector });
    }
  }
  const usable = candidates.filter((candidate) => contentLength(candidate.body) >= 200);
  // A source-specific container is authoritative when present. Generic DOM
  // candidates only replace structured data when they contain that entire
  // text plus a substantial extension, rather than merely being longer.
  const comparisonText = (text: string) =>
    text
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
  let complete = usable.find((candidate) => candidate.source === 'selector') ?? usable[0];
  if (complete?.source === 'ld+json') {
    const structured = comparisonText(complete.body);
    complete =
      usable.find(
        (candidate) =>
          candidate.source !== 'ld+json' &&
          candidate.source !== 'article' &&
          comparisonText(candidate.body).length >= structured.length + Math.max(40, Math.ceil(structured.length * 0.1)) &&
          comparisonText(candidate.body).includes(structured),
      ) ?? complete;
  }
  if (complete) return { body: complete.body, bodySource: complete.source, authors, bodyStatus: 'ok' };

  const blocked =
    $('[class*="paywall"], [id*="paywall"], [data-paywall], [data-testid*="paywall"]').length > 0 ||
    nodes.some((node) => node['isAccessibleForFree'] === false || node['isAccessibleForFree'] === 'false') ||
    BLOCK_TEXT.test(normalize($('body').text()));
  if (blocked) return { body: null, authors, bodySource: 'none', bodyStatus: 'blocked' };
  const short = candidates.sort((a, b) => contentLength(b.body) - contentLength(a.body))[0];
  if (short) return { body: short.body, authors, bodySource: short.source, bodyStatus: 'short' };
  return { body: null, authors, bodySource: 'none', bodyStatus: 'missing' };
}
