import { describe, expect, it } from 'vitest';
import { evidenceFilter, similarityParams } from '../v1/similarity.ts';
import { compareBodies, prepareBody } from './compute.ts';
import { findCandidates, minhash, type SketchedArticle, shingleHashes, sketchFromBuffer, sketchToBuffer } from './minhash.ts';
import { type StoredPair, storyGroups } from './store.ts';

// Unique prose-like strings exercise overlap, not a repeated single sentence.
const text = Array.from({ length: 90 }, (_, i) => `第${i}項採訪紀錄指出地方建設需要公開審查與居民參與討論`).join('。');
const unrelated = Array.from({ length: 90 }, (_, i) => `球員${i}在棒球比賽揮出全壘打帶領隊伍贏得冠軍獎盃`).join('。');
const body = (value: string) => prepareBody(value)!;

describe('body similarity', () => {
  it('detects normalized identical bodies and exposes only a short matching passage', () => {
    const match = compareBodies(body(text), body(text.replaceAll('。', '！\n')))!;
    expect(match).toMatchObject({ kind: 'identical', score: 1, containment: 1 });
    expect(match.evidence.length).toBeLessThanOrEqual(100);
  });
  it('finds high overlap after additions', () => {
    const match = compareBodies(body(text), body(text + unrelated.slice(0, 250)))!;
    expect(match.kind).toBe('high');
    expect(match.score).toBeGreaterThan(0.65);
    expect(match.containment).toBe(1);
  });
  it('does not infer a match from unrelated text, short text or boilerplate', () => {
    expect(compareBodies(body(text), body(unrelated))).toBeNull();
    expect(prepareBody('短新聞')).toBeNull();
    expect(prepareBody('訂閱電子報'.repeat(100))).toBeNull();
  });
  it('applies the threshold', () => {
    const partial = body(text.slice(0, 900) + unrelated.slice(0, 900));
    const score = compareBodies(body(text), partial, 0)!.score;
    expect(compareBodies(body(text), partial, score + 0.01)).toBeNull();
  });
});

describe('MinHash candidates', () => {
  const sketch = (id: number, media: string, value: string, hours = 0): SketchedArticle => ({
    id,
    media,
    publishedAt: Date.parse('2026-10-01T00:00:00Z') + hours * 3600e3,
    sketch: minhash(shingleHashes(body(value).text)),
  });
  it('round-trips the stored sketch', () => {
    const { sketch: values } = sketch(1, 'cna', text);
    expect(sketchFromBuffer(sketchToBuffer(values))).toEqual(values);
  });
  it('finds overlapping articles across media and batches, within the window only', () => {
    const indexed = [sketch(1, 'cna', text), sketch(2, 'udn', unrelated), sketch(3, 'ltn', text, -24 * 8)];
    const batch = [sketch(4, 'setn', text + unrelated.slice(0, 200)), sketch(5, 'ebc', text), sketch(6, 'cna', text)];
    const found = findCandidates(batch, indexed, 7 * 86400e3).map((c) => [c.a.id, c.b.id].sort((x, y) => x - y).join('-'));
    // 6 and 1 are the same outlet; 3 is eight days earlier; 2 is unrelated.
    expect(found.sort()).toEqual(['1-4', '1-5', '4-5', '4-6', '5-6']);
  });
});

describe('story groups', () => {
  const pair = (aId: number, bId: number, aMedia: string, bMedia: string, aHour: number, bHour: number, score = 0.9): StoredPair => ({
    aId,
    bId,
    aMedia,
    bMedia,
    aPublished: new Date(Date.UTC(2026, 9, 1, aHour)),
    bPublished: new Date(Date.UTC(2026, 9, 1, bHour)),
    score,
    containment: score,
    shared: 200,
    kind: 'high',
    evidence: '共同段落',
  });
  it('groups connected articles but exposes only directly measured pairs', () => {
    const { groups, origins } = storyGroups([pair(1, 2, 'cna', 'udn', 1, 2), pair(2, 3, 'udn', 'ltn', 2, 3)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: 'story:1', tiedFirst: 1 });
    expect(origins.map((o) => [o.article.id, o.source.id, o.directPair ? 'direct' : 'group'])).toEqual([
      [2, 1, 'direct'],
      [3, 2, 'direct'],
    ]);
  });
});

describe('query values', () => {
  const now = new Date('2026-10-04T00:00:00Z');
  it('accepts rolling hours or a bounded Taipei date range', () => {
    for (const hours of ['NaN', 'Infinity', '0', '169', '1.5']) expect(similarityParams({ hours }, now)).toBeNull();
    for (const threshold of ['NaN', 'Infinity', '.49', '1.1']) expect(similarityParams({ threshold }, now)).toBeNull();
    expect(similarityParams({}, now)).toMatchObject({ hours: 48, days: null, threshold: 0.65, to: now });
    expect(similarityParams({ from: '2026-09-01', to: '2026-09-30' }, now)).toMatchObject({
      hours: null,
      from: new Date('2026-08-31T16:00:00Z'),
      to: new Date('2026-09-30T15:59:59Z'),
    });
    for (const range of [
      { from: '2026-09-01', to: '2026-10-02' },
      { from: '2026-09-02', to: '2026-09-01' },
      { from: '2026-9-1', to: '2026-09-02' },
      { from: '2026-09-01' },
      { from: '2026-09-01', to: '2026-09-02', hours: '24' },
    ])
      expect(similarityParams(range, now)).toBeNull();
  });
  it('rejects unknown evidence filters', () => {
    expect(evidenceFilter({ mode: 'everything' })).toBeNull();
    expect(evidenceFilter({ edgeKind: 'similarity', source: 'cna' })).toBeNull();
    expect(evidenceFilter({ node: 'cna', edgeKind: 'citation', source: 'cna', target: 'reuters' })).toBeNull();
    expect(evidenceFilter({ page: '-1' })).toBeNull();
    expect(evidenceFilter({ scope: 'cna,udn', q: '川普' })).toMatchObject({ scope: new Set(['cna', 'udn']), query: '川普', page: 0 });
  });
});
