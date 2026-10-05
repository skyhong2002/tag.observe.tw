import { describe, expect, it } from 'vitest';
import { extractArticle, parsePublished, providerName } from './article.ts';
import { parseFeed } from './feed.ts';
import type { FetchResult } from './fetch.ts';
import { listSource } from './pipeline.ts';
import { allSources } from './registry.ts';
import type { SourceSpec } from './sources.ts';
import { headlineFromPage, stripTitleSuffix, urlKey } from './text.ts';

const spec = (media: string) => allSources().find((s) => s.media === media) as SourceSpec;

describe('automatic news pipeline', () => {
  it('passes only verified recent full articles from automatic discovery to indexing', async () => {
    const current = new Date(Date.now() - 3600e3).toISOString();
    const home = 'https://automatic.example/';
    const source: SourceSpec = {
      media: 'automatic',
      group: 'hourly',
      list: {
        urls: [{ cat: 'news', url: home }],
        autoDiscover: { homeUrl: home, feedUrls: [home + 'feed'], maxArticles: 2 },
      },
      article: { enabled: true, batch: 2, delayMs: 0 },
    };
    const story = `<meta property="og:type" content="article"><meta property="og:title" content="完整且有日期的新聞報導"><meta property="article:published_time" content="${current}"><article><p>${'市政府今天公布公共運輸改善計畫，居民提出增加班次及服務範圍的意見。'.repeat(8)}</p></article>`;
    const pages: Record<string, string> = {
      [home]: '<html></html>',
      [home + 'feed']:
        `<rss><channel>${['story/1', 'story/2'].map((path) => `<item><title>新聞標題夠長</title><link>${home}${path}</link><pubDate>${current}</pubDate></item>`).join('')}</channel></rss>`,
      [home + 'story/1']: story,
      [home + 'story/2']: '<article><p>只有一句摘要</p></article>',
    };
    const fetch = async (url: string): Promise<FetchResult> => ({
      url,
      status: pages[url] ? 200 : 404,
      body: pages[url] ?? '',
      contentType: 'text/html',
      ms: 1,
    });
    const result = await listSource(source, fetch);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ url: home + 'story/1', title: '完整且有日期的新聞報導', publishedAt: new Date(current) });
  });
});

describe('traffic coverage sources', () => {
  const fetchHtml =
    (body: string) =>
    async (url: string): Promise<FetchResult> => ({
      url,
      status: 200,
      body,
      contentType: 'text/html',
      ms: 1,
    });
  it('extracts only the headline from a mirror daily card, excluding its date and summary', async () => {
    const body =
      '<a href="/story/89425"><p>2026/10/03 15:45</p><figcaption>這是一則完整的新聞標題</figcaption><p>這是內文摘要，不可當成標題</p></a><a href="/topic/123">這是一個專題並非新聞</a>';
    const { items } = await listSource(spec('mirrordaily'), fetchHtml(body));
    expect(items.map((i) => i.title)).toEqual(['這是一則完整的新聞標題']);
  });
  it('keeps MNews original stories, excluding partner copies and static pages', async () => {
    const card = (id: string) =>
      `<a href="/story/${id}"><span class="ui-post-card_infoTitle__hash">鏡新聞自己的完整新聞標題</span><span>2026.10.03 15:00</span></a>`;
    const { items } = await listSource(
      spec('mnews'),
      fetchHtml(card('20261003nm002') + card('mm-20261003edi016') + card('md-89425') + card('privacy')),
    );
    expect(items.map((i) => [i.url, i.title])).toEqual([['https://www.mnews.tw/story/20261003nm002', '鏡新聞自己的完整新聞標題']]);
  });
  it('merges the FTV news sitemap with its realtime page', async () => {
    const published = new Date(Date.now() - 3600e3).toISOString();
    const pages: Record<string, string> = {
      'https://www.ftvnews.com.tw/sitemap/sitemap.xml': `﻿<?xml version="1.0" encoding="utf-8"?><urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"><url><loc>https://www.ftvnews.com.tw/news/detail/2026A04W0001</loc><news:news><news:publication_date>${published}</news:publication_date><news:title>網站地圖裡的民視新聞標題</news:title><news:keywords>政治,選舉</news:keywords></news:news></url></urlset>`,
      'https://www.ftvnews.com.tw/realtime/':
        "<ul id='realtime'><li><a class='img-block' href='/news/detail/2026A04W0001'><img alt='網站地圖裡的民視新聞標題'></a></li><li><a class='img-block' href='/news/detail/2026A04W0215'><img alt='即時列表裡的新聞標題'></a><a href='/news/detail/2026A04W0215'><div class='time'>2026/10/04 14:11:17</div><h2 class='title'>即時列表裡的新聞標題</h2><div class='desc'>摘要不是標題</div></a></li></ul><a href='/realtime/'>即時新聞列表頁</a>",
    };
    const fetch = async (url: string): Promise<FetchResult> => ({
      url,
      status: 200,
      body: pages[url] ?? '',
      contentType: 'text/html',
      ms: 1,
    });
    const { items } = await listSource(spec('ftv'), fetch);
    expect(items.map((i) => [i.url.slice(-12), i.title, !!i.publishedAt])).toEqual([
      ['2026A04W0001', '網站地圖裡的民視新聞標題', true],
      ['2026A04W0215', '即時列表裡的新聞標題', false],
    ]);
    expect(items[0].tags).toEqual(['政治', '選舉']);
  });
  it('keeps KNews article IDs and drops the card category from the headline', async () => {
    const body =
      '<a href="/news/A6E5314201ECAC7C8231C3C575A11136"><div class="title">知新聞完整的體育新聞標題</div><div class="category">體育</div></a><a href="/realtime/latest">即時新聞分類不應該被收錄</a>';
    const { items } = await listSource(spec('knews'), fetchHtml(body));
    expect(items.map((i) => i.title)).toEqual(['知新聞完整的體育新聞標題']);
  });
});

