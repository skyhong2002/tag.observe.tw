import * as cheerio from 'cheerio';
import reviewedPublications from '../../data/reviewed-publications.json' with { type: 'json' };

const BROWSER_URL = 'https://china.createsend1.com/t/j-e-ydlrkkiy-hynykddkd-r/';
const PUBLIC_URL = 'https://china.cmail19.com/t/j-e-ydlrkkiy-hynykddkd-r';
// The manifest cites the publisher's explicit issue date. Its announcement's
// hour is not treated as the newsletter publication hour.
const { title: TITLE, author: AUTHOR, publishedDate: PUBLICATION_DATE } = reviewedPublications[BROWSER_URL];

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

/** Render only this reviewed, complete public Chinese newsletter main article. */
export function renderWsjNewsletter(html: string, url: string): string | null {
  if (url !== BROWSER_URL && url !== PUBLIC_URL) return null;
  const $ = cheerio.load(html);
  const rows = $('td.stage-in > table.email-body > tbody > tr');
  if (
    rows.length !== 20 ||
    clean(rows.eq(0).find('.icon-left__h2 h2').text()) !== TITLE ||
    clean(rows.eq(0).find('.icon-left__h3 h3').text()) !== AUTHOR ||
    clean(rows.eq(1).find('h2').text()) !== '10月8日' ||
    clean(rows.eq(4).find('h2').text()) !== '前进之路？' ||
    clean(rows.eq(7).find('h1').text()) !== '本周要闻' ||
    clean(rows.eq(17).find('h1').text()) !== '关于我们' ||
    !clean(rows.eq(18).text()).startsWith('《华尔街日报》中国洞察新闻简报由本报首席中国记者魏玲灵主笔') ||
    $('img[alt="WSJ China"]').length === 0 ||
    !$(`a[href="${BROWSER_URL}"]`).text().includes('通过浏览器查看') ||
    !$.text().includes('[email address suppressed]') ||
    !/Copyright\s+2025\s+Dow Jones & Company, Inc\./.test(clean($.text()))
  ) {
    return null;
  }
  const first = rows.eq(3).find('td.email-body__article > p');
  const second = rows.eq(5).find('td.email-body__article > p');
  const firstParagraphs = first.toArray().map((element) => clean($(element).text()));
  const secondParagraphs = second.toArray().map((element) => clean($(element).text()));
  if (
    first.length !== 8 ||
    second.length !== 7 ||
    !firstParagraphs[0]?.startsWith('美国总统特朗普的谈判代表正试图与北京达成一项新的贸易协议') ||
    !firstParagraphs.at(-1)?.endsWith('一边大谈多边主义，一边却在打一场经济消耗战。') ||
    !secondParagraphs[0]?.startsWith('以下是美国商会建议的策略：首先，通过一些速赢方案建立好感。') ||
    !secondParagraphs.at(-1)?.endsWith('更是对中国政府二十年来背弃承诺的裁决。') ||
    firstParagraphs.concat(secondParagraphs).join('').replace(/\s/g, '').length < 1200
  ) {
    return null;
  }
  const paragraphs = (values: string[]) => values.map((text) => `<p>${escapeHtml(text)}</p>`).join('');
  return `<!doctype html><html lang="zh-Hans"><head><title>${escapeHtml(TITLE)}</title><link rel="canonical" href="${BROWSER_URL}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(TITLE)}"><meta property="article:published_time" content="${PUBLICATION_DATE}"><meta name="author" content="${AUTHOR}"><script data-news-public="wsj-newsletter" type="application/ld+json">{}</script></head><body><article><h1>${escapeHtml(TITLE)}</h1><time datetime="${PUBLICATION_DATE}">${PUBLICATION_DATE}</time><div class="article-content">${paragraphs(firstParagraphs)}<p><strong>${escapeHtml(clean(rows.eq(4).find('h2').text()))}</strong></p>${paragraphs(secondParagraphs)}</div></article></body></html>`;
}
