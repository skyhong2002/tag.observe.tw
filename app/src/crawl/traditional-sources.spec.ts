import { describe, expect, it } from 'vitest';
import scope from '../../data/media-scope.json' with { type: 'json' };
import { extractAttributions } from '../similarity/attribution.ts';
import type { FetchResult } from './fetch.ts';
import { discoverNews } from './news-discovery.ts';
import { sourceByMedia } from './registry.ts';
import { toTraditional } from './traditional.ts';

const samples = [
  ['rfa', 'https://www.rfa.org/mandarin/yataibaodao/2026/10/10/taiwan-double10th-laiqinde/'],
  ['voachinese', 'https://www.voachinese.com/a/taiwan-national-day-20261010/8209700.html'],
  ['thepaper', 'https://www.thepaper.cn/newsDetail_forward_34224652'],
  ['xinhua', 'https://www.news.cn/sci-tech/20261010/52c2ae21e4ac4510924cf5c10fbc5ad6/c.html'],
] as const;
const headline = '中国汽车贸易与台湾政策最新进展';
const summary = '中国汽车贸易持续发展，相关政策引起关注。';
const body = '中国汽车贸易持续发展，记者查证相关资料并采访专家，为读者提供完整新闻和背景分析。'.repeat(8);
const date = '2026-10-10T06:00:00.000Z';
const page = (url: string, provider?: string) => `
  <meta property="og:title" content="${headline}">
  <meta property="og:description" content="${summary}">
  <meta property="article:published_time" content="${date}">
  <meta name="keywords" content="汽车,贸易">
  <script type="application/ld+json">${JSON.stringify({
    '@type': 'NewsArticle',
    url,
    headline,
    articleBody: body,
    author: { '@type': 'Person', name: '陈华' },
  })}</script>
  <h1>${headline}</h1>
  ${
    provider
      ? `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
          props: {
            pageProps: {
              contId: 34224652,
              detailData: { contentDetail: { contId: 34224652, name: headline, author: provider, originalFlag: '2' } },
            },
          },
        })}</script><main><h1>${headline}</h1><div class="headerContent__test"><div class="left__test"><div>${provider}</div></div></div></main>`
      : ''
  }`;

describe('reviewed sources collected in Traditional Chinese', () => {
  it.each(samples)('converts %s RSS and page fields while preserving URL and publication', async (media, url) => {
    const source = sourceByMedia(media)!;
    expect(source.traditional).toBe(true);
    expect(source.list.autoDiscover?.traditional).toBe(true);
    expect(scope.media[media].language).toBe('zh-Hant');
    const feed = new URL('/test-feed.xml', source.list.autoDiscover!.homeUrl).href;
    const result = await discoverNews(
      { ...source.list.autoDiscover!, feedUrls: [feed], feedOnly: true },
      {
        now: () => new Date('2026-10-10T08:00:00Z'),
        fetch: async (requested): Promise<FetchResult> => ({
          url: requested,
          status: 200,
          body:
            requested === feed
              ? `<rss><channel><item><link>${url}</link><title>${headline}</title><pubDate>${date}</pubDate><category>贸易</category><description>${summary}</description><dc:creator>陈华</dc:creator></item></channel></rss>`
              : page(url),
          contentType: requested === feed ? 'application/xml' : 'text/html',
          ms: 1,
        }),
      },
    );
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      url,
      publishedAt: new Date(date),
      title: toTraditional(headline),
      description: toTraditional(summary),
      summary: toTraditional(summary),
      creator: '陳華',
      tags: ['汽車', '貿易'],
      verifiedContent: { body: toTraditional(body), authors: ['陳華'], bodyStatus: 'ok' },
    });
  });

  it('preserves The Paper partner identity after converting article text', async () => {
    const url = samples[2][1];
    const source = sourceByMedia('thepaper')!;
    const result = await discoverNews(
      { ...source.list.autoDiscover!, articleUrls: [url] },
      {
        now: () => new Date('2026-10-10T08:00:00Z'),
        fetch: async (requested): Promise<FetchResult> => ({
          url: requested,
          status: 200,
          body: page(url, '禹琳/经济日报'),
          contentType: 'text/html',
          ms: 1,
        }),
      },
    );
    expect(result.items).toHaveLength(1);
    const article = result.items[0];
    expect(article.verifiedProvider).toBe('经济日报');
    expect(extractAttributions(article.verifiedContent!.body, 'thepaper', article.verifiedProvider)).toEqual([
      expect.objectContaining({ media: 'economic_daily_thepaper', countryCode: 'ZZ' }),
    ]);
  });
});
