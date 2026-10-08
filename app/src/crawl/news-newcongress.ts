import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

const compact = (text: string) => text.replace(/\s/g, '');

/** A post's own paragraph text and corroborated declared writer, including pen names. */
export function newCongressPost($: CheerioAPI, value: string): { prose: string; author: string | null } | null {
  let url: URL;
  try {
    url = new URL(value);
    const canonical = $('link[rel="canonical"]').attr('href');
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const id = url.searchParams.get('p');
  if (url.hostname !== 'newcongress.tw' || url.pathname !== '/' || !id || !/^\d+$/.test(id)) return null;
  const post = $(`article#post-${id}.post`);
  const heading = post.children('.entry-header').children('h1.entry-title');
  const content = post.children('.entry-content');
  const title = heading.text().trim();
  const ogTitle = $('meta[property="og:title"]')
    .attr('content')
    ?.replace(/\s+-\s*$/, '')
    .trim();
  if (post.length !== 1 || heading.length !== 1 || content.length !== 1 || !title || ogTitle !== title) return null;
  const paragraphs = content.children('p');
  const prose = paragraphs
    .toArray()
    .map((node) => $(node).text())
    .join('\n\n');
  if (!prose.trim()) return null;
  const credit = post.children('.entry-footer').find('.entry-meta .byline .author.vcard');
  const name = credit.text().trim();
  const author =
    credit.length === 1 && /^[\p{L}\p{M}·‧ .-]{2,50}$/u.test(name) && compact(paragraphs.last().text()) === compact(`作者：${name}`)
      ? name
      : null;
  return { prose, author };
}

/** Reject the publisher's whole-post description so its supplied OG excerpt can be selected. */
export function newCongressFullDescription($: CheerioAPI, url: string, summary: string): boolean {
  const post = newCongressPost($, url);
  return post !== null && compact(summary) === compact(post.prose);
}
