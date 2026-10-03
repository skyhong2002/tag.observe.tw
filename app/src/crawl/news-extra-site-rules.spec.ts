import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { newsSiteRules } from './news-site-rules.ts';

const body = '居民針對公共交通提出改善需求，市府回應將在公開會議討論路線、班次與預算，並邀請專家評估。'.repeat(8);
const article = `<p>${body}</p>`;
const head = '<title>真實新聞文章標題</title>';
const samples = [
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
  it.each(samples)('extracts main article evidence at $url without unrelated headings/dates', ({ url, html, iso }) => {
    const result = extractArticle(head + html, url);
    expect(result.bodyStatus).toBe('ok');
    expect(result.body).toContain(body);
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
