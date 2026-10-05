import { describe, expect, it } from 'vitest';
import type { SourceSpec } from '../crawl/sources.ts';
import { legacyDate, legacyTags, normalizeLegacyArticle } from './normalize.ts';

const context = {
  source: 'tag-analysis/tag',
  table: 'tag_cna',
  generation: 'test',
  capturedAt: '2026-10-04T00:00:00Z',
  objects: ['test-sha'],
  spec: { media: 'cna', list: { urls: [{ url: 'https://www.cna.com.tw/', cat: 'news' }], articleId: '/news/(\\d+)' } } as SourceSpec,
};
const row = {
  newsid: '9007199254740993',
  create_time: '2014-02-03 09:00:00',
  ctime: '2014-02-03 10:00:00',
  url: 'http://www.cna.com.tw/news/123?utm_source=old',
  title: 'A &amp; B',
  tags: '[甲][甲][乙]',
  tags_cat: '[政治]',
  tags_user: '[人工]',
  description: '摘要',
  creator: '網站',
};

describe('legacy staging normalization', () => {
  it('rejects zero, invalid calendar, epoch and unsupported historical dates', () => {
    for (const date of ['0000-00-00 00:00:00', '2014-02-30 12:00:00', '1970-01-01 08:00:00', '2014-01-01 24:00:00']) {
      expect(legacyDate(date)).toBeNull();
    }
    expect(legacyDate('2014-02-03 09:00:00')).toBe('2014-02-03T01:00:00.000Z');
  });
  it('preserves provenance and tag semantics, reuses current URL identity without inventing a body', () => {
    const result = normalizeLegacyArticle(row, context);
    expect(result.disposition).toBe('candidate');
    expect(result.article.urlKey).toBe('www.cna.com.tw#123');
    expect(result.article.tags).toEqual(['甲', '乙']);
    expect(result.legacyTagFields.tags_user.tags).toEqual(['人工']);
    expect(result.article.body).toBeNull();
    expect(result.article.authors).toBeNull();
    expect(result.article.mediaId).toBeNull();
    expect(result.article.source).toBe('legacy');
    expect(result.lineage.sourceKey).toContain('9007199254740993');
    expect(result.raw).toEqual(row);
    expect(result.warnings).toContain('historical_description_requires_verified_archive');
  });
  it('quarantines unmapped media, wrong domains and bad dates without substituting now', () => {
    const result = normalizeLegacyArticle({ ...row, create_time: '0000-00-00 00:00:00', url: 'https://elsewhere.example/a' }, context);
    expect(result.disposition).toBe('quarantine');
    expect(result.reasons).toContain('unreviewed_url_host');
    expect(result.article.publishedAt).toBeNull();
    expect(normalizeLegacyArticle(row, { ...context, table: 'tag_news' }).reasons).toContain('unreviewed_table_media_mapping');
  });
  it('keeps malformed historical image HTML in raw provenance without exposing it as an image URL', () => {
    const bad = { ...row, image: '<title>舊站 HTML</title>' };
    const result = normalizeLegacyArticle(bad, context);
    expect(result.article.image).toBeNull();
    expect(result.raw.image).toBe(bad.image);
    expect(result.warnings).toContain('invalid_image_preserved_only_in_raw');
  });
  it('marks retention risk and rejects malformed tag strings instead of dropping their contents', () => {
    expect(legacyTags('[甲]lost')).toEqual({ tags: ['甲'], valid: false });
    expect(normalizeLegacyArticle({ ...row, tags: '' }, context).warnings).toContain('historical_untagged_article');
    expect(normalizeLegacyArticle({ ...row, tags: '甲,乙' }, context).disposition).toBe('quarantine');
  });
});
