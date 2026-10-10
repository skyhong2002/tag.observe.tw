import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { newsSiteRules } from './news-site-rules.ts';

const body = '居民針對公共交通提出改善需求，市府回應將在公開會議討論路線、班次與預算，並邀請專家評估。'.repeat(8);
const article = `<p>${body}</p>`;
const head = '<title>真實新聞文章標題</title>';
const samples = [
  {
    url: 'https://watchout.tw/reports/cfQ1ORe7lYAGkaX0Oqpr',
    html: `<div class="page read single"><div class="doc-header"><h1>真實新聞文章標題</h1><div class="dates"><div><span>發佈時間</span><span>2026/10/1 06:47:33</span></div><div><span>最後更新</span><span>2026/10/2 09:00:00</span></div></div></div><div class="content paragraphs">${article}</div></div><div class="after-article"><div class="date">2026/12/31</div>其他新聞</div>`,
    iso: '2026-10-01T06:47:33.000Z',
  },
  {
    url: 'https://eventsinfocus.org/news/7148462',
    html: `<main id="content"><h1>真實新聞文章標題</h1><div class="node__content"><div class="field--name-field-time"><time datetime="2026-09-29T12:00:00Z">2026-09-29</time></div><div class="field--name-body">${article}</div></div></main><aside><div class="node__content"><time>2026-12-31</time><div class="field--name-body">不屬於這篇新聞的募款報告</div></div></aside>`,
    iso: '2026-09-29T12:00:00.000Z',
  },
  {
    url: 'https://news.taiwannet.com.tw/news/222118/article.html?categoryId=Academic',
    html: `<div class="news-date-box"><span class="news-time"><time>2026/10/2</time></span></div><div class="news-date-txt-box">${article}</div><footer><time>2026/12/31</time></footer>`,
    iso: '2026-10-01T16:00:00.000Z',
  },
  {
    url: 'https://ct.org.tw/html/news/3-3.php?cat=13&article=1404551',
    html: `<main><div class="nine wide column"><div class="meta"><span class="date">2026-10-03</span></div><h1>真實新聞文章標題</h1><article>${article}</article><div class="card"><span class="date">2026-12-30</span></div></div></main>`,
    iso: '2026-10-02T16:00:00.000Z',
  },
  {
    url: 'https://www.guancha.cn/GuoJi/2026_10_03_903114.shtml',
    html: `<div class="left-main"><h3>真實新聞文章標題</h3><div class="time"><span>2026-10-03 18:43:07</span></div><div class="content all-txt">${article}</div></div><div class="time"><span>2026-12-30 20:00:00</span></div>`,
    iso: '2026-10-03T10:43:07.000Z',
  },
  {
    url: 'https://www.wenweipo.com/a/202610/03/AP6ac0c97ae4b01d54a285c0d5.html',
    html: `<div class="title-bar"><h1>真實新聞文章標題</h1><div class="info-bar"><span class="time">2026-10-03 17:23:03</span></div></div><div id="richTextContainer">${article}</div>`,
    iso: '2026-10-03T09:23:03.000Z',
  },
  {
    url: 'https://hk.crntt.com/doc/2_4_107240423_1_1003123915.html',
    html: `<table><tr><td><font style="font-size:22px"><strong>真實新聞文章標題</strong></font></td></tr><tr><td align="center"><font style="font-size:14px">http://www.CRNTT.com</font> 2026-10-03 12:39:14</td></tr><tr><td id="zoom">${article}</td></tr><tr><td><strong>相關新聞：</strong></td></tr></table>`,
    iso: '2026-10-03T04:39:14.000Z',
  },
  {
    url: 'https://www.tkww.hk/a/202610/03/AP6ac03ce1e4b0e1e2ee728b4a.html',
    html: `<script type="application/ld+json">{"@type":"Article","datePublished":"Sat Oct 03 07:23:11 HKT 2026"}</script><h1 class="content-title-text">真實新聞文章標題</h1><div class="content-main-left"><div class="content-body-inner">${article}</div></div>`,
    iso: '2026-10-02T23:23:11.000Z',
  },
];

