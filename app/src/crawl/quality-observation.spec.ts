import { describe, expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';
import { sourceByMedia } from './registry.ts';
import { stripTitleSuffix } from './text.ts';

const prose = 'This is the full factual report, with context and evidence from the original publisher. '.repeat(5);

describe('2026-10-07 live quality samples', () => {
  it('uses AFP report publication and desk credit, not the nested claim date/author', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'ClaimReview', itemReviewed: { '@type': 'Claim', datePublished: '2026-09-30', author: { name: 'Multiple Sources' } }, datePublished: '2026-10-07 11:30' })}</script>
      <article><div class="sub-header"><h1>AI image misrepresented as Myanmar repatriation</h1><span class="person-link"><a>AFP Thailand</a></span>
      <li class="date-full-format" data-type="created" data-utc-time="1791365448">Published on October 7, 2026 at 11:30</li></div>
      <div class="wrapper-body"><p>${prose}</p></div></article><aside><span class="person-link">Unrelated author</span></aside>`;
    const detail = extractArticle(html, 'https://factcheck.afp.com/doc.afp.com.D28L6T4');
    expect(detail.publishedAt?.toISOString()).toBe('2026-10-07T09:30:48.000Z');
    expect(detail.authors).toEqual(['AFP Thailand']);
  });
  it('keeps NTD reporting names separate from the syndicated provider', () => {
    const html = `<meta property="og:article:author" content="新唐人電視台"><article itemprop="articleBody"><p>${prose}</p><p>新唐人電視台記者安琪、臣倩綜合報導</p></article>`;
    const detail = extractArticle(html, 'https://tw.aboluowang.com/2026/1007/2442777.html');
    expect(detail.authors).toEqual(['安琪', '臣倩']);
    expect(detail.provider).toBe('新唐人電視台');
    expect(extractAttributions(detail.body ?? '', 'aboluowang', detail.provider).map((c) => c.media)).toEqual(['ntdtv']);
  });
  it('does not turn an NTD reporter mentioned inside prose into the author', () => {
    const detail = extractArticle(
      `<article><p>${prose}</p><p>受訪者感謝新唐人電視台記者安琪、臣倩綜合報導</p></article>`,
      'https://example.org/news',
    );
    expect(detail.authors).toEqual([]);
  });
});

describe('other observed main-article credits and UI', () => {
  it('reads both public Mirror Daily story segments without mistaking footer subscriptions for an access block', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', author: { '@type': 'Person', name: '呂健豪' }, datePublished: '2026-10-07T12:06:00+08:00' })}</script>
      <main><div><section><h1>新聞標題</h1><p>封面圖說</p></section><article class="brief story-renderer"><div>摘要開頭。${prose}</div></article>
      <div><article class="content story-renderer"><div>新聞第一段。</div><div>新聞最後一段。</div></article></div>
      <div>分享與訂閱</div><section><p>延伸閱讀的其他新聞。</p></section></div></main><footer>訂閱電子報 閱讀更多</footer>`;
    const detail = extractArticle(html, 'https://www.mirrordaily.news/story/90137');
    expect(detail.bodyStatus).toBe('ok');
    expect(detail.body).toContain('摘要開頭。');
    expect(detail.body).toContain('新聞第一段。');
    expect(detail.body).toContain('新聞最後一段。');
    expect(detail.body).not.toMatch(/封面圖說|分享|延伸閱讀|訂閱/);
    expect(detail.authors).toEqual(['呂健豪']);
    expect(detail.publishedAt?.toISOString()).toBe('2026-10-07T04:06:00.000Z');
  });
  it('separates UDN syndicated byline provider from the reporter with a diagonal slash', () => {
    const html = `<section class="authors"><span class="article-content__author">台灣醒報／ 記者呂翔禾╱台北報導</span></section><div class="article-content__editor"><p>${prose}</p></div>`;
    const detail = extractArticle(html, 'https://udn.com/news/story/7240/9800910');
    expect(detail.authors).toEqual(['呂翔禾']);
    expect(detail.provider).toBe('台灣醒報');
    expect(extractAttributions(detail.body ?? '', 'udn', detail.provider).map((item) => item.media)).toContain('anntw');
    const own = extractArticle(html.replace('台灣醒報／', '聯合報／'), 'https://udn.com/news/story/7240/9800910');
    expect(own.authors).toEqual(['呂翔禾']);
    expect(own.provider).toBeNull();
  });
  it('keeps Awakening article prose apart from its donation footer, logo and cover caption', () => {
    const html = `<meta property="og:title" content="原始新聞標題 - 台灣醒報 Awakening News Networks"><header><h1>台灣醒報</h1></header>
      <div class="article-header"><h3>原始新聞標題</h3></div><article><div class="markdown-body"><div class="cover"><div class="description">攝影圖說</div></div>
      <p>【台灣醒報記者呂翔禾台北報導】${prose}</p><p>報導最後一段。</p></div><div class="support-message"><p>捐款成為醒報天使，我們會寄給您抵稅收據！</p></div></article>`;
    const detail = extractArticle(html, 'https://www.anntw.com/articles/20261007-ZbPj');
    expect(detail.title).toBe('原始新聞標題');
    expect(detail.authors).toEqual(['呂翔禾']);
    expect(detail.body).toContain(prose.trim());
    expect(detail.body).toContain('報導最後一段。');
    expect(detail.body).not.toMatch(/攝影圖說|抵稅收據|醒報天使/);
    expect(stripTitleSuffix('原始新聞標題 - 台灣醒報 Awakening News Networks', sourceByMedia('anntw')?.titleSuffix)).toBe('原始新聞標題');
  });
  it('reads the Focus Taiwan closing byline without its end-item/editor code', () => {
    const html = `<meta name="author" content="Focus Taiwan - CNA English News"><div class="PrimarySide"><div class="paragraph"><p>${prose}</p></div><div class="author"><p>(By Wang Cheng-chung and Matthew Mazzetta)</p><p>Enditem/AW</p></div></div>`;
    expect(extractArticle(html, 'https://focustaiwan.tw/politics/202610070020').authors).toEqual(['Wang Cheng-chung', 'Matthew Mazzetta']);
  });
  it('uses the explicit syndicated reporter instead of the WordPress account', () => {
    const html = `<meta name="author" content="高雄港區新聞網"><div class="elementor-widget-theme-post-content"><p><a href="https://more-news.tw/">墨新聞</a>｜記者張游舜／台北報導</p><p>${prose}</p></div>`;
    const detail = extractArticle(html, 'https://www.fclnews.com/230400/');
    expect(detail.authors).toEqual(['張游舜']);
    expect(detail.provider).toBe('墨新聞');
    expect(extractAttributions(detail.body ?? '', 'fclnews', detail.provider).map((c) => c.name)).toContain('墨新聞');
  });
  it('reads the separate FCLNews syndicated reporter after the desk and photo, within the opening paragraphs', () => {
    const credit = '<p class="p1"><span>記者李婉如／綜合報導</span></p>';
    const opening = '<p><a href="https://more-news.tw/">墨新聞</a>｜新聞策劃編輯部</p><p><img src="photo.jpg"></p>';
    const wrap = (content: string) =>
      `<meta name="author" content="墨新聞"><div class="elementor-widget-theme-post-content"><div class="elementor-widget-container"><div>${content}</div></div></div>`;
    expect(extractArticle(wrap(opening + credit + `<p>${prose}</p>`), 'https://www.fclnews.com/230505/').authors).toEqual(['李婉如']);
    expect(extractArticle(wrap(opening + `<p>${prose}</p><p>其他正文。</p>` + credit), 'https://www.fclnews.com/230505/').authors).toEqual([
      '墨新聞',
    ]);
    expect(
      extractArticle(wrap(opening + `<p>${prose}</p>`) + `<aside>${credit}</aside>`, 'https://www.fclnews.com/230505/').authors,
    ).toEqual(['墨新聞']);
  });
  it('removes BBC embed-consent text without losing the article paragraphs', () => {
    const html = `<main><p>${prose}</p><div data-testid="consentBanner"><p>此文包含Google YouTube提供的内容，曲奇政策和隱私政策。</p></div><p id="end-of-youtube-content">結尾 YouTube 帖子</p><p>本文原以英文撰寫。</p></main>`;
    const detail = extractArticle(html, 'https://www.bbc.com/zhongwen/articles/c8wy910lv7q6o/trad?at_medium=RSS');
    expect(detail.body).toContain(prose.trim());
    expect(detail.body).toContain('本文原以英文撰寫。');
    expect(detail.body).not.toMatch(/曲奇|結尾 YouTube/);
  });
});

