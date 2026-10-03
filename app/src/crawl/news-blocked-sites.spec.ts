import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { BLOCKED_NEWS_SITES } from './news-blocked-sites.ts';

describe('reviewed public publisher templates', () => {
  it('identifies the Yam article publisher without borrowing a sidebar credit', () => {
    const rule = BLOCKED_NEWS_SITES.find((site) => site.host === 'n.yam.com')!;
    const $ = cheerio.load(`<aside><a class="source-name">三星傳媒</a></aside>
      <section class="inner-page"><header><h1>其他媒體的文章</h1>
      <a class="source-name">其他媒體</a></header><div class="inner-content"><p>真正正文</p></div></section>
      <aside><a class="source-name">三星傳媒</a></aside>`);
    expect($(rule.providerSelector!).first().text()).toBe('其他媒體');
    expect($(rule.bodySelector).text()).toBe('真正正文');
    expect(rule.path.test('/realtime/tristarnews')).toBe(false);
  });

  it('requires FTV’s explicit lead credit and preserves ordinary article leads', () => {
    const rule = BLOCKED_NEWS_SITES.find((site) => site.host === 'ftvnews.com.tw')!;
    const $ = cheerio.load(
      '<div class="article-body"><article><div id="preface"><p>民視記者報導</p><p>重要導言</p></div><div id="newscontent"><p>正文提到圖、文／菱傳媒不代表作者</p></div></article></div>',
    );
    expect($(rule.providerSelector!).first().text()).toBe('民視記者報導');
    $(rule.bodyExcludeSelector!).remove();
    expect($('#preface').text()).toContain('重要導言');
    const partner = cheerio.load(
      '<div class="article-body"><article><div id="preface"><p>圖、文／菱傳媒</p><p>重複導言</p></div><div id="newscontent"><p>導言和完整正文</p><p class="aphorism">授權聲明</p></div></article></div>',
    );
    partner(rule.bodyExcludeSelector!).remove();
    expect(partner(rule.bodySelector).text()).toBe('圖、文／菱傳媒重複導言導言和完整正文');
  });

  it('limits Business Weekly extraction to actual article routes and body', () => {
    const rule = BLOCKED_NEWS_SITES.find((site) => site.host === 'businessweekly.com.tw')!;
    expect(rule.path.test('/business/blog/3022466')).toBe(true);
    expect(rule.path.test('/rss')).toBe(false);
    expect(rule.path.test('/Search?keyword=news')).toBe(false);
    const $ = cheerio.load(
      '<h1>原始標題</h1><div class="Single-summary-content">摘要</div><div class="article-body Single-article"><p>公開正文</p></div><aside>推薦</aside>',
    );
    expect($(rule.bodySelector).text()).toBe('公開正文');
  });
});
