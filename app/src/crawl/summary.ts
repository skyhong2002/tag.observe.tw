import type { CheerioAPI } from 'cheerio';
import { articleNodes } from './article-content.ts';
import { decodeEntities, stripTags } from './text.ts';

export interface ArticleSummary {
  summary: string | null;
  summarySource: string | null;
}

/** Preserve publisher text, never invent a summary by taking the body's lead. */
export function publisherSummary(value: unknown, source: string, title?: string | null): ArticleSummary {
  if (typeof value !== 'string') return { summary: null, summarySource: null };
  const summary = decodeEntities(stripTags(value))
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Oversized feed descriptions often contain the entire article. Do not silently
  // turn them into an excerpt and call that a publisher-provided summary.
  if (!summary || summary.length > 4000 || summary === title?.trim()) return { summary: null, summarySource: null };
  return { summary, summarySource: source };
}

export function extractSummary($: CheerioAPI, url: string, selector?: string): ArticleSummary {
  if (!selector) {
    try {
      const page = new URL(url);
      if (page.hostname === 'news.pts.org.tw' && /^\/article\/\d+$/.test(page.pathname)) selector = '.post-article > .articleimg';
    } catch {}
  }
  const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content');
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
    const result = publisherSummary(value, source, title);
    if (result.summary) return result;
  }
  return { summary: null, summarySource: null };
}