describe('additional publisher article templates', () => {
  it('keeps every Tatler text block without gallery controls or the read-more button', () => {
    const html = `${head}<div class="article-height"><div class="article-content"><button>閱讀全文</button></div><div><div class="article-content"><div class="rich-text">${article}</div></div><div class="article-content">1 / 1 arrow left arrow right</div><div class="article-content"><div class="rich-text"><p>文章最後一段完整保留。</p></div></div></div></div>`;
    const result = extractArticle(html, 'https://www.tatlerasia.com/style/beauty/example-zh-hant');
    expect(result.body).toContain(body);
    expect(result.body).toContain('文章最後一段完整保留。');
    expect(result.body).not.toMatch(/arrow|閱讀全文/);
    expect(result.bodyStatus).toBe('ok');
  });

  it.each(samples)('extracts main article evidence at $url without unrelated headings/dates', ({ url, html, iso }) => {
    const result = extractArticle(head + html, url);
    expect(result.bodyStatus).toBe('ok');
    expect(result.body).toContain(body);
    expect(result.body).not.toContain('不屬於這篇新聞的募款報告');
    expect(result.title).toBe('真實新聞文章標題');
    expect(result.publishedAt?.toISOString()).toBe(iso);
  });

  it.each(samples)('does not apply article-specific selectors to another host or section root at $url', ({ url }) => {
    const root = new URL(url);
    expect(newsSiteRules(root.origin)).toBeUndefined();
    root.hostname = 'unrelated.example';
    expect(newsSiteRules(root.href)).toBeUndefined();
  });
});

it('prefers Watchout printed UTC publication over its zoneless JSONLD and reads its main author credit', () => {
  const url = 'https://watchout.tw/reports/TGBqL290gwsihU5z6yTU';
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', mainEntityOfPage: { '@id': 'https://watchout.tw' }, datePublished: '2026/10/7 11:03:50', author: [{ '@type': 'Person', name: '薛翰駿 Sih Hān-Tsùn' }] })}</script><aside><div class="dates"><div><span>2027/12/31 12:00:00</span></div></div></aside><main><div class="page read single"><div class="doc-header"><div class="authors authors-container"><div class="author-type">作者</div><div class="authors"><a href="https://watchout.tw/authors/272"><div class="name">薛翰駿 Sih Hān-Tsùn</div></a></div></div><div class="dates"><div><span>發佈時間</span><span>2026/10/7 11:03:50</span></div><div><span>最後更新</span><span>2026/10/7 11:34:31</span></div></div></div><div class="content paragraphs">${article}</div></div></main><aside><div class="authors-container"><div class="authors"><a href="https://watchout.tw/authors/999"><div class="name">其他作者</div></a></div></div></aside>`;
  expect(extractArticle(html, url)).toMatchObject({ authors: ['薛翰駿 Sih Hān-Tsùn'], publishedAt: new Date('2026-10-07T11:03:50Z') });
  expect(extractArticle(html.replace('page read single', 'other-page'), url).authors).toEqual([]);
});

it('reads 想想論壇 day-only publication, writer and tags from the Drupal node, not the summary or related cards', () => {
  const url = 'https://www.thinkingtaiwan.net/article/100476';
  const html = `<meta property="og:title" content="真實新聞文章標題 - 想想Thinking Taiwan - 想想台灣，想想未來"><main><div id="block-thinking-theme-page-title"><h1 class="title"><span class="field field--name-title">真實新聞文章標題</span></h1></div><article class="node node--type-article"><div class="node__content"><div class="node__meta"><div class="node-meta-inner">作者<span class="divider">｜</span><span class="writer-name"><div class="field field--name-field-writer field__item">黃偉翔</div></span><div class="writer-info"><p>台灣技職教育議題工作者。</p></div><div class="post-date"><span>發佈於<span class="divider">｜</span>2026-10-09   </span></div><div class="field--name-field-tags"><ul><li><a href="/tags/100340">技職教育</a></li><li><a href="/tags/100503">技能競賽</a></li></ul></div></div></div><div class="node-content"><div class="field field--name-field-summary"><ul><li>不屬於這篇新聞的募款報告</li></ul></div><div class="field field--name-body">${article}</div></div></div></article><aside><div class="post-date"><span>發佈於<span class="divider">｜</span>2027-12-31</span></div></aside></main>`;
  const result = extractArticle(html, url, { tagSelector: '.field--name-field-tags a[href^="/tags/"]' });
  expect(result).toMatchObject({ title: '真實新聞文章標題', authors: ['黃偉翔'], tags: ['技職教育', '技能競賽'], bodyStatus: 'ok' });
  expect(result.publishedAt?.toISOString()).toBe('2026-10-08T16:00:00.000Z');
  expect(result.body).not.toContain('不屬於這篇新聞的募款報告');
  expect(newsSiteRules('https://www.thinkingtaiwan.net/topics/ideas-policies')).toBeUndefined();
});
