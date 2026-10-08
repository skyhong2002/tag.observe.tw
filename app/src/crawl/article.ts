import * as cheerio from 'cheerio';
import { type ArticleContent, extractArticleContent } from './article-content.ts';
import { bigMediaProvider } from './news-bigmedia-provider.ts';
import { foodNextCredits } from './news-foodnext-credits.ts';
import { globalVoicesCredits } from './news-globalvoices-credits.ts';
import { publicArticleHtml } from './news-public-html.ts';
import { correctPublicationClock, newsSiteEvidence, newsSiteRules } from './news-site-rules.ts';
import { taipeiTimesCredits } from './news-taipeitimes-credits.ts';
import { thePaperCredits } from './news-thepaper-credits.ts';
import { type ArticleSummary, extractSummary } from './summary.ts';
import { between, decodeEntities, normalizeTag, resolveUrl } from './text.ts';

export interface ArticleDetail extends ArticleContent, ArticleSummary {
  tags: string[];
  image: string | null;
  description: string | null;
  canonical: string | null;
  title: string | null;
  publishedAt: Date | null;
  provider: string | null;
  keywordSource: string;
}
export interface ArticleRules {
  bodySelector?: string;
  bodyHtmlSelector?: string;
  bodyExcludeSelector?: string;
  authorSelector?: string;
  /** Accept only a complete reviewed credit; capture the author name. */
  authorPattern?: RegExp;
  // The headline element, for sites whose og:title appends a section name
  // that no fixed titleSuffix covers (womany: 「｜回家吧 I’m home」).
  titleSelector?: string;
  keywordMarkers?: Array<{ start: string; end: string }>;
  split?: string;
  tagSelector?: string;
  // Tags embedded in page data as the first "<key>":[{"name":…},…] array
  // (twreporter's Redux state; later arrays belong to related posts).
  jsonTags?: string;
  imageMarker?: { start: string; end: string };
  skipMeta?: boolean;
  // Keep only pages whose content provider matches (aggregators such as Yahoo
  // carry partner media; we want their own reporting only).
  provider?: string;
  /** With provider: a body pattern that must also match. A wire channel's
   * provider label alone does not prove the originating agency. */
  providerBody?: string;
}