describe('published time', () => {
  it('prefers a full timestamp over a bare pubdate', () => {
    const html = `<meta name="pubdate" content="20260929" /><meta name="article:published_time" content="2026-09-29T22:00:39+08:00" />`;
    expect(extractArticle(html, 'https://hk.on.cc/x').publishedAt?.toISOString()).toBe('2026-09-29T14:00:39.000Z');
  });
  it('falls back to JSON-LD datePublished, including entity-encoded offsets', () => {
    const html = `<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-09-29T21:44:16&#x2B;08:00"}</script>`;
    expect(extractArticle(html, 'https://www.taisounds.com/x').publishedAt?.toISOString()).toBe('2026-09-29T13:44:16.000Z');
  });
  it('reads compact dates as Taipei midnight and rejects garbage', () => {
    expect(parsePublished('20260929')?.toISOString()).toBe('2026-09-28T16:00:00.000Z');
    expect(parsePublished('soon')).toBeNull();
  });
});

describe('article identity', () => {
  it('collapses taisounds category variants into one key', () => {
    const id = spec('taisounds').list.articleId;
    expect(urlKey('https://www.taisounds.com/news/content/140/291237', id)).toBe(
      urlKey('https://www.taisounds.com/news/content/89/291237', id),
    );
  });
  it('collapses theinitium simplified-Chinese copies', () => {
    const id = spec('theinitium').list.articleId;
    expect(urlKey('https://theinitium.com/20260928-whatsnew-tibet-zh-hans/', id)).toBe(
      urlKey('https://theinitium.com/20260928-whatsnew-tibet/', id),
    );
  });
  it('drops the cw rec tracking parameter', () => {
    expect(urlKey('https://www.cw.com.tw/article/5143000?rec=es')).toBe(urlKey('https://www.cw.com.tw/article/5143000'));
  });
});

