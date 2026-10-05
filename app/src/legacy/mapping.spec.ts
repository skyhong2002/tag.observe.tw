import { describe, expect, it } from 'vitest';
import { legacyMapping } from './mapping.ts';
import { normalizeLegacyArticle } from './normalize.ts';

describe('reviewed legacy media mapping', () => {
  const raw = {
    newsid: '1',
    media: 'ettoday',
    url: 'https://www.ettoday.net/news/20140101/1.htm',
    title: '標題',
    ctime: '2014-01-01 12:00:00',
    create_time: '2014-01-01 11:00:00',
    tags: '[標籤]',
  };
  const context = (table: string, row = raw) => {
    const mapped = legacyMapping(table, row)!;
    return {
      source: 'tag-analysis/tag',
      table,
      generation: 'test',
      capturedAt: '2026-10-05T00:00:00Z',
      objects: ['a'.repeat(64)],
      spec: mapped.spec,
      publisherRoots: mapped.publisherRoots,
      mixedTable: mapped.mixed,
    };
  };
  it('uses publisher evidence instead of the RSS proxy hostname', () => {
    expect(normalizeLegacyArticle(raw, context('tag_ettoday')).disposition).toBe('candidate');
    const proxy = { ...raw, url: 'https://feeds.feedburner.com/ettoday/123' };
    expect(normalizeLegacyArticle(proxy, context('tag_ettoday')).reasons).toContain('unreviewed_url_host');
  });
  it('rejects lookalike suffix domains and accepts actual publisher subdomains', () => {
    expect(normalizeLegacyArticle({ ...raw, url: 'https://travel.ettoday.net/1.htm' }, context('tag_ettoday')).disposition).toBe(
      'candidate',
    );
    expect(normalizeLegacyArticle({ ...raw, url: 'https://ettoday.net.example.com/1.htm' }, context('tag_ettoday')).reasons).toContain(
      'unreviewed_url_host',
    );
  });
  it('canonicalizes the configured cti alias while retaining original table and ID', () => {
    const alias = legacyMapping('tag_cti')!;
    expect(alias.sourceMedia).toBe('cti');
    expect(alias.spec.media).toBe('ctitv');
    const input = { ...raw, media: 'cti', url: 'https://ctinews.com/news/items/123' };
    const normalized = normalizeLegacyArticle(input, { ...context('tag_ettoday'), table: 'tag_cti', ...alias });
    expect(normalized.disposition).toBe('candidate');
    expect(normalized.article.media).toBe('ctitv');
    expect(normalized.lineage.sourceKey).toBe('tag-analysis/tag/tag_cti/1');
    const mixed = legacyMapping('tag_news', input)!;
    expect(normalizeLegacyArticle(input, { ...context('tag_ettoday'), table: 'tag_news', ...mixed, mixedTable: true }).disposition).toBe(
      'candidate',
    );
  });
  it('accepts evidenced historical publisher hosts without accepting other publishers', () => {
    for (const [media, host] of [
      ['babyou', 'www.babyou.com'],
      ['babyou', 'babyou.nownews.com'],
      ['asiatatler', 'tw.asiatatler.com'],
      ['bbc', 'www.bbc.co.uk'],
    ]) {
      const input = { ...raw, media, url: `https://${host}/historical-article` };
      expect(normalizeLegacyArticle(input, context(`tag_${media}`, input)).disposition).toBe('candidate');
    }
    const otherPublisher = { ...raw, media: 'babyou', url: 'https://www.nownews.com/123' };
    expect(normalizeLegacyArticle(otherPublisher, context('tag_babyou', otherPublisher)).reasons).toContain('unreviewed_url_host');
  });
  it('retains evidenced historical brands without merging them into successor publishers', () => {
    for (const [media, host] of [
      ['eld', 'everylittled.com'],
      ['newcongress', 'newcongress.tw'],
    ]) {
      const input = { ...raw, media, url: `https://${host}/historical` };
      const result = normalizeLegacyArticle(input, context(`tag_${media}`, input));
      expect(result.disposition).toBe('candidate');
      expect(result.article.media).toBe(media);
    }
    const successor = { ...raw, media: 'eld', url: 'https://www.roomie.tw/posts/50784' };
    expect(normalizeLegacyArticle(successor, context('tag_eld', successor)).reasons).toContain('unreviewed_url_host');
  });
  it('requires an explicit known mixed-row media and keeps original table lineage', () => {
    const row = normalizeLegacyArticle(raw, context('tag_news'));
    expect(row.disposition).toBe('candidate');
    expect(row.lineage.sourceKey).toBe('tag-analysis/tag/tag_news/1');
    expect(legacyMapping('tag_news', { ...raw, media: 'made-up' })).toBeNull();
    expect(legacyMapping('tag_relation')).toBeNull();
    expect(normalizeLegacyArticle({ ...raw, media: 'cna' }, context('tag_news')).reasons).toContain('unreviewed_table_media_mapping');
  });
});
