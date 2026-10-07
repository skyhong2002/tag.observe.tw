import { describe, expect, it } from 'vitest';
import catalog from '../data/media-catalog.json' with { type: 'json' };
import audits from '../data/news-crawl-audit.json' with { type: 'json' };
import sources from '../data/news-source-catalog.json' with { type: 'json' };
import { sourceByMedia } from '../src/crawl/registry.ts';
import { mediaScope } from '../src/media-scope.ts';

const ids = ['president', 'moi', 'mofa', 'moa', 'mnd', 'mohw', 'mol', 'taipei_gov', 'ntpc_gov'];

describe('official government news registration', () => {
  it.each(ids)('%s has verified full articles and a scheduled official source', (id) => {
    const source = sources.sources.find((item) => item.media === id)!;
    const audit = audits.results.find((item) => item.media === id)!;
    expect(new URL(source.websiteUrl!).hostname).toMatch(/(?:\.gov\.tw|\.gov\.taipei)$/);
    expect(source.referenceRows).toEqual([]);
    expect(audit.websiteUrl).toBe(source.websiteUrl);
    expect(audit.status).toBe('verified');
    expect(audit.samples.length).toBeGreaterThanOrEqual(3);
    const spec = sourceByMedia(id)!;
    expect(spec.group).toBe('hourly');
    expect(spec.list.autoDiscover?.homeUrl).toBe(source.websiteUrl);
    for (const sample of audit.samples) {
      const url = new URL(sample.url);
      expect(new RegExp(source.articlePattern!).test(url.pathname + url.search)).toBe(true);
      expect(sample.bodyLength).toBeGreaterThanOrEqual(120);
    }
    expect(catalog.categories.news).toContain(id);
    expect(catalog.categories.blue).not.toContain(id);
    expect(catalog.categories.green).not.toContain(id);
    expect(mediaScope(id)).toMatchObject({ scope: 'tw-gov', scopeLabel: '台灣政府', roles: [{ role: 'government', label: '政府機關' }] });
  });
});