describe('live discovery sources share their article rules', () => {
  it('reads i-media reporter credit through the URL rule used by discovery', () => {
    const html = `<article class="entry"><h1>南京新聞</h1><div class="entry__meta-author"><a href="/Home/Search?Author=52">梅花新聞網 陳素貞/綜合報導</a></div><div id="articleContent"><p>${prose}</p></div></article>`;
    expect(extractArticle(html, 'https://i-media.tw/Article/Detail/51348').authors).toEqual(['陳素貞']);
  });
  it('reads HS News microdata in the main article header without an article tag', () => {
    const html = `<div class="article-details"><h1>生命教育</h1><div class="article-info"><span itemprop="author"><span itemprop="name">陳淑鈴</span></span><time itemprop="datePublished" datetime="2026-10-07T18:23:24+08:00">2026年10月07日</time></div><div itemprop="articleBody"><p>${prose}</p></div></div>`;
    const detail = extractArticle(html, 'https://hsnews.com.tw/education-and-culture/example.html');
    expect(detail.authors).toEqual(['陳淑鈴']);
    expect(detail.publishedAt?.toISOString()).toBe('2026-10-07T10:23:24.000Z');
  });
});

describe('baseline body and publication evidence', () => {
  it('retains Upmedia div paragraphs when an embedded tweet is the only p element', () => {
    const html = `<div class="news-box-text"><div class="mbt-text">圖片圖說</div><div>${prose}</div><div>美國有線電視新聞網（CNN）報導，新聞正文與明示引用。</div><blockquote><p>Embedded social post.</p></blockquote><div>主文結尾。</div><div class="news-foot">相關關鍵字</div><div class="rss_close">延伸閱讀：推薦文章</div></div>`;
    const detail = extractArticle(html, 'https://www.upmedia.mg/tw/international/headlines/270821');
    expect(detail.bodyStatus).toBe('ok');
    expect(detail.body).toContain(prose.trim());
    expect(detail.body).toContain('主文結尾。');
    expect(detail.body).not.toMatch(/圖片圖說|相關關鍵字|推薦文章/);
    expect(extractAttributions(detail.body ?? '', 'upmedia').map((c) => c.media)).toContain('cnn');
  });
  it('uses SETN visible publication clock rather than its incorrect UTC declaration', () => {
    const html = `<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-10-07 18:00 +00:00"}</script><div class="article_time_box"><div class="time_item"><span>2026/10/07 18:00:00</span></div></div><div id="newsContent"><p>${prose}</p></div>`;
    expect(extractArticle(html, 'https://www.setn.com/news/1918897').publishedAt?.toISOString()).toBe('2026-10-07T10:00:00.000Z');
  });
  it('normalizes SETN own main editor reporting declaration while excluding responsibility and unrelated credits', () => {
    const credit = '編輯 林昀萱 台北報導';
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', author: { '@type': 'Person', name: credit } })}</script><h1>主文題名</h1><div class="article_time_wrap"><div class="article_time_area"><div class="article_remark_wrap"><div class="author_wrap">${credit}</div></div></div></div><div id="newsContent"><p>${prose}</p></div><aside><div class="author_wrap">編輯 王小明 台北報導</div></aside>`;
    expect(extractArticle(html, 'https://www.setn.com/news/1919110').authors).toEqual(['林昀萱']);
    expect(extractArticle(html.replaceAll(credit, '責任編輯 林昀萱 台北報導'), 'https://www.setn.com/news/1919110').authors).toEqual([]);
    expect(extractArticle(html, 'https://example.com/news/1919110').authors).toEqual([credit]);
  });
  it('uses Taro publication datetime without taking its later update or header clock', () => {
    const html = `<span class="topbar-date">2026-10-07 18:55</span><script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-10-07"}</script><div class="post-header"><time class="post-published" datetime="2026-10-07T17:49:48+08:00">最後更新</time><time class="post-published" datetime="2026-10-07T14:48:45+08:00">發表時間</time></div><article><div class="entry-content"><p>${prose}</p></div></article>`;
    expect(extractArticle(html, 'https://taronews.tw/2026/10/07/1209686/').publishedAt?.toISOString()).toBe('2026-10-07T06:48:45.000Z');
  });
  it('keeps syndicated Hoo Media reporter names distinct from the publishing aggregator', () => {
    const html = `<meta name="author" content="蕃新聞"><article><p>【互傳媒／記者 蔡鳳敏／雲林 報導】</p><p>${prose}</p></article>`;
    expect(extractArticle(html, 'https://n.yam.com/Article/20261007892837').authors).toEqual(['蔡鳳敏']);
  });
});

