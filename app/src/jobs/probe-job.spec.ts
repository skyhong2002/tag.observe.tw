import { describe, expect, it } from 'vitest';
import type { FetchResult } from '../crawl/fetch.ts';
import { probeSource } from './probe-job.ts';

const res = (url: string, body: string, status = 200): FetchResult => ({ url, status, body, contentType: 'text/xml', ms: 1 });
const recent = new Date(Date.now() - 3600e3).toUTCString();
const rss = (n: number, date = recent) =>
  `<rss><channel>${Array.from({ length: n }, (_, i) => `<item><title>t${i}</title><link>https://x.tw/a/${i}</link><pubDate>${date}</pubDate></item>`).join('')}</channel></rss>`;

describe('probeSource', () => {
  it('finds a sitemap advertised in robots.txt with recent items', async () => {
    const fetch = async (url: string) =>
      url.endsWith('/robots.txt')
        ? res(url, 'User-agent: *\nSitemap: https://www.cw.com.tw/news.xml')
        : url.endsWith('/news.xml')
          ? res(url, rss(8))
          : res(url, 'nope', 404);
    expect(await probeSource('cw', fetch as never)).toMatchObject({ kind: 'feed', url: 'https://www.cw.com.tw/news.xml', recentItems: 8 });
  });
  it('ignores feeds that only carry old items and falls back to homepage links', async () => {
    const old = new Date('2021-01-01').toUTCString();
    const home = Array.from({ length: 12 }, (_, i) => `<a href="/article/51430${i}">一則夠長的新聞標題 ${i}</a>`).join('');
    const fetch = async (url: string) =>
      url.endsWith('/feed') ? res(url, rss(20, old)) : url.endsWith('.com.tw/') ? res(url, home) : res(url, '', 404);
    expect(await probeSource('cw', fetch as never)).toMatchObject({ kind: 'discover', recentItems: 12 });
  });
  it('reports none when nothing usable exists', async () => {
    const fetch = async (url: string) => res(url, '', 404);
    expect((await probeSource('cw', fetch as never)).kind).toBe('none');
    expect((await probeSource('no-such-media', fetch as never)).detail).toBe('no known origin');
  });
  it('requires a complete article for catalog probes rather than accepting a feed alone', async () => {
    const fetch = async (url: string) =>
      url.includes('feed')
        ? res(
            url,
            `<rss><channel><item><title>近期文章但沒有內文</title><link>https://www.winnews.com.tw/123456/</link><pubDate>${recent}</pubDate></item></channel></rss>`,
          )
        : res(url, '<html><h1>沒有新聞內文</h1></html>');
    expect(await probeSource('winnews', fetch as never)).toMatchObject({ kind: 'none', recentItems: 0 });
  });
});
