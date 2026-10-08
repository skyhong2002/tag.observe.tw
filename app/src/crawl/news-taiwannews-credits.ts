import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

/** The streamed own staff card has a named profile link and a matching avatar identity. */
export function taiwanNewsWriter($: CheerioAPI, value: string): string | null {
  const url = new URL(value);
  if (!['taiwannews.com.tw', 'www.taiwannews.com.tw'].includes(url.hostname) || !/^\/en\/news\/\d+$/.test(url.pathname)) return null;
  const identity = $('meta[property="og:url"]').attr('content');
  try {
    if (!identity || urlKey(new URL(identity, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const heading = $('h1');
  const ownTitle = $('meta[property="og:title"]').attr('content') ?? '';
  const date = $('meta[property="article:published_time"]').attr('content') ?? '';
  if (
    heading.length !== 1 ||
    !heading.text().trim() ||
    !/^[A-Z][a-z]{2}\. \d{1,2}, \d{4} \d{2}:\d{2}$/.test(date) ||
    ownTitle !== heading.text().trim() + ' | Taiwan News | ' + date ||
    $('title').text().trim() !== ownTitle
  )
    return null;
  const roles = $('section.max-w-2xl.border-2.bg-light-2 p.text-gray-3.text-subtle-large').filter(
    (_, element) => $(element).text().trim() === 'Taiwan News, Staff Writer',
  );
  if (roles.length !== 1) return null;
  const column = roles.parent();
  const card = column.parent();
  const profile = column.children('p').first().children('a');
  const avatar = card.children('a').children('img');
  const href = profile.attr('href') ?? '';
  const name = profile.text().trim();
  if (
    profile.length !== 1 ||
    avatar.length !== 1 ||
    !/^\/en\/journalist\/\d+$/.test(href) ||
    avatar.parent().attr('href') !== href ||
    avatar.attr('alt')?.trim() !== name ||
    !/^[\p{L}\p{M}][\p{L}\p{M} .’'·-]{1,100}$/u.test(name)
  )
    return null;
  return name;
}