describe('additional independently evidenced credits', () => {
  it('recognizes the explicit Chuang and Point Media opening reporters', () => {
    for (const [byline, name] of [
      ['【創新聞記者陳光蘊／採訪報導】', '陳光蘊'],
      ['【點傳媒／記者張良舜埔里報導】', '張良舜'],
    ]) {
      expect(extractArticle(`<article><p>${byline}</p><p>${prose}</p></article>`, 'https://example.org/news').authors).toEqual([name]);
    }
  });
  it('records a GameRant report citation without inventing its country or citing a mere mention', () => {
    expect(extractAttributions('根據外媒 GameRant 報導，開發者已完成計畫。', '4gamers')).toEqual([
      expect.objectContaining({ media: 'gamerant', name: 'Game Rant', countryCode: 'ZZ' }),
    ]);
    expect(extractAttributions('GameRant 是這篇報導討論的遊戲網站。', '4gamers')).toEqual([]);
    expect(extractAttributions('圖片來源：GameRant', '4gamers')).toEqual([]);
  });
});

describe('feed-corroborated publication zone errors', () => {
  const epoch = (declared: string | null, updated = '2026-10-07T18:28:08+08:00') =>
    `${declared ? `<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"${declared}"}</script>` : ''}<div id="artbody" itemprop="articleBody"><header><time datetime="${updated}">更新時間</time></header><p>${prose}</p></div>`;
  it('corrects Epoch Times false UTC only when the printed local clock agrees', () => {
    const url = 'https://www.epochtimes.com/b5/26/10/7/n14865341.htm';
    expect(extractArticle(epoch('2026-10-07T18:28:08Z'), url).publishedAt?.toISOString()).toBe('2026-10-07T10:28:08.000Z');
    expect(extractArticle(epoch('2026-10-07T10:28:08Z'), url).publishedAt?.toISOString()).toBe('2026-10-07T10:28:08.000Z');
    expect(extractArticle(epoch('2026-10-06T10:28:08Z'), url).publishedAt?.toISOString()).toBe('2026-10-06T10:28:08.000Z');
    expect(extractArticle(epoch(null), url).publishedAt).toBeNull();
  });
  it('retains Initium seconds when its visible publication clock only shows minutes', () => {
    const html = `<meta property="article:published_time" content="2026-10-07T17:30:41.000Z"><div class="post-info"><time datetime="2026-10-07">2026年10月7日 17:30</time></div><article><p>${prose}</p></article>`;
    expect(extractArticle(html, 'https://theinitium.com/20261007-initium-audio-example/').publishedAt?.toISOString()).toBe(
      '2026-10-07T09:30:41.000Z',
    );
  });
});