describe('title suffixes', () => {
  it.each([
    ['taisounds', '竹炭月餅疑發霉！業者稱是「竹炭絲」 | 消費 - 太報 TaiSounds', '竹炭月餅疑發霉！業者稱是「竹炭絲」'],
    ['nownews', '王曼昱拿3面金牌 | 綜合 | 運動 | NOWnews今日新聞', '王曼昱拿3面金牌'],
    ['pts', '民眾示威要求政府保障居住權 ｜ 公視新聞網 PNN', '民眾示威要求政府保障居住權'],
    ['commonhealth', '停止過度思考 - 康健雜誌', '停止過度思考'],
    ['udn', '上海美國商會 | 聯合新聞網', '上海美國商會'],
    ['worldjournal', '台積電帶頭衝 台股狂飆千點 一舉突破49000大關 | 世界新聞網', '台積電帶頭衝 台股狂飆千點 一舉突破49000大關'],
    ['worldjournal', '台股上漲｜世界新聞網', '台股上漲'],
    ['worldjournal', '世界新聞網報導台股上漲', '世界新聞網報導台股上漲'],
    ['hbr', 'AI省下人力！別把核心能力一起省掉 | 哈佛商業評論全球繁體中文版', 'AI省下人力！別把核心能力一起省掉'],
    ['ngm', '居住環境可能和你罹患失智症的風險有關？ - 國家地理雜誌中文網', '居住環境可能和你罹患失智症的風險有關？'],
  ])('%s', (media, title, expected) => {
    expect(stripTitleSuffix(title, spec(media).titleSuffix)).toBe(expected);
  });
  it('leaves titles without the suffix alone', () => {
    expect(stripTitleSuffix('LIVE - 內湖洋流來襲', spec('nownews').titleSuffix)).toBe('LIVE - 內湖洋流來襲');
  });
});

describe('discovered listing titles', () => {
  it('takes the page headline when the anchor text wraps it with the lede', () => {
    const listed =
      '江啟臣競總成立！鄭麗文喊下架民進黨 禿子漢子燕子合體力挺 【記者陳力維／綜合報導】國民黨台中市長參選人江啟臣今（10/4）日在西屯區成立競選總部';
    const page = '江啟臣競總成立！鄭麗文喊下架民進黨　禿子漢子燕子合體力挺';
    expect(headlineFromPage(listed, page)).toBe(page);
  });
  it('takes the page headline when the anchor text is an overlong lede', () => {
    const listed =
      '尖沙咀有人墮海。今日(3日)清晨6時59分，有途人報案，指梳士巴利道18號K11 Musea對開10米海面有一具人形物體載浮載沉。救援船隻接報趕至撈起一名女子送回岸上';
    expect(headlineFromPage(listed, '尖沙咀女子墮海　送院搶救終不治')).toBe('尖沙咀女子墮海　送院搶救終不治');
  });
  it('keeps a headline-sized anchor text and ignores short or missing page titles', () => {
    expect(headlineFromPage('江啟臣競總成立　民眾黨台中隊突喊不出席：若造成困擾就不參加', '聯合新聞網新聞標題')).toBeNull();
    expect(
      headlineFromPage(
        '尖沙咀有人墮海。今日(3日)清晨6時59分，有途人報案，指梳士巴利道18號K11 Musea對開10米海面有一具人形物體載浮載沉',
        'on.cc東網',
      ),
    ).toBeNull();
    expect(headlineFromPage('任意標題', null)).toBeNull();
  });
  it('strips the cw site suffix from page titles', () => {
    expect(stripTitleSuffix('iPhone Duo登場！蘋果參戰摺疊機，是殺手鐧還是一場豪賭？｜天下雜誌', spec('cw').titleSuffix)).toBe(
      'iPhone Duo登場！蘋果參戰摺疊機，是殺手鐧還是一場豪賭？',
    );
  });
});

