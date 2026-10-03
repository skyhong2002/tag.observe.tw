import { describe, expect, it } from 'vitest';
import {
  crawlStatusFor,
  type NewsCrawlAudit,
  type NewsSource,
  referenceFor,
  resolveCatalogSource,
  safeWebsiteUrl,
  selectTrafficSources,
  type TrafficSource,
} from '../../web/src/lib/media-traffic.mts';
import traffic from '../data/media-traffic.json' with { type: 'json' };
import baseline from '../data/traffic-baseline.json' with { type: 'json' };

const options = { scope: 'reference', classification: '', query: '', sort: 'traffic' as const, ascending: false };
const row = (patch: Partial<TrafficSource>): TrafficSource => ({
  row: 1,
  name: 'UDN',
  domain: null,
  classification: '藍',
  category: '新聞',
  rank: null,
  traffic: null,
  growth: null,
  notes: [],
  ...patch,
});

describe('all-news source identity and crawl availability', () => {
  const source: NewsSource = {
    media: 'local-news',
    name: '地方新聞',
    websiteUrl: 'https://local.example/',
    referenceNames: ['地方新聞網', '舊站名'],
    referenceRows: [200],
    existing: false,
    websiteEvidence: 'https://local.example/about',
    notes: '',
  };

  it('includes every news row in all scope, including sources without a website', () => {
    const selected = selectTrafficSources(traffic.snapshots[0].sources, baseline.sources, { ...options, scope: 'all' });
    expect(selected).toHaveLength(traffic.snapshots[0].sources.length);
    expect(selected.length).toBeGreaterThan(29);
    expect(selected.some((entry) => entry.domain === null)).toBe(true);
  });

  it('maps explicit aliases without replacing historical blank domains', () => {
    const historical = row({ name: ' 舊站名 ', domain: null });
    expect(resolveCatalogSource(historical, [source])).toBe(source);
    expect(historical.domain).toBeNull();
    expect(resolveCatalogSource(row({ name: '未識別名稱', domain: 'www.local.example' }), [source])).toBe(source);
    expect(resolveCatalogSource(row({ name: '未識別名稱', domain: 'different.example' }), [source])).toBeUndefined();
  });

  it('does not confuse brands sharing a domain or different subdomains', () => {
    const other = { ...source, media: 'another-brand', name: '另一品牌', referenceNames: [] };
    expect(resolveCatalogSource(row({ name: '未知品牌', domain: 'local.example' }), [source, other])).toBeUndefined();
    expect(resolveCatalogSource(row({ name: '地方新聞網' }), [source, other])).toBe(source);
    expect(resolveCatalogSource(row({ name: '未知品牌', domain: 'other.local.example' }), [source])).toBeUndefined();
  });

  it('never treats a source registration or existing adapter as a successful audit', () => {
    expect(crawlStatusFor({ ...source, existing: true }, undefined)).toBe('pending');
    expect(crawlStatusFor({ ...source, websiteUrl: null }, undefined)).toBe('unresolved');
    expect(crawlStatusFor(undefined, undefined)).toBe('unresolved');
    const audit: NewsCrawlAudit = {
      media: source.media,
      websiteUrl: source.websiteUrl,
      status: 'unavailable',
      strategy: 'html',
      listingUrl: source.websiteUrl,
      articleCount: 0,
      detail: '網站暫無法連線',
      samples: [],
      checkedAt: '2026-10-03T00:00:00.000Z',
    };
    expect(crawlStatusFor(source, audit)).toBe('unavailable');
    expect(crawlStatusFor(source, { ...audit, status: 'existing' })).toBe('existing');
    expect(crawlStatusFor(source, { ...audit, status: 'verified' })).toBe('unavailable');
    const verified: NewsCrawlAudit = {
      ...audit,
      status: 'verified',
      samples: [{ url: 'https://local.example/news/123', title: '新聞文章', publishedAt: '2026-10-02', bodyLength: 500 }],
    };
    expect(crawlStatusFor(source, verified)).toBe('verified');
    expect(crawlStatusFor(source, { ...verified, websiteUrl: 'https://old.example/' })).toBe('pending');
    expect(crawlStatusFor(source, { ...verified, websiteUrl: null })).toBe('pending');
    expect(crawlStatusFor({ ...source, websiteUrl: null }, verified)).toBe('unresolved');
  });

  it('allows only credential-free HTTP links from the source and audit data', () => {
    expect(safeWebsiteUrl('https://local.example/article/123')).toBe('https://local.example/article/123');
    for (const value of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:secret@local.example/', 'not a URL', null]) {
      expect(safeWebsiteUrl(value)).toBeNull();
    }
  });
});

