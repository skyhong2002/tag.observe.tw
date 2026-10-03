import { afterEach, describe, expect, it, vi } from 'vitest';
import type { fetchText } from '../fetch.ts';
import { listSource } from '../pipeline.ts';
import { loadSources } from '../sources.ts';
import { overrides } from './overrides.ts';

const published = '2026-10-03T08:00:00Z';
function newsMap(entries: Array<{ url: string; date?: string }>) {
  return `<urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${entries
    .map(
      ({ url, date = published }) =>
        `<url><loc>${url}</loc><news:news><news:publication_date>${date}</news:publication_date><news:title>完整新聞報導</news:title></news:news></url>`,
    )
    .join('')}</urlset>`;
}
function fixtureFetch(fixtures: Record<string, string>) {
  return vi.fn<typeof fetchText>(async (url) => {
    if (!(url in fixtures)) throw new Error(`Unexpected listing: ${url}`);
    return { url, status: 200, body: fixtures[url], contentType: 'application/xml', ms: 0 };
  });
}
afterEach(() => vi.restoreAllMocks());

describe('high-volume publisher listing coverage', () => {
  it('keeps more than the Mirror RSS window, deduplicates its supplement, and excludes stale/partner stories', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-03T12:00:00Z').getTime());
    const spec = loadSources(overrides).find((source) => source.media === 'mirror')!;
    const stories = Array.from({ length: 200 }, (_, i) => ({ url: `https://www.mirrormedia.mg/story/20261003edi${i}` }));
    const fetch = fixtureFetch({
      'https://www.mirrormedia.mg/rss/posts-news.xml': newsMap([
        ...stories,
        { url: 'https://www.mirrormedia.mg/story/old', date: '2023-08-30T08:00:00Z' },
        { url: 'https://www.mirrormedia.mg/external/partner_123' },
      ]),
      'https://www.mirrormedia.mg/rss/rss.xml': `<rss><channel><item><link>${stories[0].url}</link><title>重複報導</title><pubDate>${published}</pubDate></item><item><link>https://www.mirrormedia.mg/story/rss-only</link><title>RSS補充新聞</title><pubDate>${published}</pubDate></item></channel></rss>`,
    });
    const result = await listSource(spec, fetch);
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(201);
    expect(new Set(result.items.map((item) => item.url)).size).toBe(201);
    expect(result.items.every((item) => item.publishedAt?.toISOString() === '2026-10-03T08:00:00.000Z')).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('gets current Storm stories before supplementing the lagging legacy news sitemap', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-03T12:00:00Z').getTime());
    const spec = loadSources(overrides).find((source) => source.media === 'storm')!;
    const fetch = fixtureFetch({
      'https://www.storm.mg/sitemaps/1/article-news-1.xml': newsMap([
        { url: 'https://www.storm.mg/article/11169522' },
        { url: 'https://www.storm.mg/lifestyle/11169523' },
        { url: 'https://www.storm.mg/category/1' },
      ]),
      'https://www.storm.mg/sitemap/news': newsMap([
        { url: 'https://www.storm.mg/article/11169522' },
        { url: 'https://www.storm.mg/article/11169093', date: '2026-10-01T11:20:00Z' },
      ]),
    });
    const result = await listSource(spec, fetch);
    expect(result.errors).toEqual([]);
    expect(result.items.map((item) => item.url)).toEqual([
      'https://www.storm.mg/article/11169522',
      'https://www.storm.mg/lifestyle/11169523',
      'https://www.storm.mg/article/11169093',
    ]);
    expect(fetch.mock.calls[0][0]).toBe('https://www.storm.mg/sitemaps/1/article-news-1.xml');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
