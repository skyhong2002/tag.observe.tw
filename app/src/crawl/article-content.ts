import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import {
  extractClosingReporterNames,
  extractLeadReporterNames,
  isNonAuthorCredit,
  normalizeAuthorCredits,
  reporterNames,
} from './byline.ts';
import { womanyCollectionDescription } from './news-womany-collection.ts';
import { decodeEntities, urlKey } from './text.ts';

export interface ArticleContent {
  body: string | null;
  authors: string[];
  bodySource: string;
  bodyStatus: 'ok' | 'missing' | 'short' | 'blocked';
}

type ContentRules = {
  bodySelector?: string;
  bodyHtmlSelector?: string;
  bodyExcludeSelector?: string;
  authorSelector?: string;
  /** Accept only a complete reviewed credit; capture the author name. */
  authorPattern?: RegExp;
  /** The site container counts even inside wrappers whose class names look like ads or share bars. */
  trustContainer?: boolean;
  /** Paragraphs are block elements and line breaks rather than <p>. */
  plainTextBody?: boolean;
  preferShortBody?: boolean;
};
type BodyOptions = { trusted?: boolean; plainText?: boolean };
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
  /^(?:廣告(?:[：: ]|$)|Advertisement\b|延伸閱讀[：:]?|相關(?:新聞|文章|報導)[：:]?|推薦閱讀[：:]?|更多(?:新聞|報導)[：:]?|責任編輯[：:]?|圖片來源[：:]?|圖[／/:：](?!\s*文[／/:：])|照片[／/:：]|訂閱(?:電子報|即可|後|會員)|登入(?:後|會員)|請(?:先)?登入|加入會員(?:即可|閱讀)|立即訂閱|subscribe\s+(?:to|now)|sign\s+in\s+to\s+(?:read|continue)|continue\s+reading\s+(?:by|with))/i;
const BLOCK_TEXT =
  /(?:驗證您(?:是|是否為)|確認您(?:是|是否為)|請完成驗證|檢查您的瀏覽器|verify (?:that )?you are (?:a )?human|checking your browser|just a moment|access denied|enable javascript and cookies|complete the security check|請(?:先)?登入.{0,20}(?:閱讀|全文)|訂閱.{0,20}(?:閱讀|全文)|subscribe to (?:read|continue)|sign in to (?:read|continue))/i;

