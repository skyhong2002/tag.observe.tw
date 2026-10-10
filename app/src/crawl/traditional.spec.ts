import { describe, expect, it } from 'vitest';
import { toTraditional, traditionalizeArticle, traditionalizeFeedItem } from './traditional.ts';

describe('Traditional Chinese source conversion', () => {
  it('matches the publisher language switch conversion', () => {
    expect(toTraditional('中欧就混动汽车贸易达成谅解')).toBe('中歐就混動汽車貿易達成諒解');
  });

  it('converts feed and article text while preserving URLs and dates', () => {
    const url = 'https://www.zaobao.com.sg/news/china/story20261009-9812326';
    const publishedAt = new Date('2026-10-09T00:00:00Z');
    expect(traditionalizeFeedItem({ url, title: '中国汽车市场', publishedAt, tags: ['汽车', '贸易'] })).toMatchObject({
      url,
      title: '中國汽車市場',
      publishedAt,
      tags: ['汽車', '貿易'],
    });
    expect(
      traditionalizeArticle({
        title: '中国汽车市场',
        description: '相关消息受到关注。',
        summary: '这是摘要。',
        body: '这是汽车贸易的最新消息。',
        authors: ['联合早报编辑部'],
        tags: ['汽车'],
        image: null,
        canonical: url,
        publishedAt,
        provider: null,
        keywordSource: 'meta',
        bodySource: 'article',
        bodyStatus: 'ok',
        summarySource: 'meta',
      }),
    ).toMatchObject({
      title: '中國汽車市場',
      description: '相關消息受到關注。',
      summary: '這是摘要。',
      body: '這是汽車貿易的最新消息。',
      authors: ['聯合早報編輯部'],
      tags: ['汽車'],
    });
  });
});
