import type { CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';
import { urlKey } from './text.ts';

/** Own dated article slots may contain encoded HTML even on the www host. */
export function huanqiuArticleMarkup($: CheerioAPI, value: string): string | null {
  const url = new URL(value);
  const id = /^\/article\/([A-Za-z0-9]+)$/.exec(url.pathname)?.[1];
  if (url.hostname !== 'www.huanqiu.com' || !id) return null;
  const identity = $('meta[property="og:url"]').attr('content');
  try {
    if (!identity || urlKey(new URL(identity, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const article = $('.data-container > article');
  const slots = article.children('textarea.article-content');
  const title = article.children('textarea.article-title');
  const time = article.children('textarea.article-time');
  if (
    article.length !== 1 ||
    slots.length !== 1 ||
    title.length !== 1 ||
    time.length !== 1 ||
    article.children('textarea.article-aid').text().trim() !== id ||
    !/^\d{13}$/.test(time.text().trim()) ||
    !title.text().trim() ||
    title.text().trim() !== $('title').text().trim()
  )
    return null;
  const markup = slots.text().trim();
  const decoded = cheerio.load(markup, null, false);
  if (decoded.root().children().length !== 1 || decoded.root().children('article').length !== 1 || !decoded('article > section').length)
    return null;
  return markup;
}

/** Epoch milliseconds belong to this report, not its recommendations or source edition. */
export function huanqiuPublished($: CheerioAPI, value: string): Date | null {
  if (!huanqiuArticleMarkup($, value)) return null;
  const date = new Date(Number($('.data-container > article > textarea.article-time').text().trim()));
  return Number.isFinite(date.getTime()) ? date : null;
}

/** People's Daily typesets two-character names with an internal space in its reporter slot. */
export function huanqiuSpacedReporters($: CheerioAPI, value: string): string[] | null {
  if (!huanqiuArticleMarkup($, value)) return null;
  const article = $('.data-container > article');
  const slot = article.children('textarea.article-author');
  const sourceSlot = article.children('textarea.article-source-name');
  if (slot.length !== 1 || sourceSlot.length !== 1) return null;
  const source = cheerio.load(sourceSlot.text(), null, false);
  const link = source.root().children('a');
  if (link.length !== 1 || link.text().trim() !== '人民日报') return null;
  try {
    const origin = new URL(link.attr('href') ?? '', value);
    if (origin.hostname !== 'www.peopleapp.com' || !/^\/column\/\d+-\d+$/.test(origin.pathname)) return null;
  } catch {
    return null;
  }
  const credit = /^作者：([\p{Script=Han}]) ([\p{Script=Han}]) ([\p{Script=Han}]{2,5})$/u.exec(slot.text().trim().replace(/\s+/g, ' '));
  return credit ? [credit[1] + credit[2], credit[3]] : null;
}

/** Read only complete role declarations inside the already verified own report. */
export function huanqiuDeclaredReporters(markup: string): string[] | null {
  const $ = cheerio.load(markup, null, false);
  const paragraphs = $('article > section p')
    .map((_, node) => $(node).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean);
  const lead = paragraphs[0] ?? '';
  const joint =
    /^【环球时报记者 ([\p{Script=Han}]{2,5}(?: [\p{Script=Han}]{2,5}){0,5}) 环球时报特约记者 ([\p{Script=Han}]{2,5}(?: [\p{Script=Han}]{2,5}){0,5})】(?=.{80})/u.exec(
      lead,
    );
  if (joint) return [...new Set([...joint[1].split(' '), ...joint[2].split(' ')])];
  const written = /^文字记者：([\p{Script=Han}]{2,5}(?:、[\p{Script=Han}]{2,5}){0,5})$/u.exec(paragraphs.at(-2) ?? '');
  if (written && /^海报设计：[\p{Script=Han}]{2,5}$/u.test(paragraphs.at(-1) ?? '')) return written[1].split('、');
  const video = paragraphs.slice(-5);
  const reporter = /^记者：([\p{Script=Han}]{2,5})$/u.exec(video[2] ?? '');
  if (
    reporter &&
    /^统筹：[\p{Script=Han}]{2,5}(?:、[\p{Script=Han}]{2,5}){0,5}$/u.test(video[0]) &&
    /^编导：[\p{Script=Han}]{2,5}$/u.test(video[1]) &&
    /^海报：[\p{Script=Han}]{2,5}$/u.test(video[3]) &&
    video[4] === '新华社音视频部制作'
  )
    return [reporter[1]];
  return null;
}