describe('listing include filter', () => {
  it('follows UDN news sitemap pages with dates and tags, without the 300-item archive cap', async () => {
    const now = new Date().toISOString();
    const item = (id: number) =>
      `<url><loc>https://udn.com/news/story/6656/${id}</loc><news:news><news:title>聯合新聞標題 ${id}</news:title><news:publication_date>${now}</news:publication_date><news:keywords>預算,台電</news:keywords></news:news></url>`;
    const pages: Record<string, string> = {
      'https://udn.com/sitemap/gnews/2':
        '<sitemapindex><sitemap><loc>https://udn.com/sitemap/gnews_contents/2/1</loc></sitemap><sitemap><loc>https://udn.com/sitemap/gnews_contents/2/2</loc></sitemap></sitemapindex>',
      'https://udn.com/sitemap/gnews/1015':
        '<sitemapindex><sitemap><loc>https://udn.com/sitemap/gnews_contents/1015/1</loc></sitemap></sitemapindex>',
      'https://udn.com/sitemap/gnews_contents/2/1': `<urlset>${Array.from({ length: 301 }, (_, i) => item(i + 1)).join('')}</urlset>`,
      'https://udn.com/sitemap/gnews_contents/2/2': `<urlset>${item(302)}</urlset>`,
      'https://udn.com/sitemap/gnews_contents/1015/1': `<urlset>${item(303)}</urlset>`,
    };
    const fetch = async (url: string): Promise<FetchResult> => {
      if (!pages[url]) throw Error(`Unexpected UDN listing: ${url}`);
      return { url, status: 200, body: pages[url], contentType: 'application/xml', ms: 1 };
    };
    const { items, errors } = await listSource(spec('udn'), fetch);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(303);
    expect(items.find((i) => i.url.endsWith('/302'))).toMatchObject({
      title: '聯合新聞標題 302',
      publishedAt: new Date(now),
      tags: ['預算', '台電'],
    });
  });
  it('keeps only article URLs from a plain sitemap', async () => {
    const now = new Date().toISOString();
    const body = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
      '/article/94685',
      '/channel/12',
      '/subscriptions',
    ]
      .map((p) => `<url><loc>https://www.commonhealth.com.tw${p}</loc><lastmod>${now}</lastmod></url>`)
      .join('')}</urlset>`;
    const fetch = async (url: string): Promise<FetchResult> => ({ url, status: 200, body, contentType: 'application/xml', ms: 1 });
    const { items } = await listSource(spec('commonhealth'), fetch);
    expect(items.map((i) => i.url)).toEqual(['https://www.commonhealth.com.tw/article/94685']);
  });
  it('takes the head of an undated newest-first sitemap (1111)', async () => {
    const body = `<urlset>${Array.from({ length: 60 }, (_, i) => `<url><loc>https://www.1111.com.tw/news/jobns/${167700 - i}</loc></url>`).join('')}</urlset>`;
    const fetch = async (url: string): Promise<FetchResult> => ({ url, status: 200, body, contentType: 'application/xml', ms: 1 });
    const { items } = await listSource(spec('1111'), fetch);
    expect(items).toHaveLength(40);
    expect(items[0].url).toBe('https://www.1111.com.tw/news/jobns/167700');
  });
});

describe('stale listings (2026-10-04)', () => {
  it('titles an e-info card from its .title when the card link is an empty overlay', async () => {
    const body =
      '<article class="card"><a href="/node/243937"><span></span></a><time>2026年10月02日</time><div class="title"><p>電商推週三惜食日 減少剩食浪費</p></div></article>';
    const fetch = async (url: string): Promise<FetchResult> => ({ url, status: 200, body, contentType: 'text/html', ms: 1 });
    const { items } = await listSource({ ...spec('einfo'), list: { ...spec('einfo').list, urls: [spec('einfo').list.urls[0]] } }, fetch);
    expect(items.map((i) => [i.url, i.title])).toEqual([['https://e-info.org.tw/node/243937', '電商推週三惜食日 減少剩食浪費']]);
  });
});

describe('yahoo provider rule', () => {
  const page = (name: string) =>
    `<script>self.__next_f.push([1,"{\\"attribution\\":{\\"provider\\":{\\"darkLogo\\":{\\"url\\":\\"x\\"},\\"name\\":\\"${name}\\"}},\\"related\\":{\\"provider\\":{\\"name\\":\\"Yahoo股市\\"}}}"])</script>`;
  it('reads the first provider on the page', () => {
    expect(providerName(page('Yahoo新聞編輯室'))).toBe('Yahoo新聞編輯室');
    expect(providerName(page('理財周刊'))).toBe('理財周刊');
    expect(providerName('<html></html>')).toBeNull();
  });
  it("keeps Yahoo's own reporting only", () => {
    const rule = new RegExp(spec('yahoo').article.provider as string);
    expect(['Yahoo新聞編輯室', '簡子喬｜Yahoo名人娛樂特派記者', '理財周刊', 'FTNN新聞網'].map((n) => rule.test(n))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe('new media (2026-09-30)', () => {
  it('parses RSS 1.0 (RDF) feeds', () => {
    const xml = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://purl.org/rss/1.0/">
      <channel rdf:about="https://www.taipeitimes.com/"><title>Taipei Times</title></channel>
      <item rdf:about="https://www.taipeitimes.com/News/front/archives/2026/09/30/2003865114"><title>Taiwan vital to US security</title>
      <link>https://www.taipeitimes.com/News/front/archives/2026/09/30/2003865114</link><dc:date>2026-09-30</dc:date></item></rdf:RDF>`;
    const f = parseFeed(xml);
    expect(f.kind).toBe('rss');
    expect(f.items[0]).toMatchObject({ title: 'Taiwan vital to US security', publishedAt: new Date('2026-09-30T00:00:00Z') });
  });
  it('keeps only CTV news clips from its YouTube feed and strips the channel tail', async () => {
    const now = new Date().toISOString();
    const entry = (id: string, title: string) =>
      `<entry><title>${title}</title><link rel="alternate" href="https://www.youtube.com/watch?v=${id}"/><published>${now}</published></entry>`;
    const body = `<feed xmlns="http://www.w3.org/2005/Atom">${entry('a', '惡父不當管教遭逮!│中視新聞 20260929')}${entry('b', '🔴【LIVE直播】競辦啟用 │中視新聞 20260930')}${entry('c', '《新庶民大頭家》完整版 20260929')}</feed>`;
    const fetch = async (url: string): Promise<FetchResult> => ({ url, status: 200, body, contentType: 'application/atom+xml', ms: 1 });
    const ctv = spec('ctv');
    const { items } = await listSource(ctv, fetch);
    expect(items.map((i) => i.url)).toEqual(['https://www.youtube.com/watch?v=a']);
    expect(stripTitleSuffix(items[0].title ?? '', ctv.titleSuffix)).toBe('惡父不當管教遭逮!');
  });
});

