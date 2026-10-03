import { describe, expect, it } from 'vitest';
import { resolveCatalogSource } from '../../../web/src/lib/media-traffic.mts';
import mediaCatalog from '../../data/media-catalog.json' with { type: 'json' };
import traffic from '../../data/media-traffic.json' with { type: 'json' };
import newsCatalog from '../../data/news-source-catalog.json' with { type: 'json' };
import baseline from '../../data/traffic-baseline.json' with { type: 'json' };
import { addNewsSources, type NewsCrawlAudit, type NewsSource } from './news-sources.ts';
import type { SourceSpec } from './sources.ts';

const candidate = (patch: Partial<NewsSource> = {}): NewsSource => ({
  media: 'local-news',
  name: '地方新聞',
  websiteUrl: 'https://local.example/',
  referenceNames: ['地方新聞'],
  referenceRows: [200],
  existing: false,
  websiteEvidence: 'https://local.example/about',
  notes: '',
  ...patch,
});

const proof = (patch: Partial<NewsCrawlAudit> = {}): NewsCrawlAudit => ({
  media: 'local-news',
  websiteUrl: 'https://local.example/',
  checkedAt: '2026-10-03T00:00:00.000Z',
  status: 'verified',
  strategy: 'rss',
  listingUrl: 'https://local.example/feed/',
  articleCount: 1,
  detail: '已驗證文章標題、日期與內文',
  samples: [
    {
      url: 'https://local.example/news/123',
      title: '地方新聞測試文章',
      publishedAt: '2026-10-02T12:00:00.000Z',
      bodyLength: 500,
    },
  ],
  ...patch,
});

describe('news source registration gates', () => {
  it('preserves existing adapter identity and all custom rules even when an audit fails', () => {
    const existing: SourceSpec = {
      media: 'local-news',
      group: 'news',
      list: { urls: [{ cat: 'politics', url: 'https://local.example/custom-list' }], include: '/news/', curl: true },
      article: { enabled: true, batch: 3, delayMs: 2000, bodySelector: '.custom-body' },
      titleSuffix: '地方新聞',
    };
    const before = structuredClone(existing);
    const inputs = [existing];
    const results = addNewsSources(inputs, [candidate({ existing: true })], [proof({ status: 'unavailable', samples: [] })]);
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(existing);
    expect(existing).toEqual(before);
    expect(inputs).toEqual([before]);
  });

  it('enables a new source hourly only after matching URL and nonempty verified article evidence', () => {
    const source = candidate({ feedUrls: ['https://local.example/feed/', 'https://local.example/other.xml'] });
    const result = addNewsSources([], [source], [proof()])[0];
    expect(result.group).toBe('hourly');
    expect(result.list.autoDiscover?.homeUrl).toBe(source.websiteUrl);
    expect(result.list.autoDiscover?.feedUrls).toEqual(['https://local.example/feed/', 'https://local.example/other.xml']);
    expect(result.article.enabled).toBe(true);
  });

  it.each([
    ['failed request', { status: 'unavailable' as const }],
    ['unresolved website', { status: 'unresolved' as const }],
    ['existing adapter without verified article', { status: 'existing' as const }],
    ['empty article evidence', { samples: [], articleCount: 20 }],
    ['old proof for a previous website', { websiteUrl: 'https://old.example/' }],
    ['proof without website identity', { websiteUrl: null }],
    ['proof belonging to another source', { media: 'another-news' }],
  ])('retains %s in the catalog without scheduling it', (_label, patch) => {
    const results = addNewsSources([], [candidate()], [proof(patch)]);
    expect(results).toHaveLength(1);
    expect(results[0].media).toBe('local-news');
    expect(results[0].group).toBe('off');
  });

  it('retains unaudited and missing-URL sources without enabling scheduled crawls', () => {
    expect(addNewsSources([], [candidate()], [])[0].group).toBe('off');
    const unresolved = addNewsSources([], [candidate({ websiteUrl: null })], [proof()])[0];
    expect(unresolved.group).toBe('off');
    expect(unresolved.list.urls).toEqual([]);
    expect(unresolved.list.autoDiscover).toBeUndefined();
    expect(unresolved.article.enabled).toBe(false);
  });

  it('reuses only verified RSS/sitemap discovery URLs, never an HTML page as a feed', () => {
    for (const strategy of ['rss', 'sitemap'] as const) {
      const result = addNewsSources([], [candidate()], [proof({ strategy })])[0];
      expect(result.list.autoDiscover?.feedUrls).toEqual(['https://local.example/feed/']);
    }
    for (const result of [
      addNewsSources([], [candidate()], [proof({ strategy: 'html', listingUrl: 'https://local.example/latest/' })])[0],
      addNewsSources([], [candidate()], [proof({ status: 'unavailable' })])[0],
    ]) {
      expect(result.list.autoDiscover?.feedUrls).toEqual([]);
    }
  });
});

