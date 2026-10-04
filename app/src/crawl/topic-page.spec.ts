import { describe, expect, it } from 'vitest';
import {
  articleShapes,
  isNavigationKey,
  keyShape,
  looksLikeStories,
  pickTopicStories,
  sharedTag,
  type TopicStory,
  topicPageDate,
  topicPageGroups,
  topicPageImage,
} from './topic-page.ts';

describe('topicPageGroups', () => {
  it('groups same-site links by container and drops nav, footer and other sites', () => {
    const html = `<nav><a href="/news/1">nav</a></nav>
      <div class="topic"><ul class="list"><li><a href="/news/10">a</a></li><li><a href="/news/11">b</a></li><li><a href="/news/12">c</a></li></ul></div>
      <div class="side"><ul class="latest"><li><a href="/news/20">x</a></li><li><a href="https://other.example/news/21">y</a></li></ul></div>
      <footer><a href="/about">about</a></footer>`;
    const groups = topicPageGroups(html, 'https://www.example.com.tw/topic/1');
    expect(groups[0].map((s) => s.key)).toEqual(['www.example.com.tw/news/10', 'www.example.com.tw/news/11', 'www.example.com.tw/news/12']);
    const keys = groups.flat().map((s) => s.key);
    expect(keys).not.toContain('www.example.com.tw/news/1');
    expect(keys).not.toContain('other.example/news/21');
  });
  it('keeps story links on the main host of a topic subdomain (topic.udn.com -> udn.com)', () => {
    const html = '<ul class="s"><li><a href="https://udn.com/news/story/6885/9781">教師離職潮延燒</a></li></ul>';
    expect(topicPageGroups(html, 'https://topic.udn.com/newstopic/2026edu')[0][0].key).toBe('udn.com/news/story/6885/9781');
  });
  it('takes the headline from the list item when the link wraps only a date (華視)', () => {
    const html =
      '<ul class="topic-article-grid"><li><h3>鈔錢部署／高股息ETF配息大戰</h3><a href="/cts/money/202609/202609043075126.html">2026-09-04 16:57</a></li></ul>';
    expect(topicPageGroups(html, 'https://news.cts.com.tw/topic/x')[0][0].title).toBe('鈔錢部署／高股息ETF配息大戰2026-09-04 16:57');
  });
});

