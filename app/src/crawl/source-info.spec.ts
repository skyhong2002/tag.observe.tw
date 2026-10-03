import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import countryRegistry from '../../data/media-countries.json' with { type: 'json' };
import { outletIdentity } from '../similarity/attribution.ts';
import { listedMediaSources } from '../v1/media-stats.ts';
import { allSources, sourceByMedia } from './registry.ts';
import { crawlerInfo } from './source-info.ts';

describe('public media country and crawler information', () => {
  it('covers every listed identity explicitly without guessing new countries', () => {
    for (const { media } of listedMediaSources(allSources())) {
      expect(Object.hasOwn(countryRegistry.media, media), media).toBe(true);
      expect(outletIdentity(media).country, media).not.toBe('未知');
    }
    expect(outletIdentity('new-unreviewed-media').countryCode).toBe('ZZ');
    expect(outletIdentity('gv')).toMatchObject({ countryCode: 'NL', country: '荷蘭' });
    expect(outletIdentity('bannedbook')).toMatchObject({ countryCode: 'INT', country: '跨國' });
    expect(outletIdentity('vogue').countryCode).toBe('TW');
  });

  it('describes actual adapters and keeps configured methods separate from successful audits', () => {
    expect(crawlerInfo('nhk', sourceByMedia('nhk')).methods).toContain('公開 JSON API');
    expect(crawlerInfo('kyodo', sourceByMedia('kyodo')).lastVerifiedMethod).toBe('RSS／Atom');
    expect(crawlerInfo('google_news', sourceByMedia('google_news')).transport).toContain('Playwright');
    expect(crawlerInfo('ctv', sourceByMedia('ctv')).methods).toContain('YouTube Atom 影片列表');
    expect(crawlerInfo('supertaste', sourceByMedia('supertaste')).methods).toContain('XML Sitemap');
    expect(crawlerInfo('1111', sourceByMedia('1111')).methods).toContain('HTML 選擇器解析');
    expect(crawlerInfo('apple').links).toEqual([]);
    expect(crawlerInfo('apple').methods).toEqual(['未設定爬蟲']);
  });

  it('links every configured crawler to real repository files and valid line anchors', () => {
    for (const spec of allSources()) {
      const info = crawlerInfo(spec.media, spec);
      expect(info.links.length, spec.media).toBeGreaterThan(1);
      for (const link of info.links) {
        const url = new URL(link.url);
        expect(url.origin).toBe('https://github.com');
        const path = url.pathname.replace('/skyhong2002/tag.observe.tw/blob/main/', '');
        const text = readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
        if (url.hash) expect(text.split('\n')[Number(url.hash.slice(2)) - 1], link.url).toContain(spec.media);
      }
    }
  });
});
