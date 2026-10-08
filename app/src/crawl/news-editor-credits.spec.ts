import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

const prose = '新北市政府與淡水社區辦理農村體驗活動，邀請企業團體與旅遊業者共商農村永續合作。';
const boUrl = 'https://www.bo6s.com.tw/news_detail.php?NewsID=117385';
const bo = `<head><title>農村永續合作 - 波新聞</title><meta property="og:url" content="${boUrl}"><meta name="description" content="波新聞─陶泰山編輯${prose}..."></head><body><article><div class="news-header"><h1 class="news-title">農村永續合作</h1><time datetime="2026-10-08T07:12:36"></time><div class="news-content"><p>波新聞─陶泰山編輯<br>${prose}完整結尾。</p></div></div></article><aside><p>波新聞─林小明編輯</p></aside></body>`;
const tvbsUrl = 'https://news.tvbs.com.tw/politics/4033128';
const tvbs = `<head><title>守護民主｜TVBS</title><link rel="canonical" href="${tvbsUrl}"></head><body><main><h1>守護民主</h1><header><li data-section="article-contributors"><span>編輯：易軍堯</span></li><li data-section="article-contributors"><span>編輯<!-- -->：<!-- -->易軍堯</span></li></header><div class="article-editor-content"><p>${prose}</p></div></main><aside><li data-section="article-contributors">編輯：林小明</li></aside></body>`;

it('recognizes the complete BO editor credit on its own opening line and cleans only the supplied matching summary prefix', () => {
  expect(extractArticle(bo, boUrl)).toMatchObject({
    authors: ['陶泰山'],
    summary: `${prose}...`,
    summarySource: 'meta:description',
    publishedAt: new Date('2026-10-07T23:12:36Z'),
  });
  expect(extractArticle(bo, boUrl).body).toContain('波新聞─陶泰山編輯');
  const unrelated = bo.replace(`content="波新聞─陶泰山編輯${prose}..."`, 'content="波新聞─陶泰山編輯另一篇的摘要..."');
  expect(extractArticle(unrelated, boUrl).summary).toBe('波新聞─陶泰山編輯另一篇的摘要...');
});

it('requires the BO own numeric identity, heading and complete role boundary rather than a prose mention', () => {
  for (const [page, address] of [
    [bo, 'https://example.com/news_detail.php?NewsID=117385'],
    [bo, 'https://www.bo6s.com.tw/news_detail.php?NewsID=117386'],
    [bo.replace('波新聞─陶泰山編輯<br>', '本文引用波新聞─陶泰山編輯<br>'), boUrl],
    [bo.replace('波新聞─陶泰山編輯<br>', '波新聞─陶泰山編輯提到<br>'), boUrl],
    [bo.replace('<h1 class="news-title">農村永續合作</h1>', '<h1 class="news-title">另一篇</h1>'), boUrl],
  ])
    expect(extractArticle(page, address).authors).not.toContain('陶泰山');
});

it('normalizes the own TVBS single editor contributor without including sidebar names or repeating mobile credits', () => {
  const parsed = extractArticle(tvbs, tvbsUrl, {
    bodySelector: '.article-editor-content',
    authorSelector: '[data-section="article-contributors"]',
  });
  expect(parsed.authors).toEqual(['易軍堯']);
  expect(parsed.body).toBe(prose);
  expect(parsed.publishedAt).toBeNull();
});

it('retains other declared TVBS contributor names and existing combined editor credits', () => {
  const mixed = tvbs.replace(
    '</header>',
    '<li data-section="article-contributors">陳冠宇</li><li data-section="article-contributors">編輯：公服組</li><li data-section="article-contributors">責任編輯：林大明</li><li data-section="article-contributors">編輯：王小明｜責任編輯：陳大文</li></header>',
  );
  expect(extractArticle(mixed, tvbsUrl).authors).toEqual(['易軍堯', '陳冠宇', '編輯：公服組', '王小明', '陳大文']);
});

it('requires the TVBS own canonical, main title and complete editing role', () => {
  for (const [page, address] of [
    [tvbs, 'https://example.com/politics/4033128'],
    [tvbs, 'https://news.tvbs.com.tw/politics/4033129'],
    [tvbs.replaceAll('編輯：易軍堯', '編輯：易軍堯提到').replace('編輯<!-- -->：<!-- -->易軍堯', '責任編輯：易軍堯'), tvbsUrl],
    [tvbs.replace('<h1>守護民主</h1>', '<h1>另一篇</h1>'), tvbsUrl],
  ])
    expect(extractArticle(page, address).authors).not.toContain('易軍堯');
});
