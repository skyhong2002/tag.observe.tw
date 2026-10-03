import { describe, expect, it } from 'vitest';
import type { FetchResult } from './fetch.ts';
import { discoverNews } from './news-discovery.ts';

const home = 'https://paper.test/';
const today = '2026-10-02T08:00:00+08:00';
const now = () => new Date('2026-10-03T00:00:00Z');
const body = '記者報導這是一篇具有完整內容的新聞，持續追蹤公共議題及地方發展，並查證相關資料提供讀者參考。'.repeat(8);
const article = (metadata = `<meta property="article:published_time" content="${today}">`, content = body) =>
  `<html><head><title>公共政策最新進展與專家分析</title>${metadata}</head><body><article><h1>公共政策最新進展與專家分析</h1><p>${content}</p></article></body></html>`;
const rss = (url: string, date = today) =>
  `<rss><channel><item><link>${url}</link><title>公共政策最新進展與專家分析</title>${date ? `<pubDate>${date}</pubDate>` : ''}</item></channel></rss>`;
const sitemap = (url: string) => `<urlset><url><loc>${url}</loc><lastmod>${today}</lastmod></url></urlset>`;
const link = (url: string) => `<h2><a href="${url}">公共政策最新進展與專家分析</a></h2>`;
function fixture(pages: Record<string, string | Partial<FetchResult> | Error>) {
  const calls: string[] = [];
  const fetcher = async (url: string): Promise<FetchResult> => {
    calls.push(url);
    const response = pages[url];
    if (response instanceof Error) throw response;
    return {
      url,
      status: response === undefined ? 404 : 200,
      body: typeof response === 'string' ? response : '',
      contentType: 'text/html',
      ms: 1,
      ...(typeof response === 'object' ? response : {}),
    };
  };
  return { calls, options: { fetch: fetcher, now } };
}

