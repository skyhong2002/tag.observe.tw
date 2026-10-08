import { describe, expect, it } from 'vitest';
import type { fetchText } from './fetch.ts';
import { discoverNews } from './news-discovery.ts';
import { discoverMsn, msnArticle, msnFeedArticles, msnPublicFeedKey, msnTvbsSource } from './news-msn.ts';

const candidate = { id: 'AA123456', url: 'https://www.msn.com/zh-tw/news/other/example/ar-AA123456' };
const now = new Date('2026-10-03T13:00:00Z');
const body = '公開新聞記者在現場訪問多位居民，完整報導事件原因、後續影響及相關回應。'.repeat(8);
const detail = {
  ...candidate,
  title: 'MSN 上公開閱讀的完整新聞',
  locale: 'zh-tw',
  type: 'article',
  renderingRestriction: 0,
  subscriptionProductType: 0,
  publishedDateTime: '2026-10-02T10:00:00Z',
  updatedDateTime: '2026-10-03T11:00:00Z',
  createdDateTime: '2026-10-02T12:00:00Z',
  provider: { name: '真正供稿新聞社', isPremium: true },
  sourceHref: 'https://publisher.example/news/original',
  body: `<p>${body}</p><p>完整報導最後一段。</p>`,
};
const feed = { value: [{ subCards: [{ ...candidate, locale: 'zh-tw', type: 'article' }] }] };
const anonymousKey = 'PublicAnonymousFeedValue1234567890';
const bundle = `let a="${anonymousKey}";function s(t){t.set("apikey",a)}const path="service/news/feed";`;
const home = '<script src="https://assets.msn.com/bundles/v1/hub/latest/common.abcdef123.js"></script>';

