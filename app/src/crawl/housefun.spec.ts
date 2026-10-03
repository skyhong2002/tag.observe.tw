import { describe, expect, it, vi } from 'vitest';
import { extractArticle } from './article.ts';
import { listSource } from './pipeline.ts';
import { overrides } from './sources/overrides.ts';
import { loadSources } from './sources.ts';

const url = 'https://www.myhousing.com.tw/n/n02/n0203/n020301/297152/';
const body = '地方政府公布住宅政策，協助居民了解房屋交易資訊，並定期公開市場調查與審查結果。'.repeat(8);
const spec = loadSources(overrides).find((source) => source.media === 'housefun')!;
// Reduced from the actual public MyHousing page: provider taxonomy belongs to
// the article; the separate byline widget and related links are not body text.
function page(provider = '好房網News') {
  return `<meta name="author" content="${provider}"><meta property="article:published_time" content="2026-10-01T01:51:15+00:00"><link rel="canonical" href="${url}"><div class="post type-post hentry byline-news"><div id="post"><div class="elementor-widget-theme-post-content"><div>${body}</div><div class="byline-widget">編輯介面</div><div>延伸閱讀→</div><div><a href="https://news.housefun.com.tw/news/article/172233489528.html">相關新聞標題</a></div></div></div></div>`;
}

describe('Housefun attributed partner collection', () => {
  it('keeps the fetched partner URL and publication time while extracting its own provider credit and full body', () => {
    const article = extractArticle(page(), url, spec.article);
    expect(article).toMatchObject({ body, bodyStatus: 'ok', provider: '好房網News', canonical: url });
    expect(article.publishedAt?.toISOString()).toBe('2026-10-01T01:51:15.000Z');
    expect(new RegExp(spec.article.provider!).test(article.provider!)).toBe(true);
  });

  it('rejects the partner’s own articles and missing article credits, even when Housefun appears in recommendations', () => {
    for (const provider of ['住展雜誌', '']) {
      const article = extractArticle(page(provider) + '<aside>好房網News</aside>', url, spec.article);
      expect(new RegExp(spec.article.provider!).test(article.provider ?? '')).toBe(false);
    }
    expect(extractArticle(page(), 'https://other.example/n/297152/').provider).toBeNull();
  });

  it('uses the publisher-specific feed and leaves provider validation pending for each article', async () => {
    const date = new Date(Date.now() - 3600000).toUTCString();
    const fetch = vi.fn().mockResolvedValue({
      status: 200,
      url: spec.list.urls[0].url,
      body: `<rss><channel><item><title>當日好房新聞測試標題</title><link>${url}</link><pubDate>${date}</pubDate><description>短篇摘要</description><dc:creator>住展雜誌 MyHousing</dc:creator><dc:creator>好房網News</dc:creator></item></channel></rss>`,
      contentType: 'application/rss+xml',
      ms: 1,
    });
    const result = await listSource(spec, fetch);
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ url, title: '當日好房新聞測試標題' });
    expect(result.items[0].verifiedContent).toBeUndefined();
    expect(spec.list.urls[0].url).toContain('/byline/%e5%a5%bd%e6%88%bf%e7%b6%b2news/feed/');
    expect(spec.list.autoDiscover).toBeUndefined();
  });
});
