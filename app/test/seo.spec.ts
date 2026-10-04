import { describe, expect, it } from 'vitest';
import { canonicalQuery, decodeRouteParam, jsonLd, pageMetadata, pageSchema } from '../../web/src/lib/seo.ts';

describe('search and social metadata', () => {
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
