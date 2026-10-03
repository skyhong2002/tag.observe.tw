import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { ENN_NEWS_SITES } from './news-enn.ts';

const provider = /^【台灣電報記者[^】]{1,60}報導】$/;
const rule = ENN_NEWS_SITES[0];
const story = (lead: string, rest = '') => `<aside>【台灣電報記者某人/台中報導】</aside>
<article class="ak-article"><h1 class="ak-post-title">新聞標題</h1><div class="ak-article-inner"><div class="ak-post-content"><p>${lead}</p><p>${'這是有完整細節的公開新聞正文。'.repeat(30)}</p>${rest}</div></div></article>`;

describe('ENN same-group public article credit', () => {
  it('accepts the actual lead reporter credit and keeps complete text', () => {
    const article = extractArticle(story('【台灣電報記者廖宥婷/台中報導】'), 'https://17news.net/archives/340971');
    expect(provider.test(article.provider ?? '')).toBe(true);
    expect(article.body).toContain('這是有完整細節的公開新聞正文。');
    expect(rule.path.test('/archives/340971')).toBe(true);
    expect(rule.path.test('/archives/category/place')).toBe(false);
  });
  it('rejects ENN mentions in later paragraphs or sidebars when the lead has another byline', () => {
    const article = extractArticle(
      story('【其他媒體記者/台中報導】', '<p>【台灣電報記者廖宥婷/台中報導】</p>'),
      'https://17news.net/archives/340971',
    );
    expect(article.provider).toBe('【其他媒體記者/台中報導】');
    expect(provider.test(article.provider ?? '')).toBe(false);
  });
});
