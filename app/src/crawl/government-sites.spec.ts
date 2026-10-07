import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { discoverNews } from './news-discovery.ts';
import { publicArticleHtml } from './news-public-html.ts';
import { newsSiteRules } from './news-site-rules.ts';

const url = 'https://www.president.gov.tw/NEWS/40403';
const headline = '台灣美國商會75周年慶祝活動　副總統盼深化臺美科技產業合作';
const paragraph = '副總統表示，臺美關係建立在共同利益、共同價值觀，以及對彼此未來日益加深的投資之上。'.repeat(5);
const html = `<head><meta property="og:title" content="總統府新聞"><script type="application/ld+json">${JSON.stringify({
  '@type': 'NewsArticle',
  url,
  headline: '總統府新聞',
  datePublished: '2017-02-26T19:23:50.397+08:00',
})}</script></head><main><div class="pageWrap1"><div class="pageDate1"><span class="date">115年10月06日</span></div><div class="pageTitle1">${headline}</div><div class="pageTitle2">副總統出席慶祝活動</div><div class="article1"><p>${paragraph}</p><p>&nbsp;　</p><p>副總統與現場貴賓一同舉杯祝賀。</p>包括國家安全會議秘書長及各部會首長等亦出席是項活動。<p></p></div><div class="list8">照片圖說不屬於正文</div></div></main><footer><span class="date">115年12月31日</span>網站導覽</footer>`;

describe('official Presidential Office news', () => {
  it('uses the actual headline and ROC publication date instead of section metadata', () => {
    const result = extractArticle(html, url);
    expect(result.title).toBe(headline);
    expect(result.publishedAt?.toISOString()).toBe('2026-10-05T16:00:00.000Z');
    expect(result.bodyStatus).toBe('ok');
    expect(result.body).toContain(paragraph);
    expect(result.body).toContain('包括國家安全會議秘書長及各部會首長等亦出席是項活動。');
    expect(result.body).not.toMatch(/照片圖說|網站導覽|副總統出席慶祝活動/);
  });

  it('applies the rules only to reviewed official article routes', () => {
    expect(newsSiteRules('https://www.president.gov.tw/Page/35')).toBeUndefined();
    expect(newsSiteRules('https://unrelated.example/NEWS/40403')).toBeUndefined();
    expect(newsSiteRules(url)?.plainTextBody).toBe(true);
  });

  it('discovers full articles from the official summary RSS despite stale page JSON-LD', async () => {
    const feedUrl = 'https://www.president.gov.tw/RSSNEWS.aspx';
    const rss = `<rss version="2.0"><channel><item><title>${headline}</title><link>${url}</link><description>摘要而非全文。</description><pubDate>Tue, 06 Oct 2026 15:47:55 GMT</pubDate></item></channel></rss>`;
    const result = await discoverNews(
      { homeUrl: 'https://www.president.gov.tw/Page/35', feedUrls: [feedUrl], articlePattern: '^/NEWS/[0-9]+/?$', feedOnly: true },
      {
        now: () => new Date('2026-10-07T00:00:00Z'),
        fetch: async (requested) => ({
          url: String(requested),
          status: 200,
          body: String(requested) === feedUrl ? rss : html,
          contentType: 'text/html',
          ms: 1,
        }),
      },
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe(headline.replace(/\s+/g, ' '));
    expect(result.items[0].publishedAt?.toISOString()).toBe('2026-10-05T16:00:00.000Z');
    expect(result.items[0].verifiedContent?.body).toContain('包括國家安全會議秘書長及各部會首長等亦出席是項活動。');
    expect(result.strategy).toBe('rss');
  });
});

describe('government article date and body evidence', () => {
  it('keeps ministry lists and direct text as part of the complete release', () => {
    const result = extractArticle(
      `<meta name="DC.Date" content="2026-10-07"><header class="pageHeader"><h2>衛福部新聞稿標題</h2></header><article class="cpArticle"><p>${paragraph}</p><ol><li>第一項戒菸資源</li><li>第二項戒菸資源</li></ol>資料來源：衛福部</article>`,
      'https://www.mohw.gov.tw/cp-16-88160-1.html',
    );
    expect(result.title).toBe('衛福部新聞稿標題');
    expect(result.body).toContain('第一項戒菸資源');
    expect(result.body).toContain('資料來源：衛福部');
    expect(result.bodyStatus).toBe('ok');
  });

  it('uses the release date rather than an update label or unrelated footer date', () => {
    const result = extractArticle(
      `<meta property="article:published_time" content="2026-10-06"><h2 class="title">勞動部新聞稿</h2><section class="cp"><p>${paragraph}</p><ul class="publish_info_down"><li>更新日期：2026-10-08</li><li>發布日期：2026-10-07</li></ul></section><footer>發布日期：2026-12-31</footer>`,
      'https://www.mol.gov.tw/1607/1632/1633/99440/post',
    );
    expect(result.publishedAt?.toISOString()).toBe('2026-10-06T16:00:00.000Z');
    expect(result.body).not.toMatch(/更新日期|發布日期/);
  });

  it('reads scoped ROC dates in ministry and city templates', () => {
    const result = extractArticle(
      `<div class="page-content"><h3>內政部新聞稿</h3><ul><li>發布日期：115-10-07 15:14</li></ul><div class="area-essay page-caption-p"><div class="essay"><div class="p"><p>${paragraph}</p></div></div></div></div>`,
      'https://www.moi.gov.tw/News_Content.aspx?n=4&s=342455',
    );
    expect(result.publishedAt?.toISOString()).toBe('2026-10-07T07:14:00.000Z');
    expect(result.bodyStatus).toBe('ok');
    expect(result.body).toContain(paragraph);
  });

  it('repairs the encoded MOFA canonical only for the same official article identity', () => {
    const articleUrl = 'https://www.mofa.gov.tw/News_Content.aspx?n=95&s=123194';
    const malformed = (embedded: string) => `<meta property="og:url" content="https://www.mofa.gov.tw/${encodeURIComponent(embedded)}">`;
    expect(extractArticle(malformed(`${articleUrl}&Create=1`), articleUrl).canonical).toBe(articleUrl);
    const otherId = malformed('https://www.mofa.gov.tw/News_Content.aspx?n=95&s=999999');
    expect(extractArticle(otherId, articleUrl).canonical).not.toBe(articleUrl);
    const otherHost = malformed('https://unrelated.example/News_Content.aspx?n=95&s=123194');
    expect(extractArticle(otherHost, articleUrl).canonical).not.toBe(articleUrl);
    expect(publicArticleHtml(otherId, 'https://unrelated.example/News_Content.aspx?n=95&s=123194')).toBe(otherId);
  });
});
