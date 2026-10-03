import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { extractArticleContent } from './article-content.ts';
import type { FetchResult } from './fetch.ts';
import { discoverNews } from './news-discovery.ts';
import { publicArticleHtml } from './news-public-html.ts';
import { renderWsjNewsletter } from './news-wsj-newsletter.ts';

const url = 'https://china.createsend1.com/t/j-e-ydlrkkiy-hynykddkd-r/';
const alternate = 'https://china.cmail19.com/t/j-e-ydlrkkiy-hynykddkd-r';
const text = '這是公開報導的中間段落，測試擷取保留取得的原文，不能以預存全文取代目前發布的內容。'.repeat(4);
const p = (value: string) => `<p>${value}</p>`;
const fixture = () => {
  const rows = Array<string>(20).fill('<td></td>');
  rows[0] =
    '<td><div class="icon-left__h2"><h2>别再轻信：美国商界提出对华新策略</h2></div><div class="icon-left__h3"><h3>魏玲灵</h3></div></td>';
  rows[1] = '<td><h2>10月8日</h2></td>';
  rows[3] = `<td class="email-body__article">${p('美国总统特朗普的谈判代表正试图与北京达成一项新的贸易协议。')}${p(text).repeat(6)}${p('一边大谈多边主义，一边却在打一场经济消耗战。')}</td>`;
  rows[4] = '<td><h2>前进之路？</h2></td>';
  rows[5] = `<td class="email-body__article">${p('以下是美国商会建议的策略：首先，通过一些速赢方案建立好感。')}${p(text).repeat(5)}${p('更是对中国政府二十年来背弃承诺的裁决。')}</td>`;
  rows[7] = '<td><h1>本周要闻</h1></td>';
  rows[8] = '<td class="email-body__article"><p>不能混入其他新聞摘要</p></td>';
  rows[17] = '<td><h1>关于我们</h1></td>';
  rows[18] = '<td>《华尔街日报》中国洞察新闻简报由本报首席中国记者魏玲灵主笔</td>';
  return `<img alt="WSJ China"><a href="${url}">通过浏览器查看</a><table><tr><td class="stage-in"><table class="email-body">${rows.map((row) => `<tr>${row}</tr>`).join('')}</table></td></tr></table><footer>[email address suppressed] Copyright 2025 Dow Jones &amp; Company, Inc.</footer>`;
};

describe('reviewed public WSJ Chinese newsletter', () => {
  it('retains the complete fetched main article with a corroborated date-only publication', () => {
    const result = renderWsjNewsletter(fixture(), alternate);
    expect(result).not.toBeNull();
    const $ = cheerio.load(result!);
    expect($('link[rel=canonical]').attr('href')).toBe(url);
    expect($('meta[property="article:published_time"]').attr('content')).toBe('2025-10-08');
    expect($('meta[name=author]').attr('content')).toBe('魏玲灵');
    const content = extractArticleContent($, url, {});
    expect(content.bodyStatus).toBe('ok');
    expect(content.body).toContain(text);
    expect(content.body).toContain('前进之路？');
    expect(content.body).toContain('更是对中国政府二十年来背弃承诺的裁决。');
    expect(content.body).not.toContain('不能混入其他新聞摘要');
    expect(content.body).not.toContain('[email address suppressed]');
  });

  it('keeps identical full text through discovery and later article ingestion', async () => {
    const html = fixture();
    const rendered = publicArticleHtml(html, url);
    expect(publicArticleHtml(rendered, url)).toBe(rendered);
    const article = extractArticle(html, url);
    expect(article.bodyStatus).toBe('ok');
    expect(article.publishedAt?.toISOString()).toBe('2025-10-08T00:00:00.000Z');
    const fetch = async (requested: string): Promise<FetchResult> => ({
      url: requested,
      status: 200,
      body: html,
      contentType: 'text/html',
      ms: 1,
    });
    const result = await discoverNews(
      { homeUrl: 'https://china.createsend1.com/', articleUrls: [url], includeArchive: true, maxArticles: 1 },
      { fetch, now: () => new Date('2026-10-03T00:00:00Z') },
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].verifiedContent?.body).toBe(article.body);
    expect(result.items[0].publishedAt?.toISOString()).toBe('2025-10-08T00:00:00.000Z');
    expect(extractArticle(html.replace('10月8日', '10月9日'), url).bodyStatus).toBe('missing');
  });

  it.each([
    ['title', '别再轻信：美国商界提出对华新策略', '其他新闻'],
    ['date', '10月8日', '10月9日'],
    ['author', '魏玲灵', '其他作者'],
    ['publisher', 'WSJ China', 'Other newsletter'],
    ['public version', '[email address suppressed]', 'private subscriber'],
    ['complete ending', '更是对中国政府二十年来背弃承诺的裁决。', '阅读更多请订阅'],
    ['structure', '<h2>前进之路？</h2>', '<h2>不同章节</h2>'],
  ])('rejects changed %s evidence', (_reason, oldValue, newValue) => {
    expect(renderWsjNewsletter(fixture().replaceAll(oldValue, newValue), url)).toBeNull();
  });

  it('does not infer a year for unreviewed issues or accept an unrelated host', () => {
    for (const other of [
      url.replace('ydlrkkiy', 'otherissue'),
      url.replace('china.createsend1.com', 'unrelated.test'),
      `${url}?issue=other`,
    ]) {
      expect(renderWsjNewsletter(fixture(), other)).toBeNull();
    }
    expect(renderWsjNewsletter(fixture().replace('Copyright 2025', 'Copyright 2026'), url)).toBeNull();
  });
});