export function articleNodes($: cheerio.CheerioAPI, url: string): JsonNode[] {
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
    .filter((name) => !(['tag', 'trigger_tag'].includes(name) && element.is('a') && element.closest('p').length > 0))
    .filter(
      (name) =>
        !(
          name === 'article-content-tag-links' &&
          element.is('span') &&
          element.closest('p').length > 0 &&
          element.children('a.tagClick[href^="https://www.sinchew.com.my/tag/"]').length > 0
        ),
    )
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

function domBody($: cheerio.CheerioAPI, node: AnyNode, allowPlainText: boolean, options: BodyOptions = {}): string {
  const original = $(node);
  if (
    !options.trusted &&
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
  if (options.plainText || (!paragraphs.toArray().some((paragraph) => normalize($(paragraph).text())) && allowPlainText)) {
    root.find('h1, h2, h3, header').remove();
    if (options.plainText) {
      root.find('br').replaceWith('\n');
      root.find('p').append('\n\n');
    }
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

const siteOptions = (rules: ContentRules): BodyOptions => ({ trusted: rules.trustContainer, plainText: rules.plainTextBody });

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

function scopedAuthorElements($: cheerio.CheerioAPI, selector: string, configured = false): string[] {
  return $(selector)
    .toArray()
    .flatMap((node) => {
      const element = $(node);
      const mainHeaderCredit =
        configured && element.closest('footer.entry-meta').parent('header.entry-header').parent('article').length > 0;
      if (
        element
          .add(element.parents())
          .toArray()
          .some((parent) => {
            const ancestor = $(parent);
            return (
              ancestor.is('nav, [hidden], [aria-hidden="true"], .e-loop-item') ||
              (ancestor.is('footer') && !mainHeaderCredit) ||
              (!configured && ancestor.is('aside')) ||
              /(?:^|[\s_-])(?:related|recommend(?:ed|ation|ations)?|recirculation)(?:$|[\s_-])/i.test(
                `${ancestor.attr('class') ?? ''} ${ancestor.attr('id') ?? ''}`,
              )
            );
          })
      )
        return [];
      let name = normalize(element.attr('content') ?? (element.find('[itemprop="name"]').first().text() || element.text()));
      if (element.is('time')) {
        const credit = name.replace(/^\d{4}-\d{2}-\d{2}\s+(?:(?:上午|下午|早上|晚上)\s*)?\d{1,2}:\d{2}\s*/u, '');
        if (configured && /^媒體中心[／/]綜合報導$/u.test(credit)) return [credit];
        return reporterNames(credit);
      }
      if (element.is('[data-section="article-contributors"]')) {
        const editors = /^編輯[：:]\s*([\p{Script=Han}]{2,5})\s*[｜|]\s*責任編輯[：:]\s*([\p{Script=Han}]{2,5})$/u.exec(name);
        if (editors) return [editors[1], editors[2]];
      }
      // A visible author declaration can distinguish the writer from a
      // responsible editor incorrectly included in structured author arrays.
      if (/^作者\s*[:：]/u.test(name)) {
        name = name
          .replace(/^作者\s*[:：]\s*/u, '')
          .split(/\s*[|｜]\s*責任編輯\s*[:：]/u)[0]
          .trim();
      }
      return name ? [name] : [];
    });
}

function extractAuthors($: cheerio.CheerioAPI, nodes: JsonNode[], rules: ContentRules, body = '', configuredValues?: string[]): string[] {
  const finish = (names: string[]) =>
    normalizeAuthorCredits([
      ...new Set(
        names
          .flatMap((name) => (reporterNames(name).length ? reporterNames(name) : [normalize(name)]))
          .filter((name) => name && name.length <= 120 && !/^https?:\/\//i.test(name) && !isNonAuthorCredit(name)),
      ),
    ]).slice(0, 30);
  const configured = rules.authorSelector ? finish(configuredValues ?? scopedAuthorElements($, rules.authorSelector, true)) : [];
  if (configured.some((name) => !ORGANIZATION_CREDIT.test(name))) return configured;
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
  const bylineValues = scopedAuthorElements($, 'article [itemprop="author"], [rel="author"], .byline, .article-author');
  const bylines = finish(bylineValues);
  const lead = finish(extractLeadReporterNames(body));
  if (lead.length) return lead;
  const closing = finish(extractClosingReporterNames(body));
  if (closing.length) return closing;
  if (configured.length) return configured;
  const people = human(finish(structuredPeople));
  if (people.length) return people;
  const explicitBylines = finish(bylineValues.flatMap(reporterNames));
  if (explicitBylines.length) return explicitBylines;
  if (human(bylines).length) return human(bylines);
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
  // A header may hold both the dateline and the author; preserve its explicit
  // credit before removing header elements from the selected article prose.
  const configuredValues = (rules.authorSelector ? scopedAuthorElements($, rules.authorSelector, true) : []).flatMap((value) => {
    if (!rules.authorPattern) return [value];
    const name = rules.authorPattern.exec(value)?.[1];
    return name ? [name] : [];
  });
  if (rules.bodyExcludeSelector) $(rules.bodyExcludeSelector).remove();
  const nodes = articleNodes($, url);
  const result = (body: string | null, bodySource: string, bodyStatus: ArticleContent['bodyStatus']): ArticleContent => {
    let authorBody = body ?? '';
    if (body && bodySource === 'ld+json') {
      // Structured prose sometimes omits the visible opening byline. Accept
      // that DOM credit only when the rest is the same selected report.
      const sameProse = (value: string) => value.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');
      const matching = candidates.find((candidate) => {
        if (candidate.source === 'ld+json') return false;
        const first = candidate.body.split('\n\n')[0] ?? '';
        if (!reporterNames(first).length) return false;
        const dom = sameProse(candidate.body);
        const selected = sameProse(body);
        return dom.endsWith(selected) && dom.length - selected.length <= 100;
      });
      if (matching) authorBody = matching.body;
    }
    return { body, bodySource, bodyStatus, authors: extractAuthors($, nodes, rules, authorBody, configuredValues) };
  };
  if (isExcerpt) return result(null, 'publisher:excerpt', 'short');
  const collection = womanyCollectionDescription($, url);
  if (collection) return result(collection, 'feature:womany-description', contentLength(collection) >= 200 ? 'ok' : 'short');
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
  if (challenge) return result(null, 'none', 'blocked');

  for (const selector of [...(rules.bodySelector ? [rules.bodySelector] : []), ...BODY_SELECTORS]) {
    // Multiple matches represent alternative containers, never concatenated
    // articles or related stories. Choose the first complete candidate below.
    for (const node of $(selector).toArray()) {
      const body = domBody($, node, selector !== 'article', selector === rules.bodySelector ? siteOptions(rules) : {});
      if (body) candidates.push({ body, source: selector === rules.bodySelector ? 'selector' : selector });
    }
  }
  const usable = candidates.filter((candidate) => contentLength(candidate.body) >= 200);
  // A source-specific container is authoritative when present. Generic DOM
  // candidates also win when they contain the same prose: publishers may
  // flatten punctuation and paragraphs in JSON-LD. Normalize only the comparison,
  // never the selected text. A longer unrelated body or a partial teaser must not win.
  const comparisonText = (text: string) =>
    text
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
  const chooseBody = (choices: Candidate[]) => {
    let complete = choices.find((candidate) => candidate.source === 'selector') ?? choices[0];
    if (complete?.source === 'ld+json') {
      const structured = comparisonText(complete.body);
      const headlines = nodes.flatMap((node) => (typeof node['headline'] === 'string' ? [comparisonText(node['headline'])] : []));
      const withoutHeadline = headlines.reduce(
        (text, headline) => (headline && text.startsWith(headline) ? text.slice(headline.length) : text),
        structured,
      );
      complete =
        choices.find((candidate) => {
          if (candidate.source === 'ld+json') return false;
          const dom = comparisonText(candidate.body);
          return (
            dom === structured ||
            (withoutHeadline.length > 0 && dom === withoutHeadline) ||
            (candidate.source !== 'article' &&
              dom.length >= structured.length + Math.max(40, Math.ceil(structured.length * 0.1)) &&
              dom.includes(structured))
          );
        }) ?? complete;
    }
    return complete;
  };
  // Some publishers pad a short report past 200 characters with headlines and
  // syndication notices in JSON-LD. A verified full-report container still wins.
  const preferredShort = rules.preferShortBody
    ? candidates.find((candidate) => candidate.source === 'selector' && contentLength(candidate.body) < 200)
    : undefined;
  const complete = preferredShort ? undefined : chooseBody(usable);
  if (complete) return result(complete.body, complete.source, 'ok');

  const blocked =
    $('[class*="paywall"], [id*="paywall"], [data-paywall], [data-testid*="paywall"]').length > 0 ||
    nodes.some((node) => node['isAccessibleForFree'] === false || node['isAccessibleForFree'] === 'false') ||
    BLOCK_TEXT.test(normalize($('body').text()));
  if (blocked) return result(null, 'none', 'blocked');
  const short = preferredShort ?? chooseBody(candidates.sort((a, b) => contentLength(b.body) - contentLength(a.body)));
  if (short) return result(short.body, short.source, 'short');
  return result(null, 'none', 'missing');
}
