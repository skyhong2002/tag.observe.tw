import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { extractArticle, parsePublished } from './article.ts';
import { newsSiteEvidence, newsSiteRules } from './news-site-rules.ts';

const prose = '這是公開文章的完整內文，記者訪問當地居民，逐一記錄相關政策的背景、執行方式與實際影響。'.repeat(8);
const fixtures = [
  {
    url: 'https://tw.sports.yahoo.com/news/reviewed-archive-075035380.html',
    html: `<header><div class="article-time"><time datetime="2020-01-15T07:50:35.000Z">2020年1月15日</time></div></header><section class="module-article-body"><article id="article-example"><div class="atoms"><p>${prose}</p></div></article></section>`,
    date: '2020-01-15T07:50:35.000Z',
  },
  {
    url: 'https://zht.globalvoices.org/2026/05/15/37282/',
    html: `<meta property="article:published_time" content="2026-05-15T06:00:00Z"><div class="full-article"><div class="post"><div class="entry-container"><div class="entry"><p>${prose}</p></div></div></div></div>`,
  },
  {
    url: 'https://punchline.asia/archives/63542',
    html: `<time itemprop="datePublished" datetime="2024-06-26T14:58:51+08:00">2024-06-26</time><div class="post-content description" itemprop="articleBody"><p>${prose}</p></div>${'<article>推薦文章</article>'.repeat(4)}`,
    date: '2024-06-26T06:58:51.000Z',
  },
  {
    url: 'https://nommagazine.com/news-story/',
    html: `<div class="page-main post type-post hentry post-style-banner"><div class="zh-content"><p>${prose}</p></div></div>`,
  },
  {
    url: 'https://www.dramaqueen.com.tw/news/20260618/001.html',
    html: `<h2><span class="time-info"><img><span>2026-06-18</span><img><span>2026-09-30 12:50</span></span></h2><div class="Con_PrTl"><p>${prose}</p></div>`,
    date: '2026-06-17T16:00:00.000Z',
  },
  { url: 'http://www.viewpointtaiwan.com/commentary/example/', html: `<div class="sing-spacer"><p>${prose}</p></div>` },
  {
    url: 'http://jdanews.com/03_000030.php',
    html: `<table width="980" cellpadding="10"><tr><td valign="top">半島新聞<p><font size="2">2011年6月4日 記者姓名</font></p><p><font size="5">古城新聞</font></p><p>${prose}</p><table><tr><td>不應包含的推薦新聞</td></tr></table></td><td valign="top">其他最新新聞</td></tr></table>`,
    date: '2011-06-03T16:00:00.000Z',
  },
  {
    url: 'https://www.taiwanenews.com/docs/20260930101.php',
    html: `<div id="MsgContainer"><div><blockquote><p>編譯作者／綜合報導 2026年9月29日</p><p>${prose}</p><h1>不應包含的推薦新聞</h1><p>下一篇另有日期的內文</p></blockquote></div></div>`,
    date: '2026-09-28T16:00:00.000Z',
  },
];

describe('legacy publisher article templates', () => {
  it.each(fixtures)('extracts the main public body at $url', ({ url, html, date }) => {
    const fullHtml = `<title>經過核實的文章標題</title>${html}`;
    const evidence = newsSiteEvidence(cheerio.load(fullHtml), url);
    expect(evidence.isArticle).toBe(true);
    if (date) expect(parsePublished(evidence.publishedRaw)?.toISOString()).toBe(date);
    const article = extractArticle(fullHtml, url);
    expect(article.bodyStatus).toBe('ok');
    expect(article.body).toContain(prose);
    expect(article.body).not.toContain('不應包含的推薦新聞');
    expect(article.body).not.toContain('下一篇另有日期');
  });

  it('does not apply archive selectors to home and section listings', () => {
    for (const url of [
      'https://zht.globalvoices.org/',
      'https://punchline.asia/archives/category/movie',
      'https://nommagazine.com/category/business/',
      'https://www.dramaqueen.com.tw/news',
      'http://www.viewpointtaiwan.com/category/commentary/',
      'http://jdanews.com/03.php',
      'https://www.taiwanenews.com/doc/Cao_Forum.php',
    ]) {
      expect(newsSiteRules(url)).toBeUndefined();
    }
  });
});
