import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { parseFeed } from './feed.ts';
import { parseMarkerList } from './html-list.ts';
import { between, decodeEntities, normalizeTag } from './text.ts';

describe('parseFeed', () => {
  it('keeps explicit full RSS content separate from the summary', () => {
    const parsed = parseFeed(
      '<rss><channel><item><link>https://news.example/a</link><description>摘要</description><content:encoded><![CDATA[<p>完整內容</p>]]></content:encoded></item><item><link>https://news.example/b</link><description>只有摘要</description></item></channel></rss>',
    );
    expect(parsed.items[0]).toMatchObject({ description: '摘要', contentHtml: '<p>完整內容</p>' });
    expect(parsed.items[1].contentHtml).toBeUndefined();
    expect(parsed.items[0].verifiedContent).toBeUndefined();
  });
  it('parses RSS with categories, media image and CDATA', () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[標題 &amp; A]]></title><link>https://x.tw/a?x=1</link><pubDate>Mon, 28 Sep 2026 08:00:00 +0800</pubDate><category>政治</category><category>選舉,台北</category><media:content url="https://x.tw/a.jpg"/><dc:creator>記者</dc:creator><description><![CDATA[<p>摘要</p>]]></description></item></channel></rss>`;
    const { kind, items } = parseFeed(xml);
    expect(kind).toBe('rss');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      url: 'https://x.tw/a?x=1',
      title: '標題 & A',
      category: '政治',
      image: 'https://x.tw/a.jpg',
      tags: ['政治', '選舉', '台北'],
      creator: '記者',
      description: '摘要',
    });
    expect(items[0].publishedAt?.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });
  it('parses news sitemaps and atom', () => {
    const sm = `<urlset xmlns:news="x"><url><loc>https://n.tw/1</loc><news:news><news:publication_date>2026-09-28T09:00:00+08:00</news:publication_date><news:title>T1</news:title><news:keywords>aa,bb</news:keywords></news:news></url></urlset>`;
    expect(parseFeed(sm)).toMatchObject({ kind: 'sitemap', items: [{ url: 'https://n.tw/1', title: 'T1', tags: ['aa', 'bb'] }] });
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>E</title><link rel="alternate" href="https://a.tw/e"/><published>2026-09-28T01:00:00Z</published><category term="科技"/></entry></feed>`;
    expect(parseFeed(atom)).toMatchObject({ kind: 'atom', items: [{ url: 'https://a.tw/e', title: 'E', tags: ['科技'] }] });
    expect(parseFeed('<html></html>').items).toEqual([]);
  });
});

describe('extractArticle', () => {
  const html = (head: string) =>
    `<html><head>${head}<link rel="canonical" href="/n/1"><meta property="og:image" content="//img.tw/p.jpg"><meta name="description" content="D"></head><body></body></html>`;
  it('prefers news_keywords, then keywords, then ld+json, then markers', () => {
    expect(
      extractArticle(html('<meta name="news_keywords" content="AA, BB,BB"><meta name="keywords" content="CC">'), 'https://s.tw/x'),
    ).toMatchObject({
      tags: ['AA', 'BB'],
      keywordSource: 'news_keywords',
      image: 'https://img.tw/p.jpg',
      canonical: 'https://s.tw/n/1',
      description: 'D',
    });
    expect(extractArticle(html('<meta name="keywords" content="甲、乙"></meta>'), 'https://s.tw/x').tags).toEqual(['甲', '乙']);
    expect(
      extractArticle(html('<script type="application/ld+json">{"@type":"NewsArticle","keywords":["丙","丁"]}</script>'), 'https://s.tw/x'),
    ).toMatchObject({ tags: ['丙', '丁'], keywordSource: 'ld+json' });
    const d = extractArticle(html('') + '<div class="tags">[戊]<a>己</a></div>', 'https://s.tw/x', {
      keywordMarkers: [{ start: '<div class="tags">', end: '</div>' }],
    });
    expect(d.tags).toEqual(['戊', '己']);
  });
  it('splits comma-separated keywords inside Videoland JSON-LD arrays', () => {
    const detail = extractArticle(
      html(
        '<meta http-equiv="keywords" content="緯來新聞網,張齡予,天鵝童鞋"><script type="application/ld+json">{"@type":"NewsArticle","keywords":[",緯來新聞網,張齡予,天鵝童鞋", "張齡予，公益", "Swan 天鵝童鞋"]}</script>',
      ),
      'https://news.videoland.com.tw/article/example.html',
    );
    expect(detail.tags).toEqual(['緯來新聞網', '張齡予', '天鵝童鞋', '公益', 'Swan 天鵝童鞋']);
    expect(detail.keywordSource).toBe('ld+json');
  });
  it('rejects prose disguised as keywords and falls back to the next candidate', () => {
    const d = extractArticle(
      html(
        '<meta name="news_keywords" content="偉大城市從守住城市的綠開始！最近很多人po出住家附近的樹被砍的畫面，有人說"><meta name="keywords" content="砍樹,老樹">',
      ),
      'https://s.tw/x',
    );
    expect(d.tags).toEqual(['砍樹', '老樹']);
    expect(d.keywordSource).toBe('keywords');
  });
  it('drops single-byte tags like PHP strlen>1', () => {
    expect(extractArticle(html('<meta name="keywords" content="a,bb,中">'), 'https://s.tw/x').tags).toEqual(['bb', '中']);
  });
});

describe('helpers', () => {
  it('between mirrors PHP slicing and normalizes tags', () => {
    expect(between('xx<a>1</a>', '<a>', '</a>')).toBe('1');
    expect(between('xx', '<a>', '</a>')).toBe('');
    expect(decodeEntities('&amp;&#x4e2d;&nbsp;')).toBe('&中\u00a0');
    expect(normalizeTag(' [台 灣] ')).toBe('台 灣');
  });
  it('parses marker lists', () => {
    const items = parseMarkerList('<li class="n"><a href="/a/1">T1</a></li><li class="n"><a href="/a/2">T2</a></li>', 'https://m.tw/', {
      itemStart: '<li class="n">',
      itemEnd: '</li>',
      url: { start: 'href="', end: '"' },
      title: { start: '">', end: '</a>' },
    });
    expect(items.map((i) => [i.url, i.title])).toEqual([
      ['https://m.tw/a/1', 'T1'],
      ['https://m.tw/a/2', 'T2'],
    ]);
  });
});

describe('discoverLinks', () => {
  it('collects same-host anchors matching the article pattern with anchor-text titles', async () => {
    const { discoverLinks } = await import('./html-list.ts');
    const html =
      '<a href="/news/20260928700732-430704">輝達庫藏股計畫再添柴火</a><a href="https://other.tw/news/20260928700732-1">外站文章不要</a><a href="/news/20260928700733-1"><img src="/i.jpg" alt="圖片說明很長的標題"></a><a href="/tag/x">短</a>';
    const items = discoverLinks(html, 'https://www.ctee.com.tw/', /^\/news\/\d{14}-\d+$/);
    expect(items.map((i) => [i.url, i.title, i.image ?? null])).toEqual([
      ['https://www.ctee.com.tw/news/20260928700732-430704', '輝達庫藏股計畫再添柴火', null],
      ['https://www.ctee.com.tw/news/20260928700733-1', '圖片說明很長的標題', 'https://www.ctee.com.tw/i.jpg'],
    ]);
  });
});