describe('2026-10-01 audit fixes', () => {
  const feedFetch =
    (body: string) =>
    async (url: string): Promise<FetchResult> => ({ url, status: 200, body, contentType: 'application/rss+xml', ms: 1 });
  it('keeps WordPress /?p= permalinks (they are not the homepage)', async () => {
    const body = `<rss><channel><item><title>新國會文章標題</title><link>https://newcongress.tw/?p=38094</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`;
    const { items } = await listSource(spec('newcongress'), feedFetch(body));
    expect(items.map((i) => i.url)).toEqual(['https://newcongress.tw/?p=38094']);
  });
  it('reads a lowercase, zone-less <pubdate> as Taiwan time', () => {
    const f = parseFeed(
      '<rss><channel><item><title>t</title><link>https://www.top1health.com/Article/320/98591</link><pubdate>2026-09-23T11:31:00</pubdate></item></channel></rss>',
    );
    expect(f.items[0].publishedAt?.toISOString()).toBe('2026-09-23T03:31:00.000Z');
  });
  it('takes the first embedded tags array (twreporter) and strips # from selector tags (GNN)', () => {
    const tw = `<script>{"entities":{"posts":{"a":{"slug":"a","tags":[{"id":"1","name":"醫療"},{"id":"2","name":"書評"}]},"b":{"slug":"b","tags":[{"name":"無關"}]}}}}</script>`;
    expect(extractArticle(tw, 'https://www.twreporter.org/a/a', spec('reporter').article).tags).toEqual(['醫療', '書評']);
    const gnn =
      '<a href="https://gnn.gamer.com.tw/search_tag.php?q=x">#大逃殺</a><a href="https://gnn.gamer.com.tw/search_tag.php?q=y">#試玩</a>';
    expect(extractArticle(gnn, 'https://gnn.gamer.com.tw/detail.php?sn=1', spec('gamer').article).tags).toEqual(['大逃殺', '試玩']);
  });
  it('collapses LTN section variants of one story', () => {
    const id = spec('ltn').list.articleId;
    expect(urlKey('https://news.ltn.com.tw/news/life/breakingnews/5590597', id)).toBe(
      urlKey('https://news.ltn.com.tw/news/Taipei/breakingnews/5590597', id),
    );
    expect(urlKey('https://news.ltn.com.tw/news/life/breakingnews/5590597', id)).not.toBe(
      urlKey('https://news.ltn.com.tw/news/life/paper/5590597', id),
    );
  });
});
