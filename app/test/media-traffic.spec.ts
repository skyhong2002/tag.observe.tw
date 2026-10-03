import { describe, expect, it } from 'vitest';
import { referenceFor, selectTrafficSources, type TrafficSource } from '../../web/src/lib/media-traffic.mts';
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
