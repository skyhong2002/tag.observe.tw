import type { CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';
import { huanqiuArticleMarkup } from './news-huanqiu-body.ts';

/** An own source slot and its People's Daily original link identify supplied copy. */
export function huanqiuPeopleProvider($: CheerioAPI, value: string): string | null {
  if (!huanqiuArticleMarkup($, value)) return null;
  const slot = $('.data-container > article').children('textarea.article-source-name');
  if (slot.length !== 1) return null;
  const source = cheerio.load(slot.text(), null, false);
  const link = source.root().children('a');
  if (source.root().children().length !== 1 || link.length !== 1 || source.root().text().trim() !== '人民日报') return null;
  try {
    const origin = new URL(link.attr('href') ?? '', value);
    if (origin.protocol !== 'https:' || origin.hostname !== 'www.peopleapp.com' || !/^\/column\/\d+-\d+$/.test(origin.pathname))
      return null;
  } catch {
    return null;
  }
  return '人民日报';
}
