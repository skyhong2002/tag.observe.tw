import { describe, expect, it } from 'vitest';
import {
  childSelectorFor,
  cleanTopicHref,
  extractTopics,
  fetchTopicListings,
  ldTopics,
  listingBase,
  nuxtTopics,
  TOPIC_RULES,
  type TopicItem,
  topicChildren,
  topicListings,
} from './topics.ts';

describe('extractTopics', () => {
  const base = { media: 'x', fallbackImage: '', url: 'https://example.com/topic/', pattern: /\/topic\/\d+/ };

  it('drops tracking parameters and dedupes on the clean URL', () => {
    const html = '<a href="/topic/1?utm_source=a">選舉</a><a href="/topic/1">選舉</a><a href="/topic/2?id=3#x">亞運</a>';
    expect(extractTopics(html, base).map((t) => t.url)).toEqual(['https://example.com/topic/1', 'https://example.com/topic/2?id=3']);
  });

  it('limits links to the scope and takes the cover image selector', () => {
    const html = `<nav><a href="/topic/9">論壇</a></nav>
      <div class="list"><a href="/topic/5"><img src="/mask.png"><img class="cover" data-src="/c.jpg"><h2>川習會</h2></a></div>`;
    const [t, ...rest] = extractTopics(html, { ...base, scope: '.list', image: 'img.cover' });
    expect(rest).toEqual([]);
    expect(t).toMatchObject({ url: 'https://example.com/topic/5', image: 'https://example.com/c.jpg' });
  });

  it('ignores placeholder images', () => {
    const [t] = extractTopics('<a href="/topic/1"><img src="/images-next/loading.gif">亞運捷報</a>', base);
    expect(t.image).toBeNull();
  });

  it('joins a separate image link and heading link through the card selector', () => {
    // PTS curation: the cover anchor has no text, the <h3> anchor has no image.
    const html = `<div class="card"><div class="col-5"><a href="/topic/134"><img src="/og.jpg" alt=""></a></div>
      <div class="col-7"><time>2025/2/20</time><h3><a href="/topic/134">川普新政撼動全球經濟</a></h3></div></div>`;
    expect(extractTopics(html, { ...base, card: '.card' })).toEqual([
      { url: 'https://example.com/topic/134', title: '川普新政撼動全球經濟', image: 'https://example.com/og.jpg', category: null },
    ]);
  });

  it("keeps the topic link's own text over a 'more' link's guessed heading", () => {
    const html = `<ul><li><a href="/topic/7">新北少女遭虐</a></li></ul>
      <div class="block"><h3 class="title">三重父逼女兒掛看板遊街</h3><a href="/topic/7">更多</a></div>`;
    expect(extractTopics(html, base).map((t) => t.title)).toEqual(['新北少女遭虐']);
  });
});