describe('topicPageGroups story dates', () => {
  const now = new Date('2026-10-04T04:00:00Z'); // 12:00 in Taiwan
  const page = 'https://news.example.com.tw/topic/1';
  const dates = (html: string) =>
    Object.fromEntries(topicPageGroups(html, page, undefined, { now })[0].map((s) => [s.key.replace(/^.*\//, ''), s.date]));

  it("takes each story's date from its own item, not the page's update time", () => {
    // 自由's topic pages print the page's 更新時間 above the list; 東森's first dates are header dates.
    const html = `<div class="topic-head">更新時間 2026/10/04 11:00</div>
      <div class="list">
        <div class="box"><div class="pic"><a href="/news/1"><img></a></div><div class="txt"><h3><a href="/news/1">賴清德出訪友邦行程曝光</a></h3><span class="time">2026/09/30 18:00</span></div></div>
        <div class="box"><div class="pic"><a href="/news/2"><img></a></div><div class="txt"><h3><a href="/news/2">外交部說明出訪細節</a></h3><span class="time">2026/09/29 09:15</span></div></div>
        <div class="box"><div class="pic"><a href="/news/3"><img></a></div><div class="txt"><h3><a href="/news/3">一則沒有日期的報導</a></h3></div></div>
      </div>`;
    expect(dates(html)).toEqual({ '1': '2026-09-30T10:00:00.000Z', '2': '2026-09-29T01:15:00.000Z', '3': undefined });
  });
  it('reads <time datetime> and relative dates against now', () => {
    const html = `<ul class="l">
      <li><a href="/n/1">颱風最新動態整理</a><time datetime="2026-10-01T08:30:00+08:00">10/1</time></li>
      <li><a href="/n/2">颱風停班停課一覽</a><span>3小時前</span></li>
      <li><a href="/n/3">颱風災情持續更新</a><span>昨天</span></li></ul>`;
    expect(dates(html)).toEqual({ '1': '2026-10-01T00:30:00.000Z', '2': '2026-10-04T01:00:00.000Z', '3': '2026-10-02T16:00:00.000Z' });
  });
  it('does not take a date from a summary', () => {
    const html = `<ul class="l">
      <li><a href="/n/1">賈伯斯逝世十週年回顧</a><p>2011年10月5日，賈伯斯與世長辭。十年過後，我們再次整理賈伯斯生前的歷史與產品。</p></li>
      <li><a href="/n/2">蘋果產品設計語言的演變</a><p>2021/10/05</p></li></ul>`;
    expect(dates(html)).toEqual({ '1': undefined, '2': '2021-10-04T16:00:00.000Z' });
  });
  it('bounds items by stories, not by a label link repeated on every card (iThome 新聞)', () => {
    const card = (n: number, d: string) =>
      `<div class="card"><div class="t"><a href="/tags/news">新聞</a></div><div class="t"><a href="/news/${n}">資安新聞標題第${n}則</a></div><div class="m"><span>${d}</span></div></div>`;
    const html = `<div class="cards">${card(1, '2025-02-07')}${card(2, '2025-02-08')}${card(3, '2025-02-09')}</div>`;
    const stories = topicPageGroups(html, page, undefined, { now }).find((g) => g.some((s) => s.key.endsWith('/news/1'))) ?? [];
    expect(stories.find((s) => s.key.endsWith('/news/2'))?.date).toBe('2025-02-07T16:00:00.000Z');
  });
  it('dates stories from the JSON-LD item list', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          item: { '@type': 'NewsArticle', url: 'https://news.example.com.tw/n/1', datePublished: '2024-04-22T15:43:00+08:00' },
        },
        { '@type': 'ListItem', position: 2, url: 'https://news.example.com.tw/n/2', datePublished: '2024-04-11T13:05:00+08:00' },
      ],
    };
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script>
      <ul class="l"><li><a href="/n/1">馬習二會後各方反應</a></li><li><a href="/n/2">馬英九返台談話全文</a></li></ul>`;
    expect(dates(html)).toEqual({ '1': '2024-04-22T07:43:00.000Z', '2': '2024-04-11T05:05:00.000Z' });
  });
  it('shifts JSON-LD dates back when the page writes Taipei time as UTC', () => {
    // 鏡報: a story from 16:31 Taipei on the day of `now` is written 16:31Z.
    const t = new Date(+now - 30 * 60e3);
    const z = (d: Date) => `${new Date(+d + 8 * 3600e3).toISOString().slice(0, 19)}.000Z`;
    const earlier = new Date(+now - 26 * 3600e3);
    const ld = {
      '@type': 'ItemList',
      itemListElement: [
        { '@type': 'ListItem', item: { url: 'https://news.example.com.tw/n/1', dateCreated: z(t) } },
        { '@type': 'ListItem', item: { url: 'https://news.example.com.tw/n/2', dateCreated: z(earlier) } },
      ],
    };
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script>
      <ul class="l"><li><a href="/n/1">沈伯洋競總成立</a></li><li><a href="/n/2">蔡英文現身造勢</a></li></ul>`;
    expect(dates(html)).toEqual({ '1': t.toISOString(), '2': earlier.toISOString() });
  });
});

describe('topicPageDate', () => {
  const now = new Date('2026-10-04T04:00:00Z');
  it('dates a single-article page by its own publish time', () => {
    expect(
      topicPageDate(
        '<meta property="article:published_time" content="2025-03-01T10:00:00+08:00">',
        'https://x.example.com/a',
        now,
      )?.toISOString(),
    ).toBe('2025-03-01T02:00:00.000Z');
    const ld = { '@type': 'NewsArticle', mainEntityOfPage: 'https://x.example.com/a', datePublished: '2025-03-02' };
    expect(
      topicPageDate(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`, 'https://x.example.com/a', now)?.toISOString(),
    ).toBe('2025-03-01T16:00:00.000Z');
  });
  it("ignores other pages' articles and non-articles", () => {
    const ld = [
      { '@type': 'NewsArticle', url: 'https://x.example.com/other', datePublished: '2025-03-02' },
      { '@type': 'WebPage', datePublished: '2025-03-02' },
    ];
    expect(topicPageDate(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`, 'https://x.example.com/a', now)).toBeNull();
  });
});

describe('looksLikeStories', () => {
  it('accepts headline lists, not menus', () => {
    const s = (title: string) => ({ key: title, title });
    expect(looksLikeStories(['高股息ETF配息大戰誰勝出', '台股萬點行情的三個關鍵', '退休金怎麼存才夠用'].map(s))).toBe(true);
    expect(looksLikeStories(['首頁', '政治', '社會', '更多'].map(s))).toBe(false);
  });
});