// A keyword list where any entry is sentence-length is prose in disguise
// (some sites put a summary in news_keywords); reject the whole candidate.
const splitKeywords = (s: string, sep: string | null) => {
  const parts = s
    .split(sep && sep !== ' ' ? new RegExp(`[${sep.replace(']', '\\]')},，、]`) : /[,，、#]/)
    .map(normalizeTag)
    .filter((t) => Buffer.byteLength(t) > 1);
  return parts.some((t) => t.length > 30) ? [] : parts.filter((t) => t.length <= 60);
};

// Generic article extraction shared by every media; site rules add fallbacks
// where the legacy PHP relied on page-specific markers.
export function extractArticle(html: string, url: string, rules: ArticleRules = {}): ArticleDetail {
  html = publicArticleHtml(html, url);
  const $ = cheerio.load(html);
  const site = newsSiteRules(url);
  const siteEvidence = newsSiteEvidence($, url);
  rules = {
    ...(site
      ? {
          bodySelector: site.bodySelector,
          authorSelector: site.authorSelector,
          authorPattern: site.authorPattern,
          bodyHtmlSelector: site.bodyHtmlSelector,
          bodyExcludeSelector: site.bodyExcludeSelector,
          trustContainer: site.trustContainer,
          plainTextBody: site.plainTextBody,
          preferShortBody: site.preferShortBody,
        }
      : {}),
    ...rules,
  };
  const meta = (sel: string) => $(sel).first().attr('content')?.trim() || null;
  let tags: string[] = [];
  let keywordSource = 'none';
  if (!rules.skipMeta) {
    const candidates: Array<[string, string | null]> = [
      ['news_keywords', meta('meta[name="news_keywords"]')],
      ['keywords', meta('meta[name="keywords"], meta[itemprop="keywords"], meta[property="keywords"], meta[property="article:tag"]')],
    ];
    const articleTags = $('meta[property="article:tag"]')
      .map((_, e) => $(e).attr('content') ?? '')
      .get()
      .filter(Boolean);
    if (articleTags.length > 1) candidates.unshift(['article:tag', articleTags.join(',')]);
    for (const [source, value] of candidates) {
      if (value) {
        const t = splitKeywords(value, rules.split ?? null);
        if (t.length) {
          tags = t;
          keywordSource = source;
          break;
        }
      }
    }
  }
  if (!tags.length) {
    for (const script of $('script[type="application/ld+json"]').toArray()) {
      try {
        const data = JSON.parse($(script).text());
        const nodes = Array.isArray(data) ? data : (data['@graph'] ?? [data]);
        for (const node of nodes) {
          const kw = node?.keywords;
          // Videoland wraps a comma-separated keyword list in a single array entry.
          const list = Array.isArray(kw)
            ? kw.flatMap((value) => splitKeywords(String(value), rules.split ?? null))
            : typeof kw === 'string'
              ? splitKeywords(kw, rules.split ?? null)
              : [];
          const t = list.map(normalizeTag).filter((x) => Buffer.byteLength(x) > 1);
          if (t.length) {
            tags = t;
            keywordSource = 'ld+json';
            break;
          }
        }
      } catch {
        /* ignore malformed JSON-LD */
      }
      if (tags.length) break;
    }
  }
  if (!tags.length && rules.tagSelector) {
    const t = $(rules.tagSelector)
      .map((_, e) => normalizeTag($(e).text()).replace(/^#/, ''))
      .get()
      .filter((x) => Buffer.byteLength(x) > 1);
    if (t.length) {
      tags = [...new Set(t)];
      keywordSource = 'selector';
    }
  }
  if (!tags.length && rules.jsonTags) {
    const at = html.indexOf(`"${rules.jsonTags}":[`);
    const t =
      at < 0
        ? []
        : [
            ...html
              .slice(at, at + 5000)
              .split(']')[0]
              .matchAll(/"name":"([^"]{1,60})"/g),
          ].map((m) => normalizeTag(m[1]));
    if (t.length) {
      tags = [...new Set(t)];
      keywordSource = 'json';
    }
  }
  if (!tags.length && rules.keywordMarkers) {
    for (const { start, end } of rules.keywordMarkers) {
      const raw = between(html, start, end, 0, 4000);
      if (raw) {
        const t = splitKeywords(decodeEntities(raw.replace(/<[^>]+>/g, ',')), rules.split ?? null);
        if (t.length) {
          tags = t;
          keywordSource = 'marker:' + start.slice(0, 20);
          break;
        }
      }
    }
  }
  const imageRaw =
    meta('meta[property="og:image"], meta[name="og:image"], meta[itemprop="image"], meta[name="twitter:image"]') ??
    (rules.imageMarker ? between(html, rules.imageMarker.start, rules.imageMarker.end, 0, 1000) : null);
  const canonicalRaw = $('link[rel="canonical"]').first().attr('href')?.trim() || meta('meta[property="og:url"]');
  const printedTime = siteEvidence.correctUtcClock ? null : parsePublished(siteEvidence.publishedRaw);
  const declaredTime = correctPublicationClock(publishedTime($, html), siteEvidence);
  const publishedAt = siteEvidence.preferPrintedPublication ? (printedTime ?? declaredTime) : (declaredTime ?? printedTime);
  const providerRaw = site?.providerSelector
    ? meta(site.providerSelector) || $(site.providerSelector).first().text().trim() || null
    : providerName(html);
  const credits = globalVoicesCredits($, url) ?? foodNextCredits($, url) ?? taipeiTimesCredits($, url) ?? thePaperCredits($, url);
  const provider =
    credits?.provider ??
    bigMediaProvider($, url) ??
    (site?.providerPattern ? (site.providerPattern.exec(providerRaw ?? '')?.[1] ?? null) : providerRaw);
  // Body cleanup can remove caption/header evidence used by summary extraction.
  const summary = extractSummary($, url);
  const content = extractArticleContent($, url, rules);
  return {
    ...summary,
    tags: [...new Set(tags)].slice(0, 100),
    image: imageRaw ? resolveUrl(imageRaw, url) : null,
    description:
      (meta('meta[property="og:description"], meta[name="description"], meta[itemprop="description"]') ?? '').slice(0, 2000) || null,
    canonical: canonicalRaw ? resolveUrl(canonicalRaw, url) : null,
    title:
      (rules.titleSelector && $(rules.titleSelector).first().text().replace(/\s+/g, ' ').trim()) ||
      (siteEvidence.title ?? ((meta('meta[property="og:title"]') ?? $('title').first().text().trim() ?? '') || null)),
    publishedAt,
    provider,
    keywordSource,
    ...content,
    authors: credits?.authors.length ? credits.authors : content.authors,
  };
}

// Most precise source first; the first value that parses wins. Some sites put
// a bare date in pubdate (on.cc: "20260929") next to a full timestamp.
const PUBLISHED_META = [
  'meta[property="article:published_time"]',
  'meta[name="article:published_time"]',
  'meta[itemprop="datePublished"]',
  'meta[name="publish-date"]',
  'meta[name="my:publish_date"]',
  'meta[name="pubdate"]',
];
export function parsePublished(raw: string | null | undefined): Date | null {
  const value = decodeEntities(raw ?? '')
    .trim()
    .replace(/\bHKT\b/g, 'GMT+0800');
  if (!value) return null;
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  const zoneless = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value);
  const date = compact
    ? new Date(`${compact[1]}-${compact[2]}-${compact[3]}T00:00:00+08:00`)
    : new Date(zoneless ? `${value.replace(' ', 'T')}+08:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function publishedTime($: cheerio.CheerioAPI, html: string): Date | null {
  for (const sel of PUBLISHED_META) {
    const date = parsePublished($(sel).first().attr('content'));
    if (date) return date;
  }
  // JSON-LD may be invalid JSON (raw newlines, entities); read the field directly.
  const ld = /"datePublished"\s*:\s*"([^"]+)"/.exec(html);
  return parsePublished(ld?.[1]);
}

// Yahoo embeds the article attribution in escaped JSON:
// \"provider\":{...,\"name\":\"Yahoo新聞編輯室\"}. The first provider object
// on the page is the article's own; later ones belong to recommendations.
export function providerName(html: string): string | null {
  const at = html.indexOf('\\"provider\\":{');
  if (at < 0) return null;
  return /\\"name\\":\\"([^"\\]+)\\"/.exec(html.slice(at, at + 3000))?.[1] ?? null;
}
