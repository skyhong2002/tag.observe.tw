import { describe, expect, it } from 'vitest';
import { mediaNames, selectNamedTrafficSources, trafficDisplayName } from '../../web/src/lib/media-names.mts';
import { resolveCatalogSource } from '../../web/src/lib/media-traffic.mts';
import icons from '../data/favicon-catalog.json' with { type: 'json' };
import traffic from '../data/media-traffic.json' with { type: 'json' };
import sources from '../data/news-source-catalog.json' with { type: 'json' };
import baseline from '../data/traffic-baseline.json' with { type: 'json' };
import { allSources } from '../src/crawl/registry.ts';
import { outletIdentity } from '../src/similarity/attribution.ts';

const options = { scope: 'all', classification: '', query: '', sort: 'traffic' as const, ascending: false };

describe('reviewed media names', () => {
  it('covers every API identity and keeps reviewed titles free of spreadsheet annotations', () => {
    expect(Object.keys(mediaNames).sort()).toEqual(Object.keys(icons).sort());
    for (const source of allSources().filter((source) => source.group !== 'off')) {
      expect(mediaNames[source.media]?.name, source.media).toBeTruthy();
    }
    for (const [media, entry] of Object.entries(icons)) {
      expect(entry.title, media).toBe(mediaNames[media].name);
      if (mediaNames[media].status === 'excluded') {
        expect(entry.title).toBeNull();
        continue;
      }
      expect(outletIdentity(media).name, media).toBe(mediaNames[media].name);
      expect(entry.title, media).not.toMatch(/\/\s*\d|\.(?:com|org|net|tw)(?:\W|$)|\(新聞\)|\(台中彰化\)/i);
      expect(mediaNames[media].name?.trim()).not.toBe('');
      expect(['verified', 'retained', 'historical', 'unresolved']).toContain(mediaNames[media].status);
      if (mediaNames[media].status === 'verified') expect(mediaNames[media].sourceUrl).toMatch(/^https?:\/\//);
    }
    expect(mediaNames.apple.name).toBe('蘋果日報');
    expect(mediaNames.bbc.name).not.toBe(mediaNames.bbc_global.name);
  });

  it('resolves all historical spreadsheet rows without changing source identity or values', () => {
    for (const snapshot of traffic.snapshots) {
      for (const row of snapshot.sources) {
        const before = structuredClone(row);
        const source = resolveCatalogSource(row, sources.sources);
        expect(source, `${snapshot.month}: ${row.name}`).toBeDefined();
        expect(trafficDisplayName(row, sources.sources)).toBe(mediaNames[source!.media].name);
        expect(row).toEqual(before);
      }
      expect(selectNamedTrafficSources(snapshot.sources, baseline.sources, sources.sources, options)).toHaveLength(snapshot.sources.length);
    }
  });

  it('finds corrected brands by either new names or historical aliases', () => {
    const rows = traffic.snapshots[0].sources;
    for (const query of ['鴨鴨新聞', '鴉鴉新聞']) {
      const result = selectNamedTrafficSources(rows, baseline.sources, sources.sources, { ...options, query });
      expect(result).toHaveLength(1);
      expect(trafficDisplayName(result[0], sources.sources)).toBe('鴨鴨新聞');
    }
    const sorted = selectNamedTrafficSources(rows, baseline.sources, sources.sources, { ...options, sort: 'name', ascending: true });
    const names = sorted.map((row) => trafficDisplayName(row, sources.sources));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'zh-Hant')));
    const referenceRows = selectNamedTrafficSources(rows, baseline.sources, sources.sources, { ...options, scope: 'reference' });
    expect(referenceRows.length).toBeLessThan(rows.length);
    expect(referenceRows.length).toBeGreaterThan(0);
  });
});
