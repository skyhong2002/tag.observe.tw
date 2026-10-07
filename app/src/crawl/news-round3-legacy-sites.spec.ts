import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { extractArticleContent } from './article-content.ts';
import type { FetchResult } from './fetch.ts';
import { discoverNews } from './news-discovery.ts';
import { ROUND3_LEGACY_NEWS_SITES } from './news-round3-legacy-sites.ts';

const rule = ROUND3_LEGACY_NEWS_SITES.find((site) => site.host === 'tw.people.com.cn')!;
const body = '這是完整公開報導，記錄兩岸交流活動的背景、參與人員與實際過程，並保留報導最後的結語。'.repeat(8);

describe('reviewed Taiwan.cn syndication on People.com.cn', () => {
  it('separates the actual source and syndication date from adjacent article recommendations', () => {
    const $ = cheerio.load(
      `<div class="rm_txt"><div class="col-1"><h1>活動完整報導</h1><div class="channel"><div class="col-1-1">2026年01月12日10:27 | 来源：<a href="http://www.taiwan.cn/original.htm">中国台湾网</a></div></div><div class="rm_txt_con"><p>${body}</p><div class="relate"><p>推薦內容不應入庫</p></div></div></div><div class="col-2">2026年10月3日 来源：其他媒體</div></div>`,
    );
    const content = extractArticleContent($, 'http://tw.people.com.cn/n1/2026/0112/c14657-40643580.html', rule);
    expect(content.bodyStatus).toBe('ok');
    expect(content.body).toBe(body);
    expect($(rule.providerSelector!).text()).toBe('中国台湾网');
    expect($(rule.publishedSelector!).text()).toBe('2026年01月12日10:27 | 来源：中国台湾网');
  });

  it('reads Sina official-account credit separately from its article body', () => {
    const sina = ROUND3_LEGACY_NEWS_SITES.find((site) => site.host === 'news.sina.com.cn')!;
    const $ = cheerio.load(
      `<div class="date-source"><span class="date">2026年09月24日 07:42</span><span class="author"><a class="source">中国台湾网</a> 中国台湾网官方账号</span></div><div id="article_content"><div class="article-content-left"><div id="article"><p>${body}</p></div></div></div><aside><a class="source">其他媒體</a></aside>`,
    );
    expect(extractArticleContent($, 'https://news.sina.com.cn/zx/gj/2026-09-24/doc-inisxhnx5304571.shtml', sina).body).toBe(body);
    expect($(sina.providerSelector!).text()).toBe('中国台湾网');
    expect($(sina.publishedSelector!).text()).toBe('2026年09月24日 07:42');
  });

  it('keeps the matching mobile canonical article body and publisher credit', () => {
    const mobile = ROUND3_LEGACY_NEWS_SITES.find(
      (site) => site.host === 'news.sina.cn' && site.path.test('/znl/2026-09-24/detail-inisxhnx5304571.d.html'),
    )!;
    const $ = cheerio.load(
      `<meta name="author" content="中国台湾网"><section class="j_main_art"><h1 class="art_tit_h1">同一則完整報導</h1><article class="art_box"><section class="art_content"><p>${body}</p></section></article></section><aside><p>不要混入推薦摘要</p></aside>`,
    );
    expect(extractArticleContent($, 'https://news.sina.cn/znl/2026-09-24/detail-inisxhnx5304571.d.html', mobile).body).toBe(body);
    expect($(mobile.providerSelector!).attr('content')).toBe('中国台湾网');
  });

  it('does not apply the template to channel listings', () => {
    expect(rule.path.test('/GB/14813/index.html')).toBe(false);
    expect(rule.path.test('/')).toBe(false);
  });
  it('discovers official-account news while validating each article source and original publication date', async () => {
    const homeUrl = 'https://k.sina.cn/media_m_1776346.html';
    const api = 'https://k.sina.cn/aj/newmedia/list?source=js&muid=1776346&page=1';
    const urls = ['wrong', 'undated', 'complete'].map((slug) => `https://news.sina.com.cn/zx/gj/2021-01-01/doc-${slug}123.shtml`);
    const render = (provider: string, date: string) =>
      `<title>這是一篇完整公開新聞報導</title><div class="date-source"><span class="date">${date}</span><a class="source">${provider}</a></div><div id="article_content"><div class="article-content-left"><div id="article"><p>${body}</p></div></div></div>`;
    const pages: Record<string, string> = {
      [api]: JSON.stringify({
        status: 0,
        data: [
          { mediaTypes: 'video', link: 'https://news.sina.com.cn/video/123', title: '不收影片' },
          { mediaTypes: 'news', link: 'https://unreviewed.test/story/123', title: '不收外站' },
          ...urls.map((link) => ({
            mediaTypes: 'news',
            link: link.replace('https:', 'http:'),
            title: '新聞標題不能代替內文',
            pubDate: 1790985600,
          })),
        ],
      }),
      [urls[0]]: render('其他媒體', '2021年01月01日 10:27'),
      [urls[1]]: render('中国台湾网', ''),
      [urls[2]]: render('中国台湾网', '2021年01月01日 10:27'),
    };
    const calls: string[] = [];
    const fetcher = async (url: string): Promise<FetchResult> => {
      calls.push(url);
      return {
        url,
        status: pages[url] ? 200 : 404,
        body: pages[url] ?? '',
        contentType: url === api ? 'application/json' : 'text/html',
        ms: 1,
      };
    };
    const result = await discoverNews(
      { homeUrl, articleHosts: ['news.sina.com.cn', 'news.sina.cn'], provider: '^中国台湾网$', includeArchive: true, maxArticles: 3 },
      { fetch: fetcher, now: () => new Date('2026-10-03T00:00:00Z') },
    );
    expect(result.items.map((item) => item.url)).toEqual([urls[2]]);
    expect(result.items[0].publishedAt?.toISOString()).toBe('2021-01-01T02:27:00.000Z');
    expect(result.items[0].verifiedContent?.body).toBe(body);
    expect(calls).toEqual([api, ...urls]);
  });
});
