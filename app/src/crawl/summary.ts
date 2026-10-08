import type { CheerioAPI } from 'cheerio';
import { articleNodes } from './article-content.ts';
import { reporterNames } from './byline.ts';
import { contentPlatformFeedCaption } from './news-contentplatform-title.ts';
import { cool3cSummary } from './news-cool3c-summary.ts';
import { bo6sSummary } from './news-editor-credits.ts';
import { hsNewsSummary } from './news-hsnews-summary.ts';
import { iMediaWriterSummary } from './news-i-media-writer.ts';
import { ithomeFeatureDescription } from './news-ithome-feature.ts';
import { jMediaSummary } from './news-j-media-summary.ts';
import { mdnKidsFullDescription } from './news-mdnkids.ts';
import { newCongressFullDescription } from './news-newcongress.ts';
import { ngmSummary } from './news-ngm-summary.ts';
import { peopoSummary } from './news-peopo-credits.ts';
import { tpNewsArticle, tpNewsSummary } from './news-tpnews.ts';
import { decodeEntities, stripTags } from './text.ts';

export interface ArticleSummary {
  summary: string | null;
  summarySource: string | null;
}

const boilerplate = new Set([
  '花蓮最速報即時訊息及花蓮新聞，在地報導！花蓮最速報提供您各地區最各類新聞報導，滿足您知的權利！',
  '基督教今日報',
  '【彪網媒】追求專業、公正，深耕在地，匯流政府與民間資訊，反應輿情、開創自由表達與理性回饋的優質園地',
  // Reviewed news description imports a legal office's search keyword list.
  '高雄律師 台南律師 男律師 女律師 專業團隊 台灣律師 好的律師 推薦律師 認識律師 勝訴律師 訴訟律師 非訟律師 法律諮詢 法律問題 王瀚誼律師 莊曜隸律師 魏韻儒律師 民事案件 家事案件 刑事案件 行政案件 勞資案件 商務契約 公司法 保險法 證券交易法 民法 刑法 憲法 行政法 課程合作 保險法 證券交易法 公司',
  '觀策站',
  '日经中文网官方网站。日经中文网是日本经济新闻社的中文财经网站。提供日本、中国、欧美财经金融信息、商务、企业、高科技报道、评论和专栏。',
  '澳門日報版權所有 澳門日報電子報由澳門日報出版社出版',
  '在這裡找到你想要的美食',
  '客家電視是屬於全民、以至於全世界客家族群的頻道，亦是為傳播客家文化而存在，定位為「全體客家族群之媒體」。',
  '國際環宇時報International World Times的使命是以公正、客觀的角度報導國內外新聞，幫助讀者深入了解全球範圍內的重大事件與趨勢。其願景是成為全球讀者首選的新聞來源，促進世界各國之間的理解與交流。國際環宇時報以其真實、公正、全面和創新的報導風格，贏得了全球讀者的信賴和支持。',
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
export function publisherSummary(value: unknown, source: string, title?: string | null, url?: string): ArticleSummary {
  if (typeof value !== 'string') return { summary: null, summarySource: null };
  let summary = normalized(value);
  const heading = title ? normalized(title) : null;
  // Reviewed WordPress feed suffix repeats the own title and publication credit.
  // Preserve the publisher's excerpt; do not include the syndication boilerplate.
  const feedCredit = heading ? `〈${heading}〉這篇文章最早發佈於《台灣好報》。` : null;
  if (source === 'feed:description' && feedCredit && summary.endsWith(feedCredit)) summary = summary.slice(0, -feedCredit.length).trim();
  const appleAlmondCredit = heading ? `這篇文章 ${heading} 最早出現於 蘋果仁 - 果仁 iPhone/iOS/好物推薦科技媒體。` : null;
  if (source === 'feed:description' && appleAlmondCredit && summary.endsWith(appleAlmondCredit))
    summary = summary.slice(0, -appleAlmondCredit.length).trim();
  // Oversized feed descriptions often contain the entire article. Do not silently
  // turn them into an excerpt and call that a publisher-provided summary.
  if (
    (source === 'feed:description' && contentPlatformFeedCaption(summary, url) && !heading?.startsWith('《圖說》')) ||
    !summary ||
    /^(?:\.{3}|…)+$/.test(summary) ||
    summary.length > 4000 ||
    summary === (heading ?? '') ||
    (heading !== null && summary.replace(/\s*繼續閱讀$/u, '') === heading) ||
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
  const ammId = /^https?:\/\/(?:www\.)?ammtw\.com\/(\d+)\/?$/i.exec(url)?.[1];
  const ammLead = ammId
    ? $(`article#post-${ammId} .ak-post-content > p, article#post-${ammId} .ak-post-content > div > p`)
        .slice(0, 3)
        .toArray()
        .map((node) => normalized($(node).text()))
        .join(' ')
        .replace(/\s/g, '')
    : '';
  const isYahooJapanPickup = /^https?:\/\/news\.yahoo\.co\.jp\/pickup\/\d+$/i.test(url);
  const isGrinews = /^https?:\/\/(?:www\.)?grinews\.com\/news\//i.test(url);
  const griContent = isGrinews ? $('article > .post-content').clone() : null;
  griContent?.find('audio, script, style').remove();
  const griBody = griContent ? normalized(griContent.text()).replace(/\s+/g, '') : '';
  const isDaai = /^https?:\/\/(?:www\.)?daai\.tv\/news\/\d+$/i.test(url);
  const daaiBodies = isDaai
    ? articleNodes($, url).flatMap((node) => (typeof node.articleBody === 'string' ? [normalized(node.articleBody)] : []))
    : [];
  const isSingular = /^https?:\/\/(?:www\.)?scooptw\.com\/yesmedia\/\d+\//i.test(url);
  const isYdn = /^https?:\/\/(?:www\.)?ydn\.com\.tw\/tw\/News\/ugC_News_Detail\.aspx\?ID=\d+$/i.test(url);
  const copiedReportParagraphs =
    isSingular || isYdn
      ? $(isYdn ? 'article.PageArticle #ContentPlaceHolder1_div_Desc p' : '.td-post-content p')
          .toArray()
          .map((node) => normalized($(node).text()).replace(/\s/g, ''))
          .filter((text) => text.length > 40)
      : [];
  const isSecretChina = /^https?:\/\/(?:www\.)?secretchina\.com\/news\/b5\//i.test(url);
  const secretChinaPromotion =
    '看中國》是總部設於美國、以復興傳統中華文化為理念的獨立媒體。自2001年起，堅持報導最新社會焦點和傳統文化專題，中文報紙已在北美、歐洲、澳洲、亞洲等17個國家發行。中國新聞,中國大陸新聞,內幕新聞,中文媒體,新聞評論,時事,財經,博談,歷史,文化,養生,娛樂,奇聞。';
  const isKingtop = /^https?:\/\/(?:www\.)?kingtop\.com\.tw\//i.test(url);
  const isYesMedia = /^https?:\/\/(?:www\.)?yesmedia\.com\.tw\//i.test(url);
  const captionDescriptions = /^https?:\/\/(?:www\.)?(?:yesmedia\.com\.tw|firenews\.com\.tw|mknews\.com\.tw)\//i.test(url);
  const isJobs1111 = /^https?:\/\/(?:www\.)?1111\.com\.tw\/news\/jobns\/\d+$/i.test(url);
  const captions = isJobs1111
    ? $('main .yellow-white-bg > center:has(img) + div')
        .toArray()
        .map((node) => normalized($(node).text()))
        .filter((text) => /^.{1,200}[（(]圖[／/][^（）()]{1,80}[）)]$/u.test(text))
    : captionDescriptions
      ? $('article figcaption, article .wp-caption-text')
          .toArray()
          .map((node) => normalized($(node).text()))
          .filter(Boolean)
      : [];
  const jobs1111Paragraphs = isJobs1111
    ? $('main .yellow-white-bg > div')
        .toArray()
        .map((node) => normalized($(node).text()))
        .filter((text) => text && !captions.includes(text))
    : [];
  const isBannedbook = /^https?:\/\/(?:www\.)?bannedbook\.org\//i.test(url);
  const promotion =
    /^來源[:：].{1,60}文章內容並不代表本網立場和觀點。\s*(?:【江峰優品】推出|八炯眼貼小舖連結[：:]|(?:#[^\s]+\s+)*「年代電視」是完全數位)/u;
  const candidates: Array<[unknown, string]> = [];
  const isHakkaNews = /^https?:\/\/(?:www\.)?hakkanews\.tw\/\d{4}\/\d{2}\/\d{2}\/\d+\/$/i.test(url);
  if (isHakkaNews && !selector) {
    const box = $('#main-content article.single-content > .post-content > div:first-of-type > .quote_style:first-child').first();
    if (/^你可以先知道[:：]$/u.test(box.children('h3').first().text().trim())) {
      const points = box
        .children('p')
        .toArray()
        .map((node) => $(node).text().trim())
        .filter(Boolean);
      if (points.length && points.every((text, index) => text.startsWith(`（${index + 1}）`)))
        candidates.push([points.join('\n'), 'article:selector']);
    }
  }
  if (selector) candidates.push([$(selector).first().text(), 'article:selector']);
  for (const node of articleNodes($, url)) candidates.push([node.abstract, 'jsonld:abstract']);
  const ithome = ithomeFeatureDescription($, url);
  if (ithome) {
    for (const node of $('meta[name="description"]').toArray()) {
      const supplied = $(node).attr('content');
      if (supplied && normalized(supplied) === normalized(ithome.body)) candidates.push([supplied, 'meta:description']);
    }
  }
  for (const [selector, source] of [
    ['meta[name="summary"]', 'meta:summary'],
    ['meta[name="description"]', 'meta:description'],
    ['meta[property="og:description"]', 'meta:og:description'],
  ])
    candidates.push([$(selector).first().attr('content'), source]);
  if (isYahooJapanPickup || tpNewsArticle($, url)) {
    for (const node of articleNodes($, url)) candidates.push([node.description, 'jsonld:description']);
  }
  for (const [value, source] of candidates) {
    let result = publisherSummary(value, source);
    if (!result.summary || titles.includes(result.summary)) continue;
    const suppliedExcerpt = tpNewsSummary($, url, result.summary) ?? ngmSummary($, url, result.summary);
    if (suppliedExcerpt !== null) {
      result = publisherSummary(suppliedExcerpt, source);
      if (!result.summary) continue;
    }
    const hsExcerpt = hsNewsSummary($, url, result.summary);
    if (hsExcerpt !== null) {
      result = publisherSummary(hsExcerpt, source);
      if (!result.summary) continue;
    }
    const peopoExcerpt = peopoSummary($, url, result.summary);
    if (peopoExcerpt !== null) {
      result = publisherSummary(peopoExcerpt, source);
      if (!result.summary) continue;
    }
    if (newCongressFullDescription($, url, result.summary)) continue;
    if (mdnKidsFullDescription($, url, result.summary)) continue;
    const writerExcerpt = iMediaWriterSummary($, url, result.summary);
    if (writerExcerpt !== null) {
      result = publisherSummary(writerExcerpt, source);
      if (!result.summary) continue;
    }
    const cool3c = cool3cSummary($, url, result.summary);
    if (cool3c !== null) {
      result = publisherSummary(cool3c, source);
      if (!result.summary) continue;
    }
    const jMedia = jMediaSummary($, url, result.summary);
    if (jMedia !== null) {
      result = publisherSummary(jMedia, source);
      if (!result.summary) continue;
    }
    const bo6s = bo6sSummary($, url, result.summary);
    if (bo6s !== null) {
      result = publisherSummary(bo6s, source);
      if (!result.summary) continue;
    }
    // Reviewed AMM description is cut inside the encoded dispatch dash.
    // Keep its supplied excerpt and truncation marker; do not invent missing text.
    if (ammLead && /[\p{Script=Han}]{2,12}\d{4}年\d{1,2}月\d{1,2}日\s*\/美通社\/\s+&#821 \[…\]$/u.test(result.summary)) {
      const prefix = result.summary.replace(/\s+&#821 \[…\]$/u, '');
      if (ammLead.startsWith(prefix.replace(/\s/g, ''))) result = publisherSummary(`${prefix} […]`, source);
    }
    if (!result.summary) continue;
    if (isYahooJapanPickup && result.summary === '(Yahoo!天気・災害)') continue;
    if (
      isHakkaNews &&
      result.summary.startsWith('編按：《客新聞》與《MyGoPen》合作反詐騙，將提供「事實查核」、「詐騙破解」等相關新聞訊息，')
    )
      continue;
    if (
      /^https?:\/\/(?:www\.)?taipeipost\.org\/\d+\/$/i.test(url) &&
      (/^編輯[／/]\s*[\p{Script=Han}]{2,5}撰文$/u.test(result.summary) || result.summary === '生活中心/綜合報導')
    )
      continue;
    // Reviewed malformed quoted metadata ends inside an unclosed link tag.
    if (/^https?:\/\/news\.videoland\.com\.tw\/article\/[a-f0-9-]+\.html$/i.test(url) && /<a\s+href\s*=\s*$/iu.test(result.summary))
      continue;
    if (isDaai && daaiBodies.includes(result.summary)) continue;
    if (/^https?:\/\/(?:www\.)?lifetoutiao\.news\/\d+\//i.test(url) && /^[（(]圖取自[／/][^（）()]{1,150}[）)]$/u.test(result.summary))
      continue;
    // This publisher's auto-description is clipped after capturing its UI controls.
    if (
      /^https?:\/\/(?:www\.)?newstaiwan\.net\//i.test(url) &&
      /^新聞熱度[：:]\s*[\d,]+\s*\|閱讀時間[：:]約\s*\d+\s*分鐘\|字體調整[：:]A\+A-/u.test(result.summary)
    )
      continue;
    if (isSecretChina && result.summary.endsWith(secretChinaPromotion)) {
      const prefix = result.summary.slice(0, -secretChinaPromotion.length);
      const credit = /\s+新聞\s+[\p{Script=Han}]{1,20}\s+-\s*$/u;
      if (credit.test(prefix)) {
        result = publisherSummary(prefix.replace(credit, ''), source);
        if (!result.summary) continue;
      }
    }
    if (copiedReportParagraphs.length >= 3) {
      const compact = result.summary.replace(/\s/g, '');
      let cursor = 0;
      const wholeReport = copiedReportParagraphs.every((text) => {
        const index = compact.indexOf(text, cursor);
        if (index < 0) return false;
        cursor = index + text.length;
        return true;
      });
      if (wholeReport && copiedReportParagraphs.reduce((n, text) => n + text.length, 0) >= 300) continue;
    }

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
      if (
        isJobs1111 &&
        remainder.length < 50 &&
        !/[。！？.!?]$/u.test(remainder) &&
        jobs1111Paragraphs.some((text) => text.length > remainder.length && text.startsWith(remainder))
      )
        continue;
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