describe('embedded topic data', () => {
  it('reads topics from a Nuxt payload', () => {
    const payload = [
      { data: 1 },
      [2, 6],
      { id: 3, title: 4, link: 5, thumbImageUrl: 8 },
      'uuid',
      '選後新政局',
      '/topic/12',
      { id: 7, title: 9, link: 10, imageUrl: 8 },
      'a1',
      'https://img.example.com/c.webp',
      '藍委籲普發石油津貼',
      '/cts/general/1.html',
    ];
    const html = `<a href="/topic/12">nav</a><script type="application/json" id="__NUXT_DATA__">${JSON.stringify(payload)}</script>`;
    expect(nuxtTopics(html, { media: 'x', fallbackImage: '', url: 'https://example.com/topic/', pattern: /\/topic\/\d+/ })).toEqual([
      { url: 'https://example.com/topic/12', title: '選後新政局', image: 'https://img.example.com/c.webp', category: null },
    ]);
  });

  it('takes names from a JSON-LD ItemList and covers from the page', () => {
    const ld = { '@type': 'ItemList', itemListElement: [{ url: 'https://example.com/hotTopic/1', name: '國旅補助' }] };
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script>
      <div><a href="/hotTopic/1">國旅</a><a href="/hotTopic/1"><img src="/1.jpg"></a><a href="/hotTopic/1">→ 閱讀完整議題</a>
      <a href="/hotTopic/1#topic-link-5">2026-09-30 17:17 某篇新聞</a></div>`;
    expect(ldTopics(html, { media: 'x', fallbackImage: '', url: 'https://example.com/hotTopic', pattern: /\/hotTopic\/\d+$/ })).toEqual([
      { url: 'https://example.com/hotTopic/1', title: '國旅補助', image: 'https://example.com/1.jpg', category: null },
    ]);
  });
});

describe('official topic indexes', () => {
  it('reads CNA digital features from the same public data used by its index', async () => {
    const { cnaDigitalTopics, TOPIC_RULES } = await import('./topics.ts');
    const rule = TOPIC_RULES.find((r) => r.media === 'cna')!;
    const listing = { ...rule, ...rule.listings![0] };
    const data = {
      NewsItems: [
        { PageUrl: 'https://www.cna.com.tw/project/bridge/', HeadLine: '橋梁專題', Source: '/cover.jpg', IsAd: 'N' },
        { PageUrl: 'https://project.cna.com.tw/cards/oscars/', HeadLine: '奧斯卡看點', IsAd: 'N' },
        { PageUrl: 'https://www.cna.com.tw/project/ad/', HeadLine: '廣告', IsAd: 'Y' },
        { PageUrl: 'https://other.example/project/x/', HeadLine: '非原站' },
        { PageUrl: 'https://www.cna.com.tw/news/aipl/1.aspx', HeadLine: '一般新聞' },
      ],
    };
    expect(cnaDigitalTopics(JSON.stringify(data), listing).map((t) => t.title)).toEqual(['橋梁專題', '奧斯卡看點']);
  });

  it('handles sibling headings, lazy covers, and ETtoday index versus detail links', async () => {
    const { TOPIC_RULES } = await import('./topics.ts');
    const rule = (id: string) => TOPIC_RULES.find((r) => r.media === id)!;
    expect(
      extractTopics(
        '<div><img src="/cover.jpg"><h2>AI人才專題</h2><a href="https://www.bnext.com.tw/topic/view/996"></a></div>',
        rule('bnext'),
      )[0],
    ).toMatchObject({ title: 'AI人才專題', image: 'https://www.bnext.com.tw/cover.jpg' });
    expect(
      extractTopics(
        '<div class="part_pictxt_2"><a href="/feature/index/4">特別報導</a><a href="/feature/金曲獎37">2026金曲獎</a><a href="/news/1.htm">一般新聞</a></div>',
        rule('ettoday'),
      ).map((t) => t.title),
    ).toEqual(['2026金曲獎']);
    expect(
      extractTopics(
        '<ul class="info-cards"><li><a href="/topic/2367"><p class="info-cards_title">友善職場</p><p>一大段介紹文字</p><img src="data:placeholder" data-src="/cover.jpg"></a></li></ul>',
        rule('gvm'),
      )[0],
    ).toMatchObject({ title: '友善職場', image: 'https://www.gvm.com.tw/cover.jpg' });
    expect(extractTopics('<a href="https://other.example/topic/view/1">外站連結</a>', rule('bnext'))).toEqual([]);
  });

  it('uses NOWnews topic cards without mistaking related news or category links for topic pages', async () => {
    const { nownewsTopics, TOPIC_RULES } = await import('./topics.ts');
    const rule = TOPIC_RULES.find((r) => r.media === 'nownews')!;
    const html =
      '<div class="list-item"><h3 class="topic-title">心理假</h3><img src="/cover.jpg"><a href="/stress/" data-sec="topics" data-tracetype="brand">專頁</a><a href="/cat/life/" data-sec="topics" data-tracetype="category">新聞</a></div><a href="/news/123">文章</a>';
    expect(nownewsTopics(html, rule)).toEqual([
      { url: 'https://www.nownews.com/stress/', title: '心理假', image: 'https://www.nownews.com/cover.jpg', category: null },
    ]);
  });

  it('keeps successful indexes when another fails, and reports zero matches as a failure', async () => {
    const { fetchTopicListings } = await import('./topics.ts');
    const rule = {
      media: 'x',
      fallbackImage: '',
      url: 'https://example.com/first',
      pattern: /\/topic\/\d+/,
      listings: [
        { url: 'https://example.com/second', pattern: /\/topic\/\d+/ },
        { url: 'https://example.com/empty', pattern: /\/topic\/\d+/ },
      ],
    };
    const result = await fetchTopicListings(rule, async (url) => ({
      url,
      status: url.endsWith('second') ? 503 : 200,
      body: url.endsWith('first') ? '<a href="/topic/1">最新專題</a>' : '<html></html>',
      contentType: 'text/html',
      ms: 0,
    }));
    expect(result.items).toHaveLength(1);
    expect(result.sources.map((s) => s.error)).toEqual([undefined, 'HTTP 503', 'no topic links matched']);
  });

  it('combines independent official indexes and deduplicates tracking links', async () => {
    const { fetchTopicListings } = await import('./topics.ts');
    const rule = {
      media: 'x',
      fallbackImage: '',
      url: 'https://example.com/first',
      pattern: /\/topic\/\d+/,
      scope: '.first',
      listings: [{ url: 'https://example.com/second', pattern: /\/topic\/\d+/ }],
    };
    const result = await fetchTopicListings(rule, async (url) => ({
      url,
      status: 200,
      body: url.endsWith('first')
        ? '<div class="first"><a href="/topic/1?utm_source=x">同一專題</a></div>'
        : '<a href="/topic/1">同一專題</a><a href="/topic/2">數位專題</a>',
      contentType: 'text/html',
      ms: 0,
    }));
    expect(result.items.map((t) => t.title)).toEqual(['同一專題', '數位專題']);
    expect(result.sources.every((s) => !s.error)).toBe(true);
  });
});

describe('topic kinds, pagination and sub-topics', () => {
  const response = (url: string, body: string, status = 200) => ({ url, body, status, contentType: 'text/html', ms: 1 });
  const base = { media: 'x', fallbackImage: '', url: 'https://example.com/topics', pattern: /^\/topic\/\d+$/ };

  it('cleans hrefs: trims, skips inner whitespace, drops tracking before matching', () => {
    expect(cleanTopicHref('  /topic/1  ')).toBe('/topic/1');
    expect(cleanTopicHref('/topic/{{ id }}')).toBeNull();
    expect(cleanTopicHref('/topic/1?ctrack=home&utm_source=x')).toBe('/topic/1');
    expect(cleanTopicHref('/topic/1?id=2&ctrack=a#x')).toBe('/topic/1?id=2#x');
    const html = '<a href=" /topic/1?ctrack=h ">選舉</a><a href="/topic/ 2">壞連結</a><a href="/topic/3#topic-link-1">文章</a>';
    expect(extractTopics(html, base).map((t) => t.url)).toEqual(['https://example.com/topic/1']);
  });

  it('pages until a page brings nothing new, tolerating later page errors', async () => {
    const pages: Record<string, string> = {
      'https://example.com/topics': '<a href="/topic/1">議題一</a><a href="/topic/2">議題二</a>',
      'https://example.com/topics?page=2': '<a href="/topic/3">議題三</a>',
      'https://example.com/topics?page=3': '<a href="/topic/3">議題三</a>',
    };
    const fetched: string[] = [];
    const rule = { ...base, paginate: { url: (n: number) => `${base.url}?page=${n}`, max: 10 } };
    const result = await fetchTopicListings(rule, async (url) => {
      fetched.push(url);
      return response(url, pages[url] ?? '');
    });
    expect(fetched).toEqual(Object.keys(pages));
    expect(result.items.map((t) => [t.url.slice(-1), t.page, t.source])).toEqual([
      ['1', 1, base.url],
      ['2', 1, base.url],
      ['3', 2, base.url],
    ]);
    expect(result.sources).toEqual([{ url: base.url, kind: 'auto', items: 3, pages: 2 }]);

    const failing = await fetchTopicListings(rule, async (url) => {
      if (url !== base.url) throw Error('timeout');
      return response(url, pages[url]);
    });
    expect(failing.items).toHaveLength(2);
    expect(failing.sources[0].error).toBeUndefined();
  });

  it('sends the page request (POST) for every page, the first included', async () => {
    const bodies: unknown[] = [];
    const rule = {
      ...base,
      paginate: {
        url: () => base.url,
        max: 2,
        request: (n: number) => ({ method: 'POST' as const, body: JSON.stringify({ page: n }) }),
      },
    };
    await fetchTopicListings(rule, async (url, opts) => {
      bodies.push(opts?.body);
      return response(url, `<a href="/topic/${bodies.length}">議題${bodies.length}</a>`);
    });
    expect(bodies).toEqual(['{"page":1}', '{"page":2}']);
  });

  it('applies declared kinds per listing and flags sponsored items', async () => {
    const rule = {
      ...base,
      kind: 'topic' as const,
      listings: [
        {
          url: 'https://example.com/features',
          pattern: /^\/topic\/\d+$/,
          kind: 'feature' as const,
          sponsored: (item: TopicItem) => item.title.includes('合作'),
        },
        { url: 'https://example.com/more', pattern: /^\/topic\/\d+$/ },
      ],
    };
    const result = await fetchTopicListings(rule, async (url) =>
      response(
        url,
        url === base.url
          ? '<a href="/topic/1">議題一</a>'
          : url.endsWith('features')
            ? '<a href="/topic/2">品牌合作專題</a><a href="/topic/3">深度專題</a>'
            : '<a href="/topic/4">未宣告</a>',
      ),
    );
    expect(result.items.map((t) => [t.title, t.kind, t.sponsored])).toEqual([
      ['議題一', 'topic', undefined],
      ['品牌合作專題', 'feature', true],
      ['深度專題', 'feature', false],
      ['未宣告', undefined, undefined],
    ]);
    expect(result.sources.map((s) => s.kind)).toEqual(['topic', 'feature', 'auto']);
  });

  it('declares CNA digital features (ads as sponsored) and PTS curation as features', () => {
    const cna = topicListings(TOPIC_RULES.find((r) => r.media === 'cna')!)[1];
    expect(cna.kind).toBe('feature');
    expect(cna.sponsored?.({ url: '', title: '', image: null, category: '廣告' })).toBe(true);
    const pts = topicListings(TOPIC_RULES.find((r) => r.media === 'pts')!);
    expect(pts.map((l) => [l.url, l.kind])).toEqual([
      ['https://news.pts.org.tw/hotTopic', 'topic'],
      ['https://news.pts.org.tw/curation', 'feature'],
      ['https://newslab.pts.org.tw/topic', 'feature'],
    ]);
  });

  it('reads sub-topic links from a topic page', () => {
    const html = `<div class="definKind"><h2><a href="/topic/newstopic/5101.aspx">子議題一</a></h2>
      <h2><a href=" /topic/newstopic/5102.aspx?utm_source=x ">子議題二</a></h2>
      <h2><a href="/topic/newstopic/5056.aspx">本頁</a></h2><h2><a href="https://other.com/x">外站</a></h2></div>`;
    expect(topicChildren(html, 'https://www.cna.com.tw/topic/newstopic/5056.aspx', '.definKind h2 a')).toEqual([
      { url: 'https://www.cna.com.tw/topic/newstopic/5101.aspx', title: '子議題一' },
      { url: 'https://www.cna.com.tw/topic/newstopic/5102.aspx', title: '子議題二' },
    ]);
    const rules = [{ ...base, listings: [{ url: 'https://example.com/a', pattern: /\/topic\/newstopic\/\d+/, children: '.kids a' }] }];
    expect(childSelectorFor('x', 'https://example.com/topic/newstopic/5', rules)).toBe('.kids a');
    expect(childSelectorFor('x', 'https://example.com/topic/9', rules)).toBeUndefined();
  });
});

describe('listingBase', () => {
  it('resolves links against the listing, not the mobile host it was redirected to', () => {
    const page = 'https://news.pchome.com.tw/features/';
    expect(listingBase('https://news.m.pchome.com.tw/features/', page)).toBe(page);
    expect(listingBase('https://m.example.com/topic/', 'https://example.com/topic/')).toBe('https://example.com/topic/');
    expect(listingBase('https://www.example.com/topics/', 'https://example.com/topic/')).toBe('https://www.example.com/topics/');
    expect(listingBase(undefined, page)).toBe(page);
  });
});
