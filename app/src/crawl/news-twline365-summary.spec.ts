import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';

it('falls back from the imported legal-office keyword list to the news article own supplied OG excerpt', () => {
  const keywords =
    '高雄律師 台南律師 男律師 女律師 專業團隊 台灣律師 好的律師 推薦律師 認識律師 勝訴律師 訴訟律師 非訟律師 法律諮詢 法律問題 王瀚誼律師 莊曜隸律師 魏韻儒律師 民事案件 家事案件 刑事案件 行政案件 勞資案件 商務契約 公司法 保險法 證券交易法 民法 刑法 憲法 行政法 課程合作 保險法 證券交易法 公司';
  const excerpt = '墨新聞｜楊秉鈞 撰文：高雄律師，王瀚誼律師事務所。 大家好，我們今天要來和大家討論，關於雇主刊登徵才廣告時需要 […]';
  const html = `<meta name="description" content="${keywords}"><meta property="og:description" content="${excerpt}"><meta property="article:published_time" content="2026-10-08T06:35:00+08:00"><article><h1>雇主刊登徵才廣告須留心相關資訊</h1><p>撰文：高雄律師，王瀚誼律師事務所。</p><p>大家好，我們今天要來和大家討論，關於雇主刊登徵才廣告時需要注意的資訊。</p></article>`;
  const parsed = extractArticle(html, 'https://twline365.com/2026/10/1243927/');
  expect(parsed).toMatchObject({ summary: excerpt, summarySource: 'meta:og:description', publishedAt: new Date('2026-10-07T22:35:00Z') });
  expect(parsed.body).toContain('徵才廣告時需要注意的資訊');
  expect(
    extractArticle(html.replace(`<meta property="og:description" content="${excerpt}">`, ''), 'https://twline365.com/2026/10/1243927/')
      .summary,
  ).toBeNull();
  const meaningful = '高雄律師與台南律師共同說明徵才廣告的薪資揭露規定，並以法院判決解釋罰鍰要件。';
  expect(extractArticle(html.replace(keywords, meaningful), 'https://twline365.com/2026/10/1243927/').summary).toBe(meaningful);
});
