import type { CheerioAPI } from 'cheerio';
import { articleNodes } from './article-content.ts';
import { decodeEntities, stripTags, urlKey } from './text.ts';

const text = (value: string) => decodeEntities(stripTags(value)).replace(/\s+/g, ' ').trim();

/** Remove the publisher's exact author/title/clock/id wrapper around its supplied excerpt. */
export function cool3cSummary($: CheerioAPI, value: string, summary: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const id = /^\/article\/(\d+)$/.exec(url.pathname)?.[1];
  if (!['www.cool3c.com', 'cool3c.com'].includes(url.hostname) || !id) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  try {
    if (!canonical || urlKey(new URL(canonical, value).href) !== urlKey(value)) return null;
  } catch {
    return null;
  }
  const heading = text($('h1').first().text());
  const author = $('meta[name="author"]').attr('content')?.trim();
  if (!heading || !author) return null;
  for (const node of articleNodes($, value)) {
    if (typeof node.headline !== 'string' || !text(node.headline).startsWith(`${heading} #`) || !node.headline.endsWith(`(${id}) - Cool3c`))
      continue;
    const authors = Array.isArray(node.author) ? node.author : [node.author];
    if (!authors.some((item) => item && typeof item === 'object' && 'name' in item && item.name === author)) continue;
    if (typeof node.description !== 'string' || text(node.description) !== summary || typeof node.datePublished !== 'string') continue;
    const clock = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?\+08:00$/.exec(node.datePublished);
    if (!clock) continue;
    const prefix = `${author}發佈${heading}，最新資訊於${clock[1]} ${clock[2]}：`;
    const suffix = `#(${id})`;
    if (!summary.startsWith(prefix) || !summary.endsWith(suffix)) continue;
    const excerpt = summary.slice(prefix.length, -suffix.length).replace(/^。/, '').trim();
    if (!excerpt) return '';
    if (typeof node.articleBody !== 'string') continue;
    const prose = text(node.articleBody).replace(/\s/g, '');
    const supplied = excerpt.replace(/(?:\.{3}|…)$/, '').replace(/\s/g, '');
    if (supplied && prose.includes(supplied)) return excerpt;
  }
  return null;
}