describe('media traffic reference snapshots', () => {
  it('retains all 29 current reference identities, source classifications and unrounded traffic', () => {
    const latest = traffic.snapshots[0];
    const selected = selectTrafficSources(latest.sources, baseline.sources, options);
    expect(latest.month).toBe('202608');
    expect(selected).toHaveLength(29);
    expect(new Set(selected.map((source) => referenceFor(source, baseline.sources)?.media)).size).toBe(29);
    for (const reference of baseline.sources) {
      const source = selected.find((source) => referenceFor(source, baseline.sources)?.media === reference.media);
      expect(source?.classification).toBe(reference.classification);
      expect(Math.abs((source?.traffic ?? 0) - reference.traffic)).toBeLessThanOrEqual(0.000501);
    }
    expect(selected.find((source) => source.domain === 'n.yam.com')?.traffic).toBe(0.7892);
    expect(baseline.sources.find((source) => source.media === 'yam')?.traffic).toBe(0.789);
  });

  it('keeps missing values last in both directions and distinguishes zero', () => {
    const sources = [row({ row: 1 }), row({ row: 2, traffic: 0 }), row({ row: 3, traffic: 12 })];
    expect(selectTrafficSources(sources, baseline.sources, options).map((source) => source.row)).toEqual([3, 2, 1]);
    expect(selectTrafficSources(sources, baseline.sources, { ...options, ascending: true }).map((source) => source.row)).toEqual([2, 3, 1]);
  });

  it('matches historical names without inventing historical domains or overriding a conflicting domain', () => {
    expect(referenceFor(row({ name: ' UDN ' }), baseline.sources)?.media).toBe('udn');
    expect(referenceFor(row({ domain: 'another.example' }), baseline.sources)).toBeUndefined();
    const july = traffic.snapshots.find((snapshot) => snapshot.month === '202607')!;
    const udn = july.sources.find((source) => source.name === 'UDN')!;
    expect(udn.traffic).toBe(42.54);
    expect(udn.domain).toBeNull();
    expect(referenceFor(udn, baseline.sources)?.media).toBe('udn');
    for (const snapshot of traffic.snapshots) {
      const selected = selectTrafficSources(snapshot.sources, baseline.sources, options);
      expect(selected, snapshot.month).toHaveLength(29);
      expect(new Set(selected.map((source) => referenceFor(source, baseline.sources)?.media)).size).toBe(29);
    }
  });

  it('filters on the selected month original classification, and includes unmapped sources only in all scope', () => {
    const sources = [row({ classification: '多元' }), row({ row: 2, name: '外部來源', classification: null, traffic: 1 })];
    expect(selectTrafficSources(sources, baseline.sources, { ...options, classification: '藍' })).toEqual([]);
    expect(selectTrafficSources(sources, baseline.sources, { ...options, classification: '多元' })).toHaveLength(1);
    expect(selectTrafficSources(sources, baseline.sources, { ...options, scope: 'all', classification: '未標記' })).toHaveLength(1);
    expect(selectTrafficSources(sources, baseline.sources, { ...options, query: ' udn ' })).toHaveLength(1);
  });
});
