import { describe, expect, it } from 'vitest';
import { extractFeatureArticle } from './feature-article.ts';

describe('feature page content', () => {
  it.each([
    ['作者: 希望之聲TV , 文章內容謹代表作者個人觀點。節目介紹。', [], '希望之聲TV'],
    ['來源：美國之音, 文章內容並不代表本網立場和觀點。葉門軍隊取得進展。', [], '美國之音'],
    ['作者：古莉來源：RFI法廣，文章謹供參考，內容並不代表本網立場和觀點。葉門政府發表聲明。', ['古莉'], 'RFI法廣'],
  ])('reads the original Bannedbook credit %s instead of site editor metadata', (lead, authors, provider) => {
    const html = `<meta name="author" content="編輯團隊"><article><p>${lead}</p></article>`;
    const detail = extractFeatureArticle(html, 'https://www.bannedbook.org/bnews/zh-tw/worldnews/20261006/2366890.html');
    expect(detail.authors).toEqual(authors);
    expect(detail.provider).toBe(provider);
    expect(detail.body).toBe(lead);
  });
  it('does not infer a provider from an ordinary Bannedbook paragraph or suppress other publisher institutional credits', () => {
    const html =
      '<meta name="author" content="編輯團隊"><article><p>官方發表聲明。來源：美國之音, 文章內容並不代表本網立場和觀點。</p></article>';
    expect(extractFeatureArticle(html, 'https://www.bannedbook.org/bnews/zh-tw/worldnews/20261006/2366890.html').provider).toBeNull();
    expect(extractFeatureArticle(html, 'https://example.com/report').authors).toEqual(['編輯團隊']);
  });
  it('reads only the matching reporter topic introduction, date and cover, not linked story text or tags', () => {
    const text = '這是專題導言，保留全形標點。'.repeat(20);
    const html = `<meta property="og:image" content="https://www.twreporter.org/cover.jpg"><script>window.__REDUX_STATE__=${JSON.stringify({
      entities: {
        posts: { byId: { other: { tags: [{ name: '子文章標籤' }], body: '不屬於導言' } } },
        topics: {
          byId: {
            wrong: { slug: 'other', description: { api_data: [{ type: 'unstyled', content: ['其他專題'] }] } },
            right: {
              slug: 'test',
              published_date: '2020-01-01T00:00:00Z',
              title: '專題',
              description: {
                api_data: [
                  { type: 'unstyled', content: [text] },
                  { type: 'image', content: ['不當成內文'] },
                ],
              },
            },
          },
        },
      },
    })};</script>`;
    const result = extractFeatureArticle(html, 'https://www.twreporter.org/topics/test', { jsonTags: 'tags' });
    expect(result.body).toBe(text);
    expect(result.tags).toEqual([]);
    expect(result.bodyStatus).toBe('ok');
    expect(result.publishedAt?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    expect(result.image).toBe('https://www.twreporter.org/cover.jpg');
  });
  it('preserves a short UDN editorial introduction without collecting news card summaries', () => {
    const intro = '聯合報深入追蹤這項議題，剖析制度與第一線的挑戰，記錄事件來龍去脈及當事人的故事。'.repeat(2);
    const result = extractFeatureArticle(
      `<div class="container-content"><p class="content">${intro}</p></div><div class="card-text"><p class="card-content">這是另一篇新聞的摘要，不是本頁正文。</p></div>`,
      'https://topic.udn.com/issue/cards/test',
    );
    expect(result.body).toBe(intro);
    expect(result.bodyStatus).toBe('short');
  });
  it('does not invent a body from a collection of links', () => {
    const result = extractFeatureArticle(
      '<main><a href="/news/1">新聞標題</a><a href="/news/2">第二則新聞標題</a></main>',
      'https://example.com/feature',
    );
    expect(result.body).toBeNull();
  });
});
