import type { CheerioAPI } from 'cheerio';
import { articleNodes } from './article-content.ts';
import { reporterNames } from './byline.ts';
import { decodeEntities, stripTags } from './text.ts';

export interface ArticleSummary {
  summary: string | null;
  summarySource: string | null;
}

const boilerplate = new Set([
  '觀策站',
  '迷音 Miin — Let me in!',
  '視傳媒-新興網路媒體，目前各縣市均有記者發稿，有多位資深也有很多充滿活力的記者，一起拿起筆桿來為民眾出聲。',
  '青年日報為中華民國國防部發行的官方報紙，提供軍事、政治、社會、地方、兩岸、國際、生活、運動、藝文、娛樂等豐富新聞內容。',
  'lai賴傳媒新聞網追求公正、快速的新聞，讓讀者「看新聞就搜賴傳媒新聞網」。',
  '中嘉新聞網提供在地新聞與縣市政府公告事項',
]);
const normalized = (value: string) =>
  decodeEntities(stripTags(value))
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Preserve publisher text, never invent a summary by taking the body's lead. */
export function publisherSummary(value: unknown, source: string, title?: string | null): ArticleSummary {
  if (typeof value !== 'string') return { summary: null, summarySource: null };
  const summary = normalized(value);
  // Oversized feed descriptions often contain the entire article. Do not silently
  // turn them into an excerpt and call that a publisher-provided summary.
  if (
    !summary ||
    summary.length > 4000 ||
    summary === (title ? normalized(title) : '') ||
    boilerplate.has(summary) ||
    (summary.length <= 80 && /(?:報導|報道|报道)[）)】〕]?$/u.test(summary) && reporterNames(summary).length > 0) ||
    /^文\s*[/／]\s*[^。！？]{2,20}中心$/u.test(summary) ||
    // Reviewed descriptions containing only a contributor's role and name.
    /^(?:淡江戰略研究所博士生|直轄市政府青年諮詢組織青年委員)\s+[\p{Script=Han}]{2,4}$/u.test(summary) ||
    // Watch Media sometimes truncates both descriptions inside the byline.
    /^[（(]觀傳媒[^）)]{1,8}新聞[）)]\s*【記者\s*[\p{Script=Han}]{2,4}$/u.test(summary)
  )
    return { summary: null, summarySource: null };
  return { summary, summarySource: source };
}

export function extractSummary($: CheerioAPI, url: string, selector?: string): ArticleSummary {
  if (!selector) {
    try {
      const page = new URL(url);
      if (page.hostname === 'news.pts.org.tw' && /^\/article\/\d+$/.test(page.pathname)) selector = '.post-article > .articleimg';
    } catch {}
  }
  const titles = [$('h1').first().text(), $('meta[property="og:title"]').attr('content'), $('title').text()]
    .filter((value): value is string => !!value)
    .map(normalized);
  const isBannedbook = /^https?:\/\/(?:www\.)?bannedbook\.org\//i.test(url);
  const promotion = /^來源[:：].{1,60}文章內容並不代表本網立場和觀點。\s*(?:【江峰優品】推出|(?:#[^\s]+\s+)*「年代電視」是完全數位)/u;
  const candidates: Array<[unknown, string]> = [];
  if (selector) candidates.push([$(selector).first().text(), 'article:selector']);
  for (const node of articleNodes($, url)) candidates.push([node.abstract, 'jsonld:abstract']);
  for (const [selector, source] of [
    ['meta[name="summary"]', 'meta:summary'],
    ['meta[name="description"]', 'meta:description'],
    ['meta[property="og:description"]', 'meta:og:description'],
  ])
    candidates.push([$(selector).first().attr('content'), source]);
  for (const [value, source] of candidates) {
    const result = publisherSummary(value, source);
    if (result.summary && !titles.includes(result.summary) && !(isBannedbook && promotion.test(result.summary))) return result;
  }
  return { summary: null, summarySource: null };
}
