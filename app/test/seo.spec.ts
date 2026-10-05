import { describe, expect, it } from 'vitest';
import {
  archiveDay,
  articleIndexable,
  canonicalQuery,
  decodeRouteParam,
  jsonLd,
  pageMetadata,
  pageSchema,
} from '../../web/src/lib/seo.mts';
import { legacyRoute } from '../src/legacy-redirects.js';

describe('search and social metadata', () => {
  it('keeps share images reachable through the gateway without changing legacy redirects', () => {
    expect(legacyRoute('/tag/%E8%94%A1%E8%8B%B1%E6%96%87/opengraph-image-6ffhew?version=1')).toBeNull();
    expect(legacyRoute('/eve/897/opengraph-image-8pdfrx')).toBeNull();
    // Section pages' images sit under old redirect patterns (/event/…, /media/x/…).
    for (const path of [
      '/event/opengraph-image-1yg7ay',
      '/media/sources/opengraph-image-190gsc',
      '/media/crawlers/opengraph-image-1pmn3r/',
    ])
      expect(legacyRoute(path)).toBeNull();
    expect(legacyRoute('/event/opengraph')).toEqual({ status: 301, location: '/event/' });
    expect(legacyRoute('/tag/test/old-chart/')).toEqual({ status: 301, location: '/tag/test/' });
  });
  it('decodes page parameters once, including tags containing a percent sign', () => {
    expect(decodeRouteParam(encodeURIComponent('蔡英文'))).toBe('蔡英文');
    expect(decodeRouteParam('50%')).toBe('50%');
    expect(decodeRouteParam('%252F')).toBe('%2F');
  });
  it('uses one canonical and social URL, including meaningful archive parameters', () => {
    const path = canonicalQuery('/event/archive/', { day: '2026-10-04', unused: undefined });
    const result = pageMetadata(path, '事件存檔', '當日事件');
    expect(result.alternates?.canonical).toBe('https://tag.observe.tw/event/archive/?day=2026-10-04');
    expect(result.openGraph?.url).toBe(result.alternates?.canonical);
    expect(result.description).toBe('當日事件');
  });
  it('lets Next resolve generated image URLs rather than guessing its route hash', () => {
    const result = pageMetadata('/tag/test/', 'test', 'test', true);
    expect(result.openGraph?.images).toBeUndefined();
    expect(result.twitter?.images).toBeUndefined();
    expect(pageMetadata('/ranking/', '排行', '排行').openGraph?.images).toBeDefined();
  });
  it('serializes content as JSON without literal HTML delimiters', () => {
    const data = { name: '<標籤> & 新聞' };
    expect(jsonLd(data)).not.toContain('<');
    expect(JSON.parse(jsonLd(data))).toEqual(data);
  });
  it('models a collection and its breadcrumbs without claiming to publish the source news', () => {
    const data = pageSchema('/tag/test/', 'test', [['/ranking/', '排行']], [{ name: '報導', path: '/article/42/' }]);
    expect(data['@graph'][0]).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, item: 'https://tag.observe.tw/' },
        { position: 2, item: 'https://tag.observe.tw/ranking/' },
        { position: 3, item: 'https://tag.observe.tw/tag/test/' },
      ],
    });
    expect(data['@graph'][1]).toMatchObject({ '@type': 'CollectionPage', mainEntity: { '@type': 'ItemList' } });
  });
});

describe('indexing eligibility', () => {
  it('rejects impossible dates and shares the archive fallback for invalid input', () => {
    expect(archiveDay('2024-02-29')).toBe('2024-02-29');
    for (const value of ['2026-02-29', '2026-04-31', 'yesterday', ['2026-10-05'], undefined]) {
      expect(archiveDay(value)).toBeUndefined();
    }
  });
  it('keeps readable excerpts but excludes empty or expired source-only pages', () => {
    expect(articleIndexable({ status: 'ok', body: '節錄' }, null, null)).toBe(true);
    expect(articleIndexable({ status: 'missing', body: '  ' }, null, null)).toBe(false);
    expect(articleIndexable({ status: 'expired', body: '不應公開的舊內文' }, null, null)).toBe(false);
    expect(articleIndexable({ status: 'expired', body: null }, { events: [], otherMedia: [] }, null)).toBe(false);
  });
  it('keeps expired pages when the visible page supplies events or cross-outlet context', () => {
    const expired = { status: 'expired', body: null };
    expect(articleIndexable(expired, { events: [{ id: 1 }], otherMedia: [] }, null)).toBe(true);
    expect(articleIndexable(expired, { events: [], otherMedia: [{ id: 2 }] }, null)).toBe(true);
    const similarity = { indexedAt: '2026-10-05', chars: 500, matches: [{}] };
    expect(articleIndexable(expired, null, similarity)).toBe(true);
    expect(articleIndexable(expired, null, { ...similarity, indexedAt: null })).toBe(false);
    expect(articleIndexable(expired, null, { ...similarity, chars: null })).toBe(false);
  });
});
