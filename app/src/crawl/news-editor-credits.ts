import type { CheerioAPI } from 'cheerio';
import { isNonAuthorCredit, normalizeAuthorCredits, reporterNames } from './byline.ts';
import { urlKey } from './text.ts';

/** Complete editing credits in the publisher's own contributor field identify a named contributor. */
export function tvbsContributorCredits($: CheerioAPI, value: string): string[] | null {
  const url = new URL(value);
  if (url.hostname !== 'news.tvbs.com.tw' || !/^\/[a-z-]+\/\d+$/.test(url.pathname)) return null;
  try {
    const canonical = $('link[rel="canonical"]').attr('href');
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const heading = $('main h1');
  if (heading.length !== 1 || !heading.text().trim() || !$('title').text().includes(heading.text().trim())) return null;
  let changed = false;
  const values = $('main [data-section="article-contributors"]')
    .filter((_, node) => !$(node).closest('aside, nav, footer, [hidden], [aria-hidden="true"]').length)
    .toArray()
    .flatMap((node) => {
      const credit = $(node).text().replace(/\s+/g, ' ').trim();
      const own = /^編輯[：:]\s*([\p{Script=Han}]{2,5})$/u.exec(credit);
      if (own && !/(?:組|部|室|中心|團隊)$/u.test(own[1]) && reporterNames(`作者：${own[1]}`).length === 1) {
        changed = true;
        return [own[1]];
      }
      const pair = /^編輯[：:]\s*([\p{Script=Han}]{2,5})\s*[｜|]\s*責任編輯[：:]\s*([\p{Script=Han}]{2,5})$/u.exec(credit);
      return pair ? [pair[1], pair[2]] : [credit];
    })
    .filter(Boolean);
  return changed
    ? normalizeAuthorCredits(
        values.filter((credit) => credit.length <= 120 && !/^https?:\/\//i.test(credit) && !isNonAuthorCredit(credit)),
      ).slice(0, 30)
    : null;
}

/** BO News places the complete arranger credit on its own line before the report. */
export function bo6sEditorLead($: CheerioAPI, value: string): { author: string; prefix: string; paragraph: string } | null {
  const url = new URL(value);
  if (
    !['bo6s.com.tw', 'www.bo6s.com.tw'].includes(url.hostname) ||
    url.pathname !== '/news_detail.php' ||
    !/^\d+$/.test(url.searchParams.get('NewsID') ?? '')
  )
    return null;
  try {
    const identity = $('meta[property="og:url"]').attr('content');
    if (!identity || urlKey(new URL(identity, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const main = $('article').filter((_, node) => $(node).children('.news-header').find('h1.news-title').length === 1);
  if (main.length !== 1 || $('article h1').length !== 1 || !$('title').text().startsWith(main.find('h1.news-title').text().trim()))
    return null;
  const contents = main.find('.news-content').filter((_, node) => !$(node).closest('aside, nav, footer').length);
  if (contents.length !== 1) return null;
  const paragraph = contents.children('p').first().clone();
  paragraph.find('br').replaceWith('\n');
  const lines = paragraph.text().split('\n');
  const prefix = lines[0]?.trim() ?? '';
  const own = /^波新聞[─—－-]\s*([\p{Script=Han}]{2,5})編輯$/u.exec(prefix);
  if (!own || lines.length < 2 || /(?:組|部|室|中心|團隊)$/u.test(own[1]) || reporterNames(`作者：${own[1]}`).length !== 1) return null;
  return { author: own[1], prefix, paragraph: lines.slice(1).join(' ').replace(/\s+/g, ' ').trim() };
}

export function bo6sSummary($: CheerioAPI, value: string, summary: string): string | null {
  const own = bo6sEditorLead($, value);
  if (!own || !summary.startsWith(own.prefix)) return null;
  const excerpt = summary.slice(own.prefix.length).trim();
  const compact = (text: string) => text.replace(/\s/g, '');
  const prose = excerpt.replace(/(?:\.{3}|…)+$/u, '');
  return prose && compact(own.paragraph).startsWith(compact(prose)) ? excerpt : null;
}