describe('discoverNews', () => {
  it('autodiscovers RSS and validates an actual recent article body', async () => {
    const f = fixture({
      [home]: '<link rel="alternate" type="application/rss+xml" href="/rss">',
      [`${home}rss`]: rss(`${home}news/12345`),
      [`${home}news/12345`]: article(''),
    });
    const result = await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options);
    expect(result).toMatchObject({ strategy: 'rss', listingUrl: `${home}rss`, attempted: 3 });
    expect(result.samples[0]).toMatchObject({ url: `${home}news/12345`, publishedAt: '2026-10-02T00:00:00.000Z', bodyLength: body.length });
    expect(result.items[0].publishedAt).toBeInstanceOf(Date);
  });

  it('finds a WordPress feed and accepts scoped published time', async () => {
    const f = fixture({
      [home]: '<script src="/wp-content/a.js"></script>',
      [`${home}feed/`]: rss(`${home}story/12345`, ''),
      [`${home}story/12345`]: article('').replace('<h1>', `<time class="entry-date published" datetime="${today}"></time><h1>`),
    });
    const result = await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options);
    expect(result.items).toHaveLength(1);
    expect(result.strategy).toBe('rss');
  });

  it('falls back from an empty feed to ranked internal HTML links', async () => {
    const f = fixture({
      [home]: '<link rel="alternate" type="application/rss+xml" href="/empty">' + link('/news/12345'),
      [`${home}empty`]: '<rss><channel></channel></rss>',
      [`${home}news/12345`]: article(),
    });
    const result = await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options);
    expect(result.strategy).toBe('html');
    expect(result.items).toHaveLength(1);
    expect(result.attempted).toBe(3);
  });

  it('traverses robots sitemap indexes but never treats lastmod as publication', async () => {
    const f = fixture({
      [home]: '',
      [`${home}robots.txt`]: `Sitemap: ${home}index.xml`,
      [`${home}index.xml`]: `<sitemapindex><sitemap><loc>${home}news.xml</loc></sitemap><sitemap><loc>https://other.test/map.xml</loc></sitemap></sitemapindex>`,
      [`${home}news.xml`]: sitemap(`${home}news/12345`),
      [`${home}news/12345`]: article(''),
    });
    const result = await discoverNews({ homeUrl: home }, f.options);
    expect(result.items).toEqual([]);
    expect(f.calls).toContain(`${home}news/12345`);
    expect(f.calls.some((url) => url.includes('other.test'))).toBe(false);
  });

  it('accepts a dated article from a plain sitemap after checking the page', async () => {
    const f = fixture({
      [home]: '',
      [`${home}robots.txt`]: '',
      [`${home}sitemap.xml`]: sitemap(`${home}news/12345`),
      [`${home}news/12345`]: article(),
    });
    const result = await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options);
    expect(result.strategy).toBe('sitemap');
    expect(result.items).toHaveLength(1);
  });

  it('permits explicit external feed seeds, but excludes syndicated and redirected articles', async () => {
    const external = 'https://feeds.test/paper';
    const f = fixture({
      [home]: link('https://others.test/news/54321'),
      [external]: rss('https://others.test/news/54321').replace(
        '</channel>',
        `<item><link>${home}news/12345</link><title>轉址其他媒體的新聞文章</title><pubDate>${today}</pubDate></item></channel>`,
      ),
      [`${home}news/12345`]: { url: 'https://others.test/news/12345', body: article() },
    });
    const result = await discoverNews({ homeUrl: home, feedUrls: [external] }, f.options);
    expect(result.items).toEqual([]);
    expect(f.calls).toContain(external);
    expect(f.calls.some((url) => url.startsWith('https://others.test/'))).toBe(false);
  });

  it('accepts the homepage redirect host and explicit www equivalence', async () => {
    const f = fixture({
      [home]: { url: 'https://canonical.test/', body: link('https://www.canonical.test/news/12345') },
      'https://www.canonical.test/news/12345': article(),
    });
    const result = await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options);
    expect(result.items[0].url).toBe('https://www.canonical.test/news/12345');
  });

  it('stops every strategy immediately on HTTP 429', async () => {
    const f = fixture({ [home]: { status: 429, body: 'slow down' } });
    const result = await discoverNews({ homeUrl: home, feedUrls: ['https://feeds.test/paper'] }, f.options);
    expect(result.attempted).toBe(1);
    expect(f.calls).toEqual([home]);
    expect(result.errors.join(' ')).toContain('429');
  });

  it('reports fetch errors while allowing bounded fallback', async () => {
    const f = fixture({
      [home]: new Error('request timed out'),
      [`${home}robots.txt`]: '',
      [`${home}sitemap.xml`]: sitemap(`${home}news/12345`),
      [`${home}news/12345`]: article(),
    });
    const result = await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options);
    expect(result.items).toHaveLength(1);
    expect(result.errors.join(' ')).toContain('request timed out');
    expect(result.attempted).toBe(4);
  });

  it.each([
    ['missing body', article('', '')],
    ['old page publication', article('<meta property="article:published_time" content="2020-01-01">')],
    ['future date', article('<meta property="article:published_time" content="2030-01-01">')],
    ['product', article(`<meta property="article:published_time" content="${today}"><meta property="og:type" content="product">`)],
    [
      'paywall',
      article(`<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"${today}","isAccessibleForFree":false}</script>`),
    ],
  ])('rejects %s despite a current feed entry', async (_, html) => {
    const f = fixture({ [home]: '', [`${home}rss`]: rss(`${home}news/12345`), [`${home}news/12345`]: html });
    expect((await discoverNews({ homeUrl: home, feedUrls: [`${home}rss`] }, f.options)).items).toEqual([]);
  });

  it('does not inherit a date from a related article JSON-LD or Atom updated field', async () => {
    const f = fixture({
      [home]: '',
      [`${home}atom`]: `<feed><entry><title>公共政策最新進展與專家分析</title><link href="${home}news/12345"/><updated>${today}</updated></entry></feed>`,
      [`${home}news/12345`]: article(
        `<script type="application/ld+json">{"@type":"NewsArticle","url":"${home}news/99999","datePublished":"${today}"}</script>`,
      ),
    });
    expect((await discoverNews({ homeUrl: home, feedUrls: [`${home}atom`] }, f.options)).items).toEqual([]);
  });

  it('never requests home, navigation, or product URLs as articles', async () => {
    const f = fixture({ [home]: [home, '/category/politics', '/product/12345'].map(link).join('') });
    const result = await discoverNews({ homeUrl: home }, { ...f.options, maxRequests: 4 });
    expect(result.items).toEqual([]);
    expect(f.calls.filter((url) => url === home)).toHaveLength(1);
    expect(f.calls.some((url) => /category|product/.test(url))).toBe(false);
    expect(result.attempted).toBeLessThanOrEqual(4);
  });

  it('follows a same-host issue refresh and validates explicit Founder archive metadata', async () => {
    const url = `${home}html/2026-10/02/content_12345.htm`;
    const f = fixture({
      [home]: '<META HTTP-EQUIV="REFRESH" CONTENT="0; URL=html/2026-10/02/node_2.htm">',
      [`${home}html/2026-10/02/node_2.htm`]: link(url),
      [url]: `<title>新聞電子報</title><founder-content><p>${body}</p></founder-content><!--enpproperty <founder-date>2026-10-02</founder-date><founder-title>公共政策完整標題</founder-title><founder-type>1</founder-type> /enpproperty-->`,
    });
    const result = await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options);
    expect(result.attempted).toBe(3);
    expect(result.items[0]).toMatchObject({ title: '公共政策完整標題', publishedAt: new Date('2026-10-02T00:00:00+08:00') });
  });

  it('does not follow external meta refresh destinations', async () => {
    const f = fixture({ [home]: '<meta http-equiv="refresh" content="0;url=https://other.test/">' });
    await discoverNews({ homeUrl: home }, f.options);
    expect(f.calls.some((url) => url.includes('other.test'))).toBe(false);
  });

  it('uses a scoped article post_time but rejects related or explicitly updated dates', async () => {
    for (const kind of ['published', 'related', 'updated']) {
      const time = '<span class="post_time">2026-10-02 18:15</span>';
      const header =
        kind === 'related'
          ? '<aside>' + time + '</aside>'
          : '<div class="top_title"><h1>公共政策最新新聞完整標題</h1><h5>' +
            (kind === 'updated' ? '更新時間：' : '') +
            time +
            '</h5></div>';
      const f = fixture({
        [home]: link('/news/12345'),
        [`${home}news/12345`]: `<title>公共政策最新新聞</title><div class="content_wrapper">${header}<div class="news_content"><p>${body}</p></div></div>`,
      });
      const result = await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options);
      expect(result.items).toHaveLength(kind === 'published' ? 1 : 0);
      if (kind === 'published') expect(result.samples[0].publishedAt).toBe('2026-10-02T10:15:00.000Z');
    }
  });

  it('matches configured article patterns against pathname plus query', async () => {
    const url = `${home}news.asp?Link_String_12345`;
    const f = fixture({ [home]: link(url), [url]: article() });
    const result = await discoverNews({ homeUrl: home, articlePattern: 'Link_String_', maxArticles: 1 }, f.options);
    expect(result.items[0].url).toBe(url);
  });

  it('accepts scoped Article microdata publication time outside an article tag', async () => {
    const f = fixture({
      [home]: link('/news/12345'),
      [`${home}news/12345`]: `<div class="article-details" itemtype="https://schema.org/Article"><h1>公共政策最新新聞完整標題</h1><time itemprop="datePublished" datetime="${today}"></time><div class="article-content"><p>${body}</p></div></div>`,
    });
    const result = await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options);
    expect(result.items).toHaveLength(1);
  });

  it('does not treat a recent date in a URL as publication evidence', async () => {
    const url = `${home}2026/10/02/news-12345/`;
    const f = fixture({ [home]: link(url), [url]: article('') });
    expect((await discoverNews({ homeUrl: home }, f.options)).items).toEqual([]);
  });

  it('reuses a cached HTML candidate when a news sitemap later supplies its publication date', async () => {
    const f = fixture({
      [home]: link('/news/12345'),
      [`${home}news/12345`]: article(''),
      [`${home}robots.txt`]: '',
      [`${home}sitemap.xml`]: `<urlset><url><loc>${home}news/12345</loc><news:news><news:publication_date>${today}</news:publication_date></news:news></url></urlset>`,
    });
    const result = await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options);
    expect(result.items).toHaveLength(1);
    expect(result.strategy).toBe('sitemap');
    expect(f.calls.filter((url) => url === `${home}news/12345`)).toHaveLength(1);
  });

  it('follows an explicitly seeded sitemap index and tolerates cycles', async () => {
    const f = fixture({
      [home]: '',
      [`${home}robots.txt`]: '',
      [`${home}index.xml`]: `<sitemapindex><sitemap><loc>${home}index.xml</loc></sitemap><sitemap><loc>${home}news.xml</loc></sitemap></sitemapindex>`,
      [`${home}news.xml`]: sitemap(`${home}news/12345`),
      [`${home}news/12345`]: article(),
    });
    const result = await discoverNews({ homeUrl: home, feedUrls: [`${home}index.xml`], maxArticles: 1 }, f.options);
    expect(result.items).toHaveLength(1);
    expect(result.strategy).toBe('sitemap');
    expect(f.calls.filter((url) => url === `${home}index.xml`)).toHaveLength(1);
  });

  it('rejects an article declaring an external canonical', async () => {
    const f = fixture({
      [home]: link('/news/12345'),
      [`${home}news/12345`]: article(
        `<meta property="article:published_time" content="${today}"><link rel="canonical" href="https://other.test/news/12345">`,
      ),
    });
    expect((await discoverNews({ homeUrl: home }, f.options)).items).toEqual([]);
  });

  it('bounds requests even when many sitemap children and article links exist', async () => {
    const f = fixture({ [home]: Array.from({ length: 20 }, (_, i) => link(`/news/${10000 + i}`)).join('') });
    const result = await discoverNews({ homeUrl: home }, { ...f.options, maxRequests: 4 });
    expect(result.attempted).toBe(4);
    expect(f.calls).toHaveLength(4);
  });
});
