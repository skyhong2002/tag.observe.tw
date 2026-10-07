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
  '-台灣新聞雲報提供台灣最中立最公正最即時的各類型新聞報導，包括政治新聞、焦點新聞、社會新聞、國際新聞、地方新聞、娛樂新聞、科技新聞、專訪新聞、政黨新聞、藝文活動、美食推廣、體育賽事等相關新聞報導。歡迎各界好友踴躍贊助推廣。',
  '台灣華報',
  '波新聞秉持傳遞正向訊息、提升正向能量、波動良善之心、 共同關懷弱勢、讓我們的社會更加祥和與美好。',
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
    /^【(?:Lai|賴)傳媒、記者爆料網(?:\s+[\p{Script=Han}]{2,5}[／/][^】。！？]{0,12})?\s*$/u.test(summary) ||
    (summary.length <= 80 && /(?:報導|報道|报道)[）)】〕]?(?:\.{3}|…)?$/u.test(summary) && reporterNames(summary).length > 0) ||
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
      if (['www.inside.com.tw', 'inside.com.tw'].includes(page.hostname) && /^\/article\/\d+-/.test(page.pathname))
        selector = '.post_introduction';
    } catch {}
  }
  const titles = [$('h1').first().text(), $('meta[property="og:title"]').attr('content'), $('title').text()]
    .filter((value): value is string => !!value)
    .map(normalized);
  const isGrinews = /^https?:\/\/(?:www\.)?grinews\.com\/news\//i.test(url);
  const griContent = isGrinews ? $('article > .post-content').clone() : null;
  griContent?.find('audio, script, style').remove();
  const griBody = griContent ? normalized(griContent.text()).replace(/\s+/g, '') : '';
  const isDaai = /^https?:\/\/(?:www\.)?daai\.tv\/news\/\d+$/i.test(url);
  const daaiBodies = isDaai
    ? articleNodes($, url).flatMap((node) => (typeof node.articleBody === 'string' ? [normalized(node.articleBody)] : []))
    : [];
  const isKingtop = /^https?:\/\/(?:www\.)?kingtop\.com\.tw\//i.test(url);
  const isYesMedia = /^https?:\/\/(?:www\.)?yesmedia\.com\.tw\//i.test(url);
  const captionDescriptions = /^https?:\/\/(?:www\.)?(?:yesmedia\.com\.tw|firenews\.com\.tw|mknews\.com\.tw)\//i.test(url);
  const captions = captionDescriptions
    ? $('article figcaption, article .wp-caption-text')
        .toArray()
        .map((node) => normalized($(node).text()))
        .filter(Boolean)
    : [];
  const isBannedbook = /^https?:\/\/(?:www\.)?bannedbook\.org\//i.test(url);
  const promotion =
    /^來源[:：].{1,60}文章內容並不代表本網立場和觀點。\s*(?:【江峰優品】推出|八炯眼貼小舖連結[：:]|(?:#[^\s]+\s+)*「年代電視」是完全數位)/u;
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
    let result = publisherSummary(value, source);
    if (!result.summary || titles.includes(result.summary)) continue;
    if (isDaai && daaiBodies.includes(result.summary)) continue;
    if (isKingtop && /^https?:\/\/(?:www\.)?kingtop\.com\.tw\//i.test(result.summary)) continue;
    if (isBannedbook && promotion.test(result.summary)) continue;
    if (isYesMedia && /^《圖說》/u.test(result.summary)) continue;
    const leadingCaption = captions.find((caption) => result.summary?.startsWith(caption));
    if (leadingCaption) {
      // Keep only the publisher's remaining description, with an exact caption
      // and reviewed adjacent credit removed; never synthesize body excerpts.
      const remainder = result.summary
        .slice(leadingCaption.length)
        .trim()
        .replace(/^商傳媒[｜|]\s*[\p{Script=Han}]{2,5}[／/]綜合外電報導\s*/u, '');
      if (remainder.length < 20 || /^[（(]觀傳媒[^）)]*新聞[）)]\s*【記者/u.test(remainder)) continue;
      result = publisherSummary(remainder, source);
      if (!result.summary) continue;
    }
    if (
      isGrinews &&
      (/^草根影響力新視野\s+[\p{Script=Han}]{2,4}\s+在\s+\d{4}$/u.test(result.summary) ||
        (griBody && result.summary.replace(/\s+/g, '') === griBody))
    )
      continue;
    return result;
  }
  return { summary: null, summarySource: null };
}