describe('complete newspaper source catalog', () => {
  it('includes every catalog identity in the site news category regardless of crawl availability', () => {
    for (const source of newsCatalog.sources) {
      expect(mediaCatalog.categories.news, source.media).toContain(source.media);
    }
  });

  it('covers all retained latest spreadsheet rows exactly once while sharing crawlers for explicit aliases', () => {
    const latest = traffic.snapshots.find((snapshot) => snapshot.month === newsCatalog.sourceMonth)!;
    expect(latest.sources).toHaveLength(197);
    const coveredRows = newsCatalog.sources.flatMap((source) => source.referenceRows);
    expect(new Set(coveredRows).size).toBe(coveredRows.length);
    expect(coveredRows.toSorted((a, b) => a - b)).toEqual(latest.sources.map((row) => row.row).toSorted((a, b) => a - b));
    for (const row of latest.sources) {
      const matched = resolveCatalogSource(row, newsCatalog.sources);
      expect(matched, row.name).toBeDefined();
      expect(matched?.referenceRows, row.name).toContain(row.row);
    }
    for (const name of ['三立', '三立 iNews', '三立 (新聞)']) {
      const row = latest.sources.find((source) => source.name === name)!;
      expect(resolveCatalogSource(row, newsCatalog.sources)?.media, name).toBe('setn');
    }
  });

  it('keeps unique bounded source IDs stable when catalog ordering changes', () => {
    const ids = newsCatalog.sources.map((source) => source.media);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
      expect(id.length).toBeLessThanOrEqual(32);
    }
    const first = addNewsSources([], newsCatalog.sources as NewsSource[], [])
      .map((source) => source.media)
      .sort();
    const reordered = addNewsSources([], newsCatalog.sources.toReversed() as NewsSource[], [])
      .map((source) => source.media)
      .sort();
    expect(reordered).toEqual(first);
  });

  it('maps every historical alias without changing historical source fields', () => {
    const original = structuredClone(traffic.snapshots);
    for (const snapshot of traffic.snapshots) {
      for (const row of snapshot.sources) {
        expect(resolveCatalogSource(row, newsCatalog.sources), `${snapshot.month}: ${row.name}`).toBeDefined();
      }
    }
    expect(traffic.snapshots).toEqual(original);
  });

  it('preserves baseline political labels and does not assign a political camp to new sources', () => {
    for (const source of baseline.sources) {
      const current = mediaCatalog.categories.blue.includes(source.media)
        ? '藍'
        : mediaCatalog.categories.green.includes(source.media)
          ? '綠'
          : null;
      expect(current, source.media).toBe(['藍', '綠'].includes(source.classification) ? source.classification : null);
    }
    for (const source of newsCatalog.sources.filter((entry) => !entry.existing)) {
      expect(mediaCatalog.categories.blue, source.media).not.toContain(source.media);
      expect(mediaCatalog.categories.green, source.media).not.toContain(source.media);
    }
  });
});