describe('MSN anonymous public reader', () => {
  it('resolves a mixed TVBS partner credit only through exact original identity, reporter role and complete own prose', () => {
    const own = {
      ...detail,
      provider: { name: 'TVBS新聞網' },
      sourceHref: 'https://news.tvbs.com.tw/local/123456',
      authors: [{ name: '陳小明 王小華 新聞中心' }],
      body: detail.body.replace('完整報導最後一段。', '完整報導最後一段，持續說明居民與相關機關回應以及後續的事件處理。'),
    };
    const original = `<link rel="canonical" href="${own.sourceHref}"><main><h1 data-section="article-title">${detail.title}</h1><li data-section="article-contributors"><span class="caption-12-medium">記者：陳小明｜攝影：王小華｜責任編輯：新聞中心</span></li><div class="article-editor-content">${own.body}</div></main>`;
    const parsed = msnArticle(own, candidate, now, false, original);
    expect(parsed?.verifiedContent?.authors).toEqual(['TVBS新聞網', '陳小明']);
    expect(parsed?.verifiedContent?.body).toBe(msnArticle(own, candidate, now)?.verifiedContent?.body);
    expect(parsed?.publishedAt).toEqual(msnArticle(own, candidate, now)?.publishedAt);
    expect(parsed?.summary).toBe(msnArticle(own, candidate, now)?.summary);
    for (const html of [
      original.replace('href="' + own.sourceHref, 'href="https://news.tvbs.com.tw/local/999999'),
      original.replace(detail.title, '另一篇文章'),
      original.replace('記者：陳小明', '攝影：陳小明'),
      original.replace('攝影：王小華', '攝影：其他人'),
      original.replace(body, '不相符的完整正文'),
      original.replace(
        '</main>',
        '<li data-section="article-contributors"><span class="caption-12-medium">記者：其他人</span></li></main>',
      ),
    ])
      expect(msnArticle(own, candidate, now, false, html)?.verifiedContent?.authors).toEqual(['TVBS新聞網', '陳小明 王小華 新聞中心']);
    for (const value of [
      { ...own, provider: { name: '其他媒體' } },
      { ...own, sourceHref: 'https://news.tvbs.com.tw.example/local/123456' },
      { ...own, sourceHref: 'http://news.tvbs.com.tw/local/123456' },
      { ...own, sourceHref: 'https://news.tvbs.com.tw/about' },
      { ...own, authors: [{ name: '陳小明 王小華 新聞中心 提到' }] },
    ])
      expect(msnTvbsSource(value)).toBeNull();
  });

  it('normalizes the complete Newtalk partner writer declaration only for its own provider and source article', () => {
    const credit = 'Newtalk新聞 |張柏源 綜合報導';
    const own = {
      ...detail,
      provider: { name: '新頭殼' },
      sourceHref: 'http://newtalk.tw/news/view/2026-10-02/1064345',
      authors: [{ name: credit }],
    };
    const parsed = msnArticle(own, candidate, now);
    expect(parsed?.verifiedContent?.authors).toEqual(['新頭殼', '張柏源']);
    expect(parsed?.creator).toBe('新頭殼');
    expect(parsed?.verifiedContent?.body).toBe(msnArticle(detail, candidate, now)?.verifiedContent?.body);
    expect(parsed?.publishedAt).toEqual(msnArticle(detail, candidate, now)?.publishedAt);
    for (const value of [
      { ...own, provider: { name: '其他供稿媒體' } },
      { ...own, sourceHref: 'https://newtalk.tw.example/news/view/2026-10-02/1064345' },
      { ...own, sourceHref: 'https://newtalk.tw/about' },
      { ...own, authors: [{ name: 'Newtalk新聞 |張柏源 提到綜合報導' }] },
    ])
      expect(msnArticle(value, candidate, now)?.verifiedContent?.authors).toContain(value.authors[0].name);
  });
  it('splits explicit reporter datelines in the public author field while retaining provider and other credits', () => {
    const authors = [{ name: '洪凱音、黃琮淵╱台北報導' }, { name: '陳凱俊' }, { name: '財經中心' }, { name: '' }];
    const item = msnArticle({ ...detail, authors }, candidate, now);
    expect(item?.verifiedContent?.authors).toEqual(['真正供稿新聞社', '洪凱音', '黃琮淵', '陳凱俊', '財經中心']);
    expect(item?.creator).toBe('真正供稿新聞社');
    expect(item?.verifiedContent?.body).toBe(msnArticle(detail, candidate, now)?.verifiedContent?.body);
    expect(item?.publishedAt).toEqual(msnArticle(detail, candidate, now)?.publishedAt);
    expect(msnArticle({ ...detail, authors: [{ name: '洪凱音、黃琮淵╱台北指控' }] }, candidate, now)?.verifiedContent?.authors).toEqual([
      '真正供稿新聞社',
      '洪凱音、黃琮淵╱台北指控',
    ]);
  });
  it('retains the matching public detail abstract separately from provider credit without generating a body excerpt', () => {
    const abstract = '原站提供的新聞摘要，保留其截斷…';
    expect(msnArticle({ ...detail, abstract }, candidate, now)).toMatchObject({
      summary: abstract,
      summarySource: 'api:msn:abstract',
      description: `供稿來源：真正供稿新聞社。原文：${detail.sourceHref}`,
    });
    for (const abstract of [undefined, '', detail.title, 'x'.repeat(4001)]) {
      expect(msnArticle({ ...detail, abstract }, candidate, now)).toMatchObject({ summary: null, summarySource: null });
    }
    expect(msnArticle({ ...detail, abstract, id: 'AAwrong123' }, candidate, now)).toBeNull();
    expect(msnArticle({ ...detail, abstract, renderingRestriction: 1 }, candidate, now)).toBeNull();
  });
  it('extracts the published date and complete partner text without confusing provider premium status with access restrictions', () => {
    const item = msnArticle(detail, candidate, now);
    expect(item?.publishedAt?.toISOString()).toBe('2026-10-02T10:00:00.000Z');
    expect(item?.verifiedContent?.body).toContain(body);
    expect(item?.verifiedContent?.body).toContain('完整報導最後一段。');
    expect(item?.verifiedContent?.authors).toEqual(['真正供稿新聞社']);
    expect(item?.creator).toBe('真正供稿新聞社');
    expect(item?.description).toContain(detail.sourceHref);
  });
  it.each([
    { renderingRestriction: 1 },
    { subscriptionProductType: 1 },
    { isAccessibleForFree: false },
    { isPaywalled: true },
    { locale: 'ja-jp' },
    { type: 'video' },
    { id: 'AAwrong123' },
    { publishedDateTime: '' },
    { publishedDateTime: '2026-12-01T00:00:00Z' },
    { body: '', abstract: body },
    { body: '<p>新聞摘要，請訂閱閱讀全文。</p>' },
    { body: `<p>${body}</p><div id="paywall">付費才能閱讀</div>` },
  ])('rejects restricted, incomplete or mismatched content: %j', (change) => {
    expect(msnArticle({ ...detail, ...change }, candidate, now)).toBeNull();
  });
  it('accepts older public articles only under the archive policy and never uses updatedDateTime', () => {
    const old = { ...detail, publishedDateTime: '2024-10-16T02:00:00Z' };
    expect(msnArticle(old, candidate, now)).toBeNull();
    expect(msnArticle(old, candidate, now, true)?.publishedAt?.toISOString()).toBe('2024-10-16T02:00:00.000Z');
  });
  it('accepts only Taiwan article cards with matching first-party URLs and IDs', () => {
    const valid = feed.value[0].subCards[0];
    expect(
      msnFeedArticles({
        value: [
          {
            subCards: [
              valid,
              valid,
              { ...valid, locale: 'ja-jp' },
              { ...valid, url: 'https://example.com/ar-AA123456' },
              { ...valid, type: 'video' },
            ],
          },
        ],
      }),
    ).toEqual([candidate]);
  });
  it('reads only the anonymous feed key from its public bundle use without evaluating scripts', () => {
    expect(msnPublicFeedKey(bundle)).toBe(anonymousKey);
    expect(msnPublicFeedKey(`let a="${anonymousKey}";sendUserToken(a);`)).toBeNull();
    expect(msnPublicFeedKey(`let a="${anonymousKey}";x.set("apikey",a);`)).toBeNull();
  });
  it('discovers a full article from the public feed and unauthenticated reader API', async () => {
    const requested: string[] = [];
    const fetch: typeof fetchText = async (url) => {
      requested.push(url);
      const body = url.includes('/bundles/')
        ? bundle
        : url.includes('/service/news/feed')
          ? JSON.stringify(feed)
          : url.includes('/content/view/')
            ? JSON.stringify(detail)
            : home;
      return { url, status: 200, body, contentType: 'text/html', ms: 1 };
    };
    const result = await discoverMsn({ homeUrl: 'https://www.msn.com/zh-tw/news' }, { fetch, now: () => now });
    expect(result.items).toHaveLength(1);
    expect(result.strategy).toBe('api');
    expect(result.attempted).toBe(4);
    expect(requested[2]).toContain(`apikey=${anonymousKey}`);
    expect(result.listingUrl).toBe('https://www.msn.com/zh-tw/news');
    expect(JSON.stringify(result)).not.toContain(anonymousKey);
  });
  it('uses a bounded partner request for ambiguous credits and preserves the article when proof is unavailable', async () => {
    const own = {
      ...detail,
      provider: { name: 'TVBS新聞網' },
      sourceHref: 'https://news.tvbs.com.tw/local/123456',
      authors: [{ name: '陳小明 王小華 新聞中心' }],
      body: `<p>${body}</p><p>${body}</p>`,
    };
    const original = `<link rel="canonical" href="${own.sourceHref}"><main><h1 data-section="article-title">${own.title}</h1><li data-section="article-contributors"><span class="caption-12-medium">記者：陳小明｜攝影：王小華｜責任編輯：新聞中心</span></li><div class="article-editor-content">${own.body}</div></main>`;
    for (const mode of ['verified', '403', 'redirect', 'budget']) {
      const requested: string[] = [];
      const fetch: typeof fetchText = async (url) => {
        requested.push(url);
        const partner = url === own.sourceHref;
        return {
          url: partner && mode === 'redirect' ? 'https://news.tvbs.com.tw/local/999999' : url,
          status: partner && mode === '403' ? 403 : 200,
          body: partner
            ? original
            : url.includes('/bundles/')
              ? bundle
              : url.includes('/service/news/feed')
                ? JSON.stringify(feed)
                : url.includes('/content/view/')
                  ? JSON.stringify(own)
                  : home,
          contentType: 'text/html',
          ms: 1,
        };
      };
      const result = await discoverMsn(
        { homeUrl: 'https://www.msn.com/zh-tw/news' },
        { fetch, now: () => now, maxRequests: mode === 'budget' ? 4 : 5 },
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].verifiedContent?.authors).toEqual(
        mode === 'verified' ? ['TVBS新聞網', '陳小明'] : ['TVBS新聞網', '陳小明 王小華 新聞中心'],
      );
      expect(requested).toHaveLength(mode === 'budget' ? 4 : 5);
      expect(result.items[0].verifiedContent?.body).toBe(msnArticle(own, candidate, now)?.verifiedContent?.body);
    }
  });

  it('uses this adapter through the standard discovery entrypoint', async () => {
    const fetch: typeof fetchText = async (url) => ({
      url,
      status: 200,
      body: url.includes('/bundles/')
        ? bundle
        : url.includes('/service/news/feed')
          ? JSON.stringify(feed)
          : url.includes('/content/view/')
            ? JSON.stringify(detail)
            : home,
      contentType: 'text/html',
      ms: 1,
    });
    const result = await discoverNews({ homeUrl: 'https://www.msn.com/zh-tw/news' }, { fetch, now: () => now });
    expect(result.strategy).toBe('api');
    expect(result.items[0]?.verifiedContent?.body).toContain('完整報導最後一段。');
  });
  it('does not retain unsafe original-source URLs', () => {
    for (const sourceHref of ['javascript:alert(1)', 'https://user:secret@publisher.example/news']) {
      expect(msnArticle({ ...detail, sourceHref }, candidate, now)?.description).toBe('供稿來源：真正供稿新聞社。');
    }
  });
  it('stops after rate limiting and respects source scope', async () => {
    let requests = 0;
    const fetch: typeof fetchText = async (url) => {
      requests++;
      return { url, status: 429, body: '', contentType: 'text/html', ms: 1 };
    };
    expect((await discoverMsn({ homeUrl: 'https://www.msn.com/zh-tw/news' }, { fetch })).items).toEqual([]);
    expect(requests).toBe(1);
    await discoverMsn({ homeUrl: 'https://unrelated.example/' }, { fetch });
    expect(requests).toBe(1);
  });
});
