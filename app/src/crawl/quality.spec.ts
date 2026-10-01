import { describe, expect, it } from 'vitest';
import { extractArticle, parsePublished, providerName } from './article.ts';
import { parseFeed } from './feed.ts';
import type { FetchResult } from './fetch.ts';
import { listSource } from './pipeline.ts';
import { allSources } from './registry.ts';
import type { SourceSpec } from './sources.ts';
import { stripTitleSuffix, urlKey } from './text.ts';

const spec = (media: string) => allSources().find((s) => s.media === media) as SourceSpec;

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
    ['hbr', 'AI省下人力！別把核心能力一起省掉 | 哈佛商業評論全球繁體中文版', 'AI省下人力！別把核心能力一起省掉'],
    ['ngm', '居住環境可能和你罹患失智症的風險有關？ - 國家地理雜誌中文網', '居住環境可能和你罹患失智症的風險有關？'],
  ])('%s', (media, title, expected) => {
    expect(stripTitleSuffix(title, spec(media).titleSuffix)).toBe(expected);
  });
  it('leaves titles without the suffix alone', () => {
    expect(stripTitleSuffix('LIVE - 內湖洋流來襲', spec('nownews').titleSuffix)).toBe('LIVE - 內湖洋流來襲');
  });
});

describe('listing include filter', () => {
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
