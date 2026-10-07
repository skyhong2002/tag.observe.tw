import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { listSource } from './pipeline.ts';
import { sourceByMedia } from './registry.ts';

// Long enough to clear the 200-character body minimum.
const prose = (label: string) => `${label}：${'這是一段完整的新聞內文，描述事件的經過與背景。'.repeat(12)}`;

describe('round 4 article templates', () => {
  it('uses Healthnews headlines instead of the category wrapped in a second listing link', async () => {
    const headline = '為什麼過敏有的孩子鼻塞、有的卻皮膚癢？';
    const html = `<a href="/article/69779"><div class="a1">${headline}</div></a><a href="/article/69779"><span class="badge">過敏</span><span class="a1-title">${headline}</span></a>`;
    const spec = sourceByMedia('healthnews')!;
    const list = await listSource(spec, async () => ({
      status: 200,
      body: html,
      url: 'https://www.healthnews.com.tw/',
      contentType: 'text/html',
      ms: 1,
    }));
    expect(list.items).toHaveLength(1);
    expect(list.items[0].title).toBe(headline);
    const article = `<h1>${headline}</h1><meta property="og:title" content="${headline} - 健康醫療網"><div id="article-content"><p>${prose('健康醫療網')}</p></div>`;
    expect(extractArticle(article, 'https://www.healthnews.com.tw/article/69779')).toMatchObject({
      title: headline,
      body: prose('健康醫療網'),
    });
  });

  it('keeps a site container inside wrappers whose class names look like ads', () => {
    const html = `<div id="ad-root"><article id="article-content"><p>${prose('食尚玩家')}</p><div class="ad-slot"><p>廣告文字</p></div></article></div>`;
    const detail = extractArticle(html, 'https://supertaste.tvbs.com.tw/food/361774');
    expect(detail.bodyStatus).toBe('ok');
    expect(detail.body).toContain('食尚玩家：');
    expect(detail.body).not.toContain('廣告文字');
  });

  it('reads The Femin body from its share wrapper instead of the copyright footer', () => {
    const html = `<article class="post blog-post"><div class="share-container"><div class="post-content-container"><div class="post-content entry-content"><p>${prose('The Femin')}</p></div></div></div><footer>© A Day Media Limited. 所有內容嚴禁以任何方式轉載</footer></article>`;
    const detail = extractArticle(html, 'https://thefemin.com/2026/10/saint-laurent-2027-spring-summer/');
    expect(detail.bodyStatus).toBe('ok');
    expect(detail.body).toBe(prose('The Femin'));
  });

  it('does not trust ad-like wrappers for sites without the opt-in', () => {
    const html = `<div class="under-ads"><div class="article-content"><p>${prose('一般網站')}</p></div></div>`;
    expect(extractArticle(html, 'https://example.com/news/1').bodyStatus).not.toBe('ok');
  });

  it('reads Bahamut GNN paragraphs written as div and br blocks', () => {
    const html = `<div class="GN-lbox3"><div class="GN-lbox3B"><div><div>${prose('第一段')}</div><div>第二段<br>第三段</div></div><p>小標題</p></div></div>`;
    const body = extractArticle(html, 'https://gnn.gamer.com.tw/detail.php?sn=312851').body ?? '';
    expect(body.split('\n\n')).toEqual(expect.arrayContaining([prose('第一段'), '第二段', '第三段', '小標題']));
  });

  it('unwraps the 4Gamers server-rendered article from its noscript copy', () => {
    const html = `<noscript><img src="https://www.facebook.com/tr?id=1"></noscript><noscript><main class="p-3"><h1>標題</h1><article class="render-content"><p>${prose('4Gamers')}</p></article><p class="tag">Tags: #遊戲</p></main></noscript><div id="app"></div>`;
    const detail = extractArticle(html, 'https://www.4gamers.com.tw/news/detail/82402/slug');
    expect(detail.bodyStatus).toBe('ok');
    expect(detail.body).toBe(prose('4Gamers'));
  });

  it('takes only the requested PanSci article, not the pre-rendered next ones', () => {
    const html = `<section><div class="post-content-container"><p>${prose('本篇')}</p></div></section><section><div class="post-content-container"><p>${prose('下一篇')}</p></div></section>`;
    const body = extractArticle(html, 'https://pansci.asia/archives/382306').body ?? '';
    expect(body).toContain('本篇：');
    expect(body).not.toContain('下一篇');
  });

  it('does not read a subscribe-to-our-channel line as a paywall', () => {
    const html = `<div id="article-content"><p>${prose('健康醫療網')}</p></div><footer>訂閱【健康愛樂活】影音頻道，閱讀健康知識更輕鬆</footer>`;
    expect(extractArticle(html, 'https://www.healthnews.com.tw/article/69867').bodyStatus).toBe('ok');
    expect(extractArticle(html, 'https://www.healthnews.com.tw/readnews.php?id=52905').bodyStatus).toBe('ok');
  });

  it('drops the 報導者 donation appeal and category links from the body', () => {
    const html = `<div id="article-body"><div class="metadata__MetadataContainer-sc-1"><a>國際兩岸</a></div><p>${prose('報導者')}</p><div class="donation-box__Container-sc-1"><p>你的支持能幫助《報導者》持續追蹤國內外新聞事件的真相。</p></div></div>`;
    const body = extractArticle(html, 'https://www.twreporter.org/a/podcast-2026-10-02').body ?? '';
    expect(body).toBe(prose('報導者'));
  });
});
