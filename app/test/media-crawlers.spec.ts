import { describe, expect, it } from 'vitest';
import { crawlerTags, emptyCrawlerFilters, type MediaCrawler, selectCrawlers, summaryTags } from '../../web/src/lib/media-crawlers.mts';

const rows: MediaCrawler[] = [
  {
    media: 'alpha',
    title: 'Alpha',
    country: '台灣',
    countryCode: 'TW',
    schedule: 'hourly',
    crawler: {
      methods: ['RSS／Atom／XML feed'],
      transport: 'HTTP（Undici；必要時 curl）',
      body: '擷取正文（逐篇驗證）',
      lastVerifiedMethod: null,
      links: [{ label: '來源設定', url: 'https://example.com/a' }],
    },
  },
  {
    media: 'beta',
    title: 'Beta',
    country: '日本',
    countryCode: 'JP',
    schedule: 'hourly',
    crawler: {
      methods: ['公開 JSON API', '自動探索 RSS／Sitemap／HTML'],
      transport: 'curl',
      body: '標題／摘要／影片資料',
      lastVerifiedMethod: 'RSS／Atom',
      links: [{ label: '解析程式', url: 'https://example.com/b' }],
    },
  },
  { media: 'gamma', title: 'Gamma', country: '台灣', countryCode: 'TW', schedule: 'off' },
];

describe('crawler directory filters and sorting', () => {
  it('keeps discovery separate from verified strategies and distinguishes fallback tools', () => {
    expect(crawlerTags(rows[0]).tools).toEqual(['Undici', 'curl（備援）']);
    expect(crawlerTags(rows[1]).methods).toEqual(['JSON API', '自動探索']);
    expect(crawlerTags(rows[1]).tools).toEqual(['curl']);
    expect(crawlerTags(rows[2]).content).toEqual(['未設定']);
  });

  it('ORs choices within a group and ANDs groups with search', () => {
    const filters = { ...emptyCrawlerFilters(), methods: ['RSS／Atom', 'JSON API'] };
    expect(selectCrawlers(rows, '', filters, 'title', false).map((row) => row.media)).toEqual(['alpha', 'beta']);
    expect(selectCrawlers(rows, '', { ...filters, tools: ['curl'] }, 'title', false).map((row) => row.media)).toEqual(['beta']);
    expect(selectCrawlers(rows, '台灣', { ...filters, tools: ['curl'] }, 'title', false)).toEqual([]);
    expect(selectCrawlers(rows, '  ALPHA ', filters, 'title', false).map((row) => row.media)).toEqual(['alpha']);
    expect(selectCrawlers(rows, '逐篇驗證', emptyCrawlerFilters(), 'title', false).map((row) => row.media)).toEqual(['alpha']);
  });

  it('sorts every displayed column both ways without modifying the API rows', () => {
    for (const key of ['title', 'methods', 'tools', 'content', 'code'] as const) {
      const asc = selectCrawlers(rows, '', emptyCrawlerFilters(), key, false);
      const desc = selectCrawlers(rows, '', emptyCrawlerFilters(), key, true);
      expect(desc.map((row) => row.media)).toEqual(asc.map((row) => row.media).reverse());
    }
    expect(rows.map((row) => row.media)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('adds observed summaries to collected content and keeps source names searchable', () => {
    const summaries = [
      { ...rows[0], summary: { total: 4, withSummary: 3, sources: ['article:selector', 'meta:description'], exampleId: 7 } },
      { ...rows[1], summary: { total: 2, withSummary: 2, sources: ['feed:description'], exampleId: 8 } },
      { ...rows[2], summary: { total: 2, withSummary: 0, sources: [], exampleId: null } },
    ];
    expect(selectCrawlers(summaries, '原文導言', emptyCrawlerFilters(), 'title', false).map((r) => r.media)).toEqual(['alpha']);
    expect(selectCrawlers(summaries, '供稿摘要', emptyCrawlerFilters(), 'title', false).map((r) => r.media)).toEqual(['beta']);
    expect(selectCrawlers(summaries, '', { ...emptyCrawlerFilters(), content: ['摘要'] }, 'title', false).map((r) => r.media)).toEqual([
      'alpha',
      'beta',
    ]);
    expect(crawlerTags(summaries[0]).content).toEqual(['正文', '摘要']);
    expect(crawlerTags(summaries[2]).content).not.toContain('摘要');
    expect(crawlerTags({ ...summaries[0], sourceKind: 'discovery' }).content).not.toContain('摘要');
    expect(summaryTags(summaries[2])).toEqual(['未取得摘要']);
    expect(summaryTags({ ...rows[2], summary: { total: 0, withSummary: 0, sources: [], exampleId: null } })).toEqual(['期間無文章']);
    expect(summaryTags(rows[2])).toEqual(['尚無摘要統計']);
    expect(summaryTags({ ...summaries[0], sourceKind: 'discovery' })).toEqual(['見原媒體']);
  });
});