describe('sharedTag', () => {
  const freq = (t: string) => ({ 中秋節: 400, 財運: 40, 淨零台灣: 6, 再生能源: 20, 行政院: 300, 美股: 90, 高雄: 500, 死亡: 200 })[t];
  it('takes a tag most of the stories share', () => {
    expect(sharedTag([['中秋節', '財運'], ['中秋節'], ['中秋節', '烤肉'], ['財運']], freq)).toBe('中秋節');
    expect(sharedTag([['淨零台灣', '再生能源'], ['淨零台灣']], freq)).toBe('淨零台灣');
  });
  it('returns null when the stories share nothing distinctive', () => {
    // A breaking-news sidebar mistaken for the topic list (太報), or a crime
    // topic whose stories only share places (東森 學弟刺學長).
    expect(sharedTag([['行政院'], ['美股'], ['行政院'], ['台指期'], ['通膨'], ['費半'], ['台積電'], ['大盤']], freq)).toBeNull();
    expect(sharedTag([['高雄', '死亡'], ['新北'], ['高雄'], ['中和', '死亡'], ['市場'], ['刀']], freq)).toBeNull();
  });
  it('needs half of the stories for a broad tag, and for a pair', () => {
    const f = (t: string) => ({ 台股: 736, 台積電: 426, 投資: 111, 醫師: 31, 名古屋亞運: 788 })[t];
    // 華視 鈔錢部署: 台股 in 4 of 12 stories is not the topic.
    const show = [['台股', '台積電'], ['台股'], ['台股', '投資'], ['台股'], ['台積電'], ['台積電'], ['投資'], ['投資'], [], [], [], []];
    expect(sharedTag(show, f)).toBeNull();
    expect(sharedTag([['醫師'], ['醫師'], [], [], []], f)).toBeNull();
    expect(sharedTag([['名古屋亞運'], ['名古屋亞運'], ['名古屋亞運'], []], f)).toBe('名古屋亞運');
  });
  it('ignores tags outside the vocabulary', () => {
    expect(sharedTag([['冷門詞'], ['冷門詞']], freq)).toBeNull();
  });
});

describe('topicPageImage', () => {
  it('resolves the share image against the page and unwraps css url()', () => {
    expect(topicPageImage('<meta property="og:image" content="//cdn.example.com/a.jpg">', 'https://www.example.com/topic/1')).toBe(
      'https://cdn.example.com/a.jpg',
    );
    expect(topicPageImage('<meta property="og:image" content="url(https://cdn.example.com/b.jpg">', 'https://www.example.com/')).toBe(
      'https://cdn.example.com/b.jpg',
    );
    expect(topicPageImage('<meta property="og:image" content="image/FB.jpg">', 'https://topic.example.com/book/')).toBe(
      'https://topic.example.com/book/image/FB.jpg',
    );
  });
  it('returns null without a usable image', () => {
    expect(topicPageImage('<meta property="og:image" content="data:image/png;base64,AAAA">', 'https://www.example.com/')).toBeNull();
    expect(topicPageImage('<title>x</title>', 'https://www.example.com/')).toBeNull();
  });
});

describe('isNavigationKey / keyShape', () => {
  it('tells tag, author and sponsored links from stories', () => {
    expect(isNavigationKey('www.inside.com.tw/tag/2-Apple')).toBe(true);
    expect(isNavigationKey('newtalk.tw/plan/view/1183')).toBe(true);
    expect(isNavigationKey('www.gvm.com.tw/author/317')).toBe(true);
    expect(isNavigationKey('newtalk.tw/search?q=x')).toBe(true);
    expect(isNavigationKey('newtalk.tw/news/view/2026-10-01/1063052')).toBe(false);
    expect(isNavigationKey('www.inside.com.tw/feature/member-exclusive/37094-2025-rmn-white-paper')).toBe(false);
    expect(isNavigationKey('news.ltn.com.tw#breakingnews/5594600')).toBe(false);
  });
  it('reduces a url_key to its URL pattern', () => {
    expect(keyShape('newtalk.tw/news/view/2026-10-01/1063052')).toBe('newtalk.tw/news/_/9/#');
    expect(keyShape('newtalk.tw/plan/view/1183')).toBe('newtalk.tw/plan/_/#');
    expect(keyShape('udn.com/news/story/6885/9781?from=x')).toBe('udn.com/news/_/#/#');
    expect(keyShape('news.tvbs.com.tw#4031364')).toBe('news.tvbs.com.tw#');
    const keys = Array.from({ length: 50 }, (_, i) => `newtalk.tw/news/view/2026-09-${10 + (i % 20)}/${1060000 + i}`);
    expect([...articleShapes([...keys, 'newtalk.tw/video/1'])]).toEqual(['newtalk.tw/news/_/9/#']);
  });
});

