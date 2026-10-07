import type { CheerioAPI } from 'cheerio';
import { normalizeAuthorCredits } from './byline.ts';
import { urlKey } from './text.ts';

const personalName = /^[A-Za-zÀ-ž][A-Za-zÀ-ž.'’-]*(?: [A-Za-zÀ-ž][A-Za-zÀ-ž.'’-]*){0,4}$/u;
const entrySelector = '.full-article .post > .entry-container > .entry';

/** Own edition credits, original supplied writer, and explicit translation team members. */
export function globalVoicesCredits($: CheerioAPI, value: string): { authors: string[]; provider: string | null } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.hostname !== 'zht.globalvoices.org' || !/^\/\d{4}\/\d{2}\/\d{2}\/\d+\/$/.test(url.pathname)) return null;
  const header = $('.post-header-container > .post-header').first();
  const bookmark = header.find('h2.post-title > a[rel="bookmark"]').attr('href');
  if (!bookmark || !$(entrySelector).length) return null;
  try {
    if (urlKey(new URL(bookmark, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const writers: string[] = [];
  let translators: string[] = [];
  for (const node of header.find('.post-header-credit > .avatar-credits-container > .contributor > .contributor-name').toArray()) {
    const credit = $(node);
    const label = credit.children('.credit-label').text().trim();
    const link = credit.children('a.user-link');
    const href = link.attr('href');
    if (!href) continue;
    let target: URL;
    try {
      target = new URL(href, value);
    } catch {
      continue;
    }
    if (!/^(?:[a-z]+\.)?globalvoices\.org$/i.test(target.hostname) || !/^\/author\/[^/]+\/$/.test(target.pathname)) continue;
    const names = normalizeAuthorCredits([link.text().trim()]);
    if (label === '作者 (English)') writers.push(...names);
    if (label === '譯者 (繁體中文)') translators.push(...names);
  }
  if (!writers.length) return null;
  const lead = $(entrySelector).first().children('p').first().text().replace(/\s+/g, ' ').trim();
  const hkfp =
    /^本文由(.+?)撰寫，並於\d{4}年\d{1,2}月\d{1,2}日刊登於《香港自由新聞》（Hong Kong Free Press，簡稱HKFP）。全球之聲根據夥伴協議重新刊登於此。$/u.exec(
      lead,
    );
  const newsmaker =
    /^本文原由 (.+?) 撰寫，並於 \d{4} 年 \d{1,2} 月 \d{1,2} 日首次刊載於 NewsMaker；現經全球之聲依內容共享協議，編譯、轉載於此。$/u.exec(
      lead,
    );
  const original = (hkfp ?? newsmaker)?.[1]?.trim();
  const provider = original && personalName.test(original) ? (hkfp ? '香港自由新聞' : 'NewsMaker') : null;
  if (provider && original) {
    // This exact account is the declared supplying publisher, not the named writer.
    if (hkfp) {
      const account = writers.indexOf('Hong Kong Free Press');
      if (account >= 0) writers.splice(account, 1);
    }
    writers.push(original);
  }
  const methods = $(entrySelector).first().children('div.methods').last().text().replace(/\s+/g, ' ').trim();
  const translation = /^譯者[:：]\s*(.+)$/u.exec(methods);
  if (translation && translators.some((name) => name.endsWith('翻譯小組'))) {
    const members = translation[1].split(/\s*[,，]\s*/u);
    if (members.length <= 10 && members.every((name) => personalName.test(name)))
      translators = [...translators.filter((name) => !name.endsWith('翻譯小組')), ...members];
  }
  return { authors: normalizeAuthorCredits([...writers, ...translators]), provider };
}
