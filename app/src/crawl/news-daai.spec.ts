import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { daaiNewsRecord } from './news-daai.ts';
import { publicArticleHtml } from './news-public-html.ts';

const prose = '這是新聞逐字稿，介紹受災居民的生活、學生復課與社區重建計畫。'.repeat(12);
const record = (id: number, description = prose) => {
  const row = { NewsID: id, Title: '重建計畫新聞', Description: description };
  return `<script>var news = '${JSON.stringify(JSON.stringify(row)).slice(1, -1)}';</script>`;
};

describe('Daai public modal records', () => {
  it('uses only the NewsID matching the article URL and excludes a full-transcript description from summary', () => {
    const html = `<meta property="og:title" content="重建計畫新聞"><meta name="description" content="${prose}">${record(2, '無關推薦')}${record(1)}`;
    const result = extractArticle(html, 'https://www.daai.tv/news/1');
    expect(result.body).toBe(prose);
    expect(result.bodyStatus).toBe('ok');
    expect(result.summary).toBeNull();
    expect(result.summarySource).toBeNull();
    expect(result.title).toBe('重建計畫新聞');
  });

  it('keeps a separate publisher summary and does not turn a recommendation into the requested article', () => {
    expect(extractArticle(`<meta name="description" content="獨立新聞摘要">${record(1)}`, 'https://www.daai.tv/news/1').summary).toBe(
      '獨立新聞摘要',
    );
    expect(extractArticle(record(2), 'https://www.daai.tv/news/1').body).toBeNull();
    expect(publicArticleHtml(record(1), 'https://www.daai.tv/news')).toBe(record(1));
    expect(daaiNewsRecord("var news = 'invalid';", 1)).toBeNull();
  });

  it('renders the JSON once without executing publisher JavaScript or allowing markup to escape the data block', () => {
    const html = record(1, `${prose}</script><p>原文內文</p>`);
    const once = publicArticleHtml(html, 'https://www.daai.tv/news/1');
    expect(publicArticleHtml(once, 'https://www.daai.tv/news/1')).toBe(once);
    expect(once).toContain('\\u003c/script>');
  });
});