describe('pickTopicStories', () => {
  const story = (key: string, date?: string): TopicStory => ({ key, title: `一則關於${key}的新聞標題`, ...(date ? { date } : {}) });
  const none = { furniture: () => false, crawled: () => false };

  it('drops sponsored links mixed into the story list (newtalk /plan/view)', () => {
    const news = [1, 2, 3, 4].map((i) => story(`newtalk.tw/news/view/2026-10-0${i}/10630${i}`, `2026-10-0${i}T00:00:00Z`));
    const plan = [1181, 1182, 1183].map((i) => story(`newtalk.tw/plan/view/${i}`));
    const picked = pickTopicStories([[...plan, ...news], news], { ...none, crawled: (k) => k.includes('/news/') });
    expect(picked.map((s) => s.key)).toEqual(news.map((s) => s.key));
  });
  it("prefers the feature's articles to its cards' tag links (inside)", () => {
    const card = (i: number) =>
      `<article class="card"><h3 class="t"><a href="/feature/ai-war/3500${i}-chip">AI 晶片戰爭第${i}篇深度報導分析</a></h3><time datetime="2026-0${i}-01">x</time><ul class="tags">${[
        'NPU',
        'TPU',
        'LPU',
        'AI',
      ]
        .map((t, j) => `<li class="tag"><a href="/tag/${i}${j}-${t}">NPU 、 TPU 、 LPU 、 人工智慧</a></li>`)
        .join('')}</ul></article>`;
    const html = `<main><h1><a href="/feature/ai-war">AI 決勝 新晶片戰爭</a></h1><div class="list">${[1, 2, 3].map(card).join('')}</div></main>`;
    const groups = topicPageGroups(html, 'https://www.inside.com.tw/feature/ai-war');
    expect(groups[0][0].key).toContain('/tag/'); // the largest headline-like group, picked before
    expect(groups.flat().map((s) => s.key)).not.toContain('www.inside.com.tw/feature/ai-war'); // the page's own link
    const picked = pickTopicStories(groups, none);
    expect(picked.map((s) => s.key)).toEqual([1, 2, 3].map((i) => `www.inside.com.tw/feature/ai-war/3500${i}-chip`));
    expect(picked.every((s) => s.date)).toBe(true);
  });
  it('skips a block stored as stories of two other topics, even with more crawled stories', () => {
    const own = ['a/1', 'a/2', 'a/3'].map((k) => story(`x.tw/${k}`));
    const side = ['a/7', 'a/8', 'a/9', 'a/10'].map((k) => story(`x.tw/${k}`));
    const stored = new Map([...side.map((s) => [s.key, 2] as const), [own[0].key, 1]]);
    const picked = pickTopicStories([side, own], { furniture: (k) => (stored.get(k) ?? 0) >= 2, crawled: () => true });
    expect(picked).toEqual(own);
  });
  it('breaks a tie in crawled stories by on-page dates, then by article-shaped links', () => {
    const undated = ['n/1', 'n/2', 'n/3', 'n/4'].map((k) => story(`x.tw/${k}`));
    const dated = ['n/5', 'n/6', 'n/7'].map((k) => story(`x.tw/${k}`, '2026-10-01T00:00:00Z'));
    const crawled = (k: string) => /n\/[1256]$/.test(k);
    expect(pickTopicStories([undated, dated], { ...none, crawled })).toEqual(dated);
    const pages = ['p/a1', 'p/a2', 'p/a3', 'p/a4'].map((k) => story(`x.tw/${k}`));
    const news = ['news/11', 'news/12', 'news/13'].map((k) => story(`x.tw/${k}`));
    const shapes = new Set(['x.tw/news/#']);
    expect(pickTopicStories([pages, news], { ...none, crawled: (k) => !k.endsWith('a4'), shapes })).toEqual(news);
    // Without crawled stories: article-shaped headlines over a larger list.
    expect(pickTopicStories([pages, news], { ...none, shapes })).toEqual(news);
    expect(pickTopicStories([pages, news], none)).toEqual(pages);
  });
  it('keeps a two-story list whose cards carry a tag link (iThome)', () => {
    const list = [story('www.ithome.com.tw/news/167237'), story('www.ithome.com.tw/tags/新聞'), story('www.ithome.com.tw/news/167238')];
    expect(pickTopicStories([list], none).map((s) => s.key)).toEqual(['www.ithome.com.tw/news/167237', 'www.ithome.com.tw/news/167238']);
  });
  it('skips groups of short labels and returns nothing without a story list', () => {
    const labels = ['政治', '社會', '國際', '財經'].map((t, i) => ({ key: `x.tw/s/${i}`, title: t }));
    expect(pickTopicStories([labels], { ...none, crawled: () => true })).toEqual([]);
  });
});
