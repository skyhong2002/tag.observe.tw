import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { newsSiteRules } from './news-site-rules.ts';

const body = '這是完整的公開新聞正文，包含事件背景、現場描述及採訪內容，方便讀者理解報導。'.repeat(12);
const p = `<p>${body}</p>`;
const samples = [
  {
    url: 'https://www.voachinese.com/a/article-slug/8207164.html',
    html: `<h1>文字新聞標題</h1><time pubdate datetime="2026-10-03T02:00:08+08:00">2026年10月3日</time><div id="article-content"><div class="wsw">${p}<div class="wsw__embed">嵌入播放器推薦文章</div><p>全文最後一段。</p></div></div>`,
    iso: '2026-10-02T18:00:08.000Z',
  },
  {
    url: 'https://tnews.cc/06/News/View/1198091',
    html: `<div class="article-meta"><span>發布時間：2026/12/31 23:00</span></div><div class="edit-area"><div class="news-theme">文字新聞標題</div><div class="article-meta-container"><div class="article-meta"><span>發布時間：2026/10/03 17:19</span><span>新聞出處：記者姓名</span></div></div><div class="article-content"><div class="ql-editor">${p}<p>全文最後一段。</p></div></div></div>`,
    iso: '2026-10-03T09:19:00.000Z',
  },
  {
    url: 'https://www.digitimes.com.tw/col/article/?id=18280',
    html: `<div class="dg-color--spanish-gray">2026-12-31</div><div id="dg-col-article-content"><div class="d-flex"><h1>文字新聞標題</h1><div class="dg-color--spanish-gray">2026-10-02</div></div><div id="ai-audio-summary">AI語音摘要</div><div class="dg-col-article-body">${p}<p>全文最後一段。</p></div></div>`,
    iso: '2026-10-01T16:00:00.000Z',
  },
  {
    url: 'https://www.thepaper.cn/newsDetail_forward_34191616',
    html: `<main><h1>文字新聞標題</h1><div class="headerContent__abc"><div class="left__def"><div class="ant-space-item"><span>2026-10-02 16:17</span></div><div class="ant-space-item"><span>來源：澎湃新聞</span></div></div></div><div class="cententWrap__ghi">${p}<p>全文最後一段。</p></div></main>`,
    iso: '2026-10-02T08:17:00.000Z',
  },
];

describe('platform public article templates', () => {
  it.each(samples)('preserves the complete body and its publication date: $url', ({ url, html, iso }) => {
    const result = extractArticle(html, url);
    expect(result.bodyStatus).toBe('ok');
    expect(result.body).toContain(body);
    expect(result.body).toContain('全文最後一段。');
    expect(result.body).not.toMatch(/嵌入播放器|AI語音摘要/);
    expect(result.publishedAt?.toISOString()).toBe(iso);
    expect(result.title).toBe('文字新聞標題');
  });
  it('does not treat video-only pages, interview notices or membership routes as these public templates', () => {
    for (const url of [
      'https://www.voachinese.com/a/8207246.html',
      'https://tnews.cc/Interviews/InterviewsList',
      'https://www.digitimes.com.tw/tech/dt/n/shwnws.asp?id=770357',
      'https://www.thepaper.cn/channel_25950',
      'https://unrelated.example/col/article/?id=18280',
    ])
      expect(newsSiteRules(url)).toBeUndefined();
  });
  it('reads the licensed partner from LINE TODAY provider meta, not its own publisher meta', () => {
    const html = `<head><meta property="provider" content="Cheers 快樂工作人"/><meta property="publisher" content="LINE TODAY"/></head><body><h1>文字新聞標題</h1><article class="entityBodyModule">${p}<p>全文最後一段。</p></article></body>`;
    const result = extractArticle(html, 'https://today.line.me/tw/v3/article/MLBmLRz');
    expect(result.provider).toBe('Cheers 快樂工作人');
    expect(result.bodyStatus).toBe('ok');
    expect(result.body).toContain('全文最後一段。');
    expect(newsSiteRules('https://today.line.me/tw/v3/publisher/100427')).toBeUndefined();
  });
});
