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
  it('applies the reviewed article scope to feeds, redirects and canonical URLs too', async () => {
    const f = fixture({
      [home]: '',
      [`${home}rss`]: `<rss><channel>${['english', 'redirect-zh-hant', 'canonical-zh-hant', 'good-zh-hant']
        .map((slug) => `<item><link>${home}story/${slug}</link><title>公共政策最新進展與專家分析</title><pubDate>${today}</pubDate></item>`)
        .join('')}</channel></rss>`,
      [`${home}story/redirect-zh-hant`]: { url: `${home}story/english`, body: article() },
      [`${home}story/canonical-zh-hant`]: article(
        `<link rel="canonical" href="${home}story/english"><meta property="article:published_time" content="${today}">`,
      ),
      [`${home}story/good-zh-hant`]: article(),
    });
    const result = await discoverNews(
      { homeUrl: home, feedUrls: [`${home}rss`], articlePattern: '^/story/.*-zh-hant$', maxArticles: 1 },
      f.options,
    );
    expect(result.items.map((item) => item.url)).toEqual([`${home}story/good-zh-hant`]);
    expect(f.calls).not.toContain(`${home}story/english`);
  });

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
  it('accepts only explicitly reviewed sibling publication hosts', async () => {
    const trusted = 'https://politics.paper.test/news/12345';
    const untrusted = 'https://sponsor.paper.test/news/12345';
    const f = fixture({ [home]: link(trusted) + link(untrusted), [trusted]: article(), [untrusted]: article() });
    const result = await discoverNews({ homeUrl: home, articleHosts: ['politics.paper.test'], maxArticles: 2 }, f.options);
    expect(result.items.map((x) => x.url)).toEqual([trusted]);
    expect(f.calls).not.toContain(untrusted);
    expect(result.items[0].verifiedContent).toMatchObject({ bodyStatus: 'ok', body });
  });

  it('discovers JSON hydration links but validates publication from the article itself', async () => {
    const url = `${home}news/12345`;
    const f = fixture({
      [home]: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { stories: [{ url, title: '公共政策最新完整新聞標題', datePublished: today }] } })}</script>`,
      [url]: article(''),
    });
    const result = await discoverNews({ homeUrl: home }, f.options);
    expect(f.calls).toContain(url);
    expect(result.items).toEqual([]);
    expect(result.errors.join(' ')).toContain('missing publication date');
  });

  it('discovers article links inside Next streaming data without executing scripts', async () => {
    const url = `${home}news/12345`;
    const payload = 'a:' + JSON.stringify(['$', 'a', null, { href: url, children: '公共政策最新新聞標題' }]) + '\n';
    const f = fixture({ [home]: `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`, [url]: article() });
    expect((await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options)).items[0].url).toBe(url);
  });

  it('reserves sitemap traversal for news instead of games and image inventories', async () => {
    const f = fixture({
      [home]: '',
      [`${home}robots.txt`]: `Sitemap: ${home}sitemaps/casualgames/index.xml\nSitemap: ${home}sitemaps/news.xml`,
      [`${home}sitemaps/news.xml`]: sitemap(`${home}news/12345`),
      [`${home}news/12345`]: article(),
    });
    expect((await discoverNews({ homeUrl: home, maxArticles: 1 }, { ...f.options, maxRequests: 4 })).items).toHaveLength(1);
    expect(f.calls).not.toContain(`${home}sitemaps/casualgames/index.xml`);
  });

  it('uses explicitly reviewed complete RSS text when the public article returns403', async () => {
    const feed = rss(`${home}news/12345`).replace('</item>', `<content:encoded><![CDATA[<p>${body}</p>]]></content:encoded></item>`);
    const pages = { [home]: '', [`${home}rss`]: feed, [`${home}news/12345`]: { status: 403 } };
    const f = fixture(pages);
    const result = await discoverNews({ homeUrl: home, feedUrls: [`${home}rss`], feedBody: 'full-text', maxArticles: 1 }, f.options);
    expect(result.items[0].verifiedContent).toMatchObject({ body, bodySource: 'rss:content:encoded', bodyStatus: 'ok' });
    expect((await discoverNews({ homeUrl: home, feedUrls: [`${home}rss`] }, fixture(pages).options)).items).toEqual([]);
  });

  it('rejects RSS excerpts even when they exceed the body minimum', async () => {
    const f = fixture({
      [home]: '',
      [`${home}rss`]: rss(`${home}news/12345`).replace(
        '</item>',
        `<content:encoded><![CDATA[<p>${body}</p><a>閱讀全文</a>]]></content:encoded></item>`,
      ),
      [`${home}news/12345`]: { status: 403 },
    });
    expect((await discoverNews({ homeUrl: home, feedUrls: [`${home}rss`], feedBody: 'full-text' }, f.options)).items).toEqual([]);
  });

  it('validates public REST publication date, article host and unprotected full body', async () => {
    const api = `${home}wp-json/wp/v2/posts?per_page=2`;
    const rows = [
      {
        link: `${home}news/12345`,
        date_gmt: '2026-10-02T00:00:00',
        title: { rendered: '公共政策完整標題' },
        content: { protected: false, rendered: `<p>${body}</p>` },
        excerpt: { rendered: '短摘要' },
      },
      {
        link: 'https://external.test/news/12345',
        date_gmt: '2026-10-02T00:00:00',
        title: { rendered: '外部來源新聞' },
        content: { protected: false, rendered: `<p>${body}</p>` },
      },
      {
        link: `${home}news/54321`,
        date_gmt: '2026-10-02T00:00:00',
        title: { rendered: '付費訂閱新聞' },
        content: { protected: true, rendered: `<p>${body}</p>` },
      },
    ];
    const f = fixture({ [api]: JSON.stringify(rows) });
    const result = await discoverNews({ homeUrl: home, apiUrls: [api], maxArticles: 2 }, f.options);
    expect(result.strategy).toBe('api');
    expect(result.items).toHaveLength(1);
    expect(result.samples[0].publishedAt).toBe('2026-10-02T00:00:00.000Z');
    expect(result.items[0].verifiedContent).toMatchObject({ body, bodySource: 'api:wordpress' });
  });

  it('reads HakkaTV anonymous news API and keeps original publisher identity', async () => {
    const api = 'https://api.hakkatv.org.tw/api/news/index?per=12&sort[created_at]=desc';
    const f = fixture({
      [api]: JSON.stringify({ data: [{ id: '1790677824473317', status: 1, created_at: '2026-10-02 08:00:00' }] }),
      'https://api.hakkatv.org.tw/api/news/read/1790677824473317': JSON.stringify({
        id: '1790677824473317',
        title: '公共政策完整新聞標題',
        created_at: '2026-10-02 08:00:00',
        content: body,
        author: '記者王小明',
        status: 1,
      }),
    });
    const result = await discoverNews({ homeUrl: 'https://www.hakkatv.org.tw/', maxArticles: 1 }, f.options);
    expect(result).toMatchObject({ strategy: 'api', attempted: 2 });
    expect(result.items[0]).toMatchObject({
      url: 'https://www.hakkatv.org.tw/news-detail/1790677824473317',
      verifiedContent: { body, bodySource: 'api:hakkatv' },
    });
  });

  it('keeps Miin story creation time and author rather than linked publisher identity', async () => {
    const list = 'https://api.miin.cc/web/feed/v3/news/story:list?limit=12&category=top';
    const f = fixture({
      [list]: JSON.stringify({ stories: [{ storyId: 123, state: 'normal' }] }),
      'https://api.miin.cc/web/story/v3/story?storyId=123': JSON.stringify({
        story: {
          storyId: 123,
          state: 'normal',
          data: {
            createAt: Date.parse(today) / 1000,
            title: [{ state: 'normal', text: '公共政策完整新聞標題' }],
            content: [{ state: 'normal', text: body }],
            author: { state: 'normal', data: { nickname: 'Miin 新聞' } },
          },
        },
      }),
    });
    const result = await discoverNews({ homeUrl: 'https://miin.cc/', maxArticles: 1 }, f.options);
    expect(result).toMatchObject({ strategy: 'api', attempted: 2 });
    expect(result.items[0]).toMatchObject({ url: 'https://miin.cc/story/123', verifiedContent: { body, authors: ['Miin 新聞'] } });
  });
  it('restores only publicly instructed TaiwanNews React stream chunks', async () => {
    const site = 'https://www.taiwannews.com.tw/';
    const url = `${site}news/12345`;
    const f = fixture({
      [site]: link(url),
      [url]: `<meta property="article:published_time" content="${today}"><template id="B:0"></template><div hidden id="S:0"><h1>公共政策完整新聞標題</h1><div itemprop="articleBody"><p>${body}</p></div></div><div hidden class="article-content"><p>不可見的其他內容${body}</p></div><script>$RC("B:0","S:0")</script>`,
    });
    const result = await discoverNews({ homeUrl: site, maxArticles: 1 }, f.options);
    expect(result.items[0].verifiedContent?.body).toBe(body);
  });

  it('requires READr hydration id/state to match the requested published article', async () => {
    const site = 'https://www.readr.tw/';
    const url = `${site}post/3057`;
    const state = {
      props: {
        pageProps: {
          postData: {
            id: '3057',
            state: 'published',
            title: '公共政策完整新聞標題',
            publishTime: today,
            content: { blocks: [{ text: body }] },
            writers: [{ name: '王小明' }],
          },
        },
      },
    };
    const f = fixture({ [site]: link(url), [url]: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script>` });
    const result = await discoverNews({ homeUrl: site, maxArticles: 1 }, f.options);
    expect(result.items[0].verifiedContent).toMatchObject({ body, authors: ['王小明'] });
    state.props.pageProps.postData.id = '9999';
    const other = fixture({
      [site]: link(url),
      [url]: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script>`,
    });
    expect((await discoverNews({ homeUrl: site }, other.options)).items).toEqual([]);
  });

  it('reads JSON-LD publication wrapped in recognized CDATA comments', async () => {
    const f = fixture({
      [home]: link('/news/12345'),
      [`${home}news/12345`]: article(
        `<script type="application/ld+json">/*<![CDATA[*/${JSON.stringify({ '@type': 'NewsArticle', datePublished: today })}/*]]>*/</script>`,
      ),
    });
    expect((await discoverNews({ homeUrl: home, maxArticles: 1 }, f.options)).items).toHaveLength(1);
  });

  it('repairs only i-media missing-host OG URLs that repeat the exact article path', async () => {
    const site = 'https://i-media.tw/';
    const url = `${site}Article/Detail/51186`;
    const f = fixture({
      [site]: link(url),
      [url]: `<meta property="og:url" content="https:///Article/Detail/51186"><article class="entry"><h1>公共政策完整新聞標題</h1><div class="entry__meta-holder"><span class="entry__meta-date">2026-10-02 08:00:00</span></div><div id="articleContent"><p>${body}</p></div></article>`,
    });
    expect((await discoverNews({ homeUrl: site, maxArticles: 1 }, f.options)).items[0].url).toBe(url);
  });

  it('accepts reviewed My Formosa news despite its Product schema template', async () => {
    const site = 'https://my-formosa.com.tw/';
    const url = `${site}DOC_229656.htm`;
    const f = fixture({
      [site]: link(url),
      [url]: `<script type="application/ld+json">{"@type":"Product"}</script><div class="blog-page"><h1>公共政策完整新聞標題</h1><div class="details"><span class="date">2026-10-02 08:00:00</span></div><div class="Bigcontent"><p>${body}</p></div></div>`,
    });
    expect((await discoverNews({ homeUrl: site, maxArticles: 1 }, f.options)).items).toHaveLength(1);
  });

  it('parses complete Daai public modal stories without executing inline handlers', async () => {
    const site = 'https://www.daai.tv/news';
    const record = JSON.stringify({ NewsID: 599609, Title: '公共政策完整新聞標題', NewsAirTime: '2026-10-02 08:00:00', Description: body });
    const literal = JSON.stringify(record).slice(1, -1);
    const f = fixture({ [site]: `<script>var news = '${literal}'; showNews(news);</script>` });
    const result = await discoverNews({ homeUrl: site, maxArticles: 1 }, f.options);
    expect(result.items[0]).toMatchObject({
      url: 'https://www.daai.tv/news/599609',
      verifiedContent: { body, bodySource: 'html:daai-news-modal' },
    });
  });
  it('reads IDN publication from the matched listing row rather than the article URL', async () => {
    const site = 'https://www.idn.com.tw/news/news_list.aspx?catid=1&catsid=2';
    const url = 'https://www.idn.com.tw/news/news_content.aspx?artid=12345';
    const f = fixture({
      [site]: `<table><tr><td class="body_9b">${link(url)}</td><td class="body_9g">2026-10-02</td></tr></table>`,
      [url]: '<h1>公共政策完整新聞標題</h1><table><tr><td class="newsa">' + `<p>${body}</p>` + '</td></tr></table>',
    });
    const result = await discoverNews({ homeUrl: site, maxArticles: 1 }, f.options);
    expect(result.items[0].publishedAt?.toISOString()).toBe('2026-10-01T16:00:00.000Z');
  });

  it('never falls back to RSS body after a blocked destination error orHTTP429', async () => {
    const feed = rss(`${home}news/12345`).replace('</item>', `<content:encoded><![CDATA[<p>${body}</p>]]></content:encoded></item>`);
    for (const failure of [new Error('Blocked non-public destination'), { status: 429 }]) {
      const f = fixture({ [home]: '', [`${home}rss`]: feed, [`${home}news/12345`]: failure });
      expect((await discoverNews({ homeUrl: home, feedUrls: [`${home}rss`], feedBody: 'full-text' }, f.options)).items).toEqual([]);
    }
  });
  it.each(['www.biao-news.com', 'lai-media.net', 'nvns.net'])(
    'repairs reviewed %s missing-php OG routes only for the same article ID',
    async (host) => {
      const site = `https://${host}/`;
      const url = `${site}news_view.php?new_sn=144926&new_csn=2713`;
      const f = fixture({
        [site]: link(url),
        [url]: `<meta property="og:url" content="${site}news_view?new_sn=144926"><meta property="og:type" content="article"><meta property="article:published_time" content="${today}"><h1>公共政策完整新聞標題</h1><article><p>${body}</p></article>`,
      });
      const result = await discoverNews({ homeUrl: site, maxArticles: 1 }, f.options);
      expect(result.items[0].url).toBe(url);
    },
  );
  it('rejects a Biao malformed canonical referring to a different article ID', async () => {
    const site = 'https://www.biao-news.com/';
    const url = `${site}news_view.php?new_sn=144926`;
    const f = fixture({
      [site]: link(url),
      [url]: article(
        `<meta property="og:url" content="${site}news_view?new_sn=999999"><meta property="og:type" content="article"><meta property="article:published_time" content="${today}">`,
      ),
    });
    expect((await discoverNews({ homeUrl: site }, f.options)).items).toEqual([]);
  });
  it.each(['www.biao-news.com', 'nvns.net', 'lai-media.net', 'iw-times.com'])(
    'prioritizes current %s article IDs over old pinned stories within a two-request budget',
    async (host) => {
      const site = `https://${host}/`;
      const oldUrl = `${site}news_view.php?new_sn=89526`;
      const newUrl = `${site}news_view.php?new_sn=144926`;
      const f = fixture({
        [site]: link(oldUrl) + `<a href="${newUrl}">公共政策最新進展與專家分析</a>`,
        [oldUrl]: article('<meta property="article:published_time" content="2020-01-01T08:00:00+08:00">'),
        [newUrl]: article(),
      });
      const result = await discoverNews({ homeUrl: site, maxArticles: 1 }, { ...f.options, maxRequests: 2 });
      expect(result.items.map((item) => item.url)).toEqual([newUrl]);
      expect(f.calls).toEqual([site, newUrl]);
    },
  );
  it('never treats a high newspaper article ID as proof of a recent publication', async () => {
    const site = 'https://www.biao-news.com/';
    const url = `${site}news_view.php?new_sn=999999`;
    for (const metadata of ['', '<meta property="article:published_time" content="2020-01-01T08:00:00+08:00">']) {
      const f = fixture({ [site]: link(url), [url]: article(metadata) });
      const result = await discoverNews({ homeUrl: site, maxArticles: 1 }, { ...f.options, maxRequests: 2 });
      expect(result.items).toEqual([]);
      expect(f.calls).toEqual([site, url]);
    }
  });
  it('orders home publisher IDs ahead of mixed navigation scores and other reviewed hosts', async () => {
    const site = 'https://www.biao-news.com/';
    const oldUrl = `${site}news_view.php?new_sn=89526`;
    const newUrl = `${site}news_view.php?new_sn=144926`;
    const otherUrl = 'https://nvns.net/news_view.php?new_sn=999999';
    const f = fixture({
      [site]: link(oldUrl) + link('/news/archive-12345') + link(otherUrl) + `<a href="${newUrl}">公共政策最新進展與專家分析</a>`,
      [newUrl]: article(),
    });
    const result = await discoverNews({ homeUrl: site, articleHosts: ['nvns.net'], maxArticles: 1 }, { ...f.options, maxRequests: 2 });
    expect(result.items.map((item) => item.url)).toEqual([newUrl]);
    expect(f.calls).toEqual([site, newUrl]);
  });
  it('uses the reviewed NTDTV Beijing-time header instead of its incorrect Z template', async () => {
    const site = 'https://www.ntdtv.com/';
    const url = `${site}b5/2026/10/03/a104156789.html`;
    const f = fixture({
      [site]: link(url),
      [url]: `<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-10-03T07:00:00Z"}</script><div class="article_title"><h1>公共政策完整新聞標題</h1></div><div class="article_info"><span class="time">北京時間：2026-10-03 07:00</span></div><div class="article_content"><p>${body}</p></div>`,
    });
    const result = await discoverNews({ homeUrl: site, maxArticles: 1 }, f.options);
    expect(result.items[0].publishedAt?.toISOString()).toBe('2026-10-02T23:00:00.000Z');
  });
});
