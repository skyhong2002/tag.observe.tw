import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { ROUND3_NEWS_SITES } from './news-round3-sites.ts';

describe('migrated publisher identity', () => {
  it('reads article credit independently from reused author archives and sidebar mentions', () => {
    const rule = ROUND3_NEWS_SITES.find((site) => site.host === 'vigormedia.tw')!;
    const $ = cheerio.load(`<aside>美洲台灣日報</aside>
      <div class="tdb_single_author"><a class="tdb-author-name" href="/author/peoplemedia-contributor/">其他作者</a></div>
      <div class="tdb_single_content"><div class="tdb-block-inner"><p>完整正文提到美洲台灣日報。</p><div class="sharedaddy">分享</div></div></div>`);
    expect($(rule.providerSelector!).first().text()).toBe('其他作者');
    $(rule.bodyExcludeSelector!).remove();
    expect($(rule.bodySelector).text()).toBe('完整正文提到美洲台灣日報。');
    expect(rule.path.test('/article-slug/')).toBe(true);
    expect(rule.path.test('/author/peoplemedia-contributor/')).toBe(false);
    expect(rule.path.test('/category/news/')).toBe(false);
  });
  it('requires Environmental Info article credit independently from an inline citation', () => {
    const rule = ROUND3_NEWS_SITES.find((site) => site.host === 'e-info.org.tw')!;
    const $ = cheerio.load(`<main><span class="post-credit__CreditName-generated">環境資訊中心記者</span>
      <article class="post-content__Content-generated"><div>引述農傳媒，但不是農傳媒供稿。</div></article></main>`);
    expect($(rule.providerSelector!).text()).toBe('環境資訊中心記者');
    expect($(rule.bodyHtmlSelector!).text()).toContain('引述農傳媒');
    expect(rule.path.test('/node/220413')).toBe(true);
    expect(rule.path.test('/search')).toBe(false);
  });
  it('ignores Roomie’s appended second article when identifying a GQ partner article', () => {
    const rule = ROUND3_NEWS_SITES.find((site) => site.host === 'roomie.tw')!;
    const $ =
      cheerio.load(`<main><article><h1>本篇</h1><div class="author-section"><a href="/posts/author/editor">其他作者</a></div><div class="content"><p>本篇正文</p></div></article>
      <article><div class="author-section"><a href="/posts/author/gq">GQ</a></div><div class="content"><p>下一篇推薦</p></div></article></main>`);
    expect($(rule.providerSelector!).text()).toBe('其他作者');
    expect($(rule.bodySelector).text()).toBe('本篇正文');
  });
  it('uses Grinews license credit when the shared byline names another brand', () => {
    const rule = ROUND3_NEWS_SITES.find((site) => site.host === 'grinews.com')!;
    const $ = cheerio.load(
      `<article><ul class="post-meta"><li class="author"><a>CitiOrange 公民報橘</a></li></ul><div class="post-content"><p><span><strong>本圖/文由「<span><a>Techorange科技報橘</a></span>」授權刊登</strong></span></p></div></article><aside><a>CitiOrange 公民報橘</a></aside>`,
    );
    expect($(rule.providerSelector!).text()).toBe('Techorange科技報橘');
  });
  it('requires a Fearless article copyright credit and excludes modified dates and tags', () => {
    const rule = ROUND3_NEWS_SITES.find((site) => site.host === 'fearless.cool')!;
    const $ = cheerio.load(
      `<main class="site-main"><div class="page-content"><p class="last-updated">2026-01-01</p><div><p>正文</p><p><strong>※本文版權為宜蘭新聞網所有，歡迎轉載，請務必註明出處※</strong></p></div><div class="post-tags">標籤</div></div></main>`,
    );
    expect($(rule.providerSelector!).text()).toContain('宜蘭新聞網所有');
    expect($(rule.bodySelector).text()).not.toContain('2026-01-01');
    expect($(rule.bodySelector).text()).not.toContain('標籤');
  });
});
