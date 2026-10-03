import { describe, expect, it } from 'vitest';
import { similarityParams } from '../v1/similarity.ts';
import { extractAttributions } from './attribution.ts';
import { buildGraph, type ContentRow, computeSimilarity, MAX_PAIRS } from './compute.ts';

// Unique prose-like strings exercise overlap, not a repeated single sentence.
const text = Array.from({ length: 90 }, (_, i) => `第${i}項採訪紀錄指出地方建設需要公開審查與居民參與討論`).join('。');
const unrelated = Array.from({ length: 90 }, (_, i) => `球員${i}在棒球比賽揮出全壘打帶領隊伍贏得冠軍獎盃`).join('。');
function row(id: number, media: string, body: string | null, patch: Partial<ContentRow> = {}): ContentRow {
  return {
    id,
    media,
    title: '相同事件標題',
    url: `https://example.com/${id}`,
    publishedAt: new Date('2026-10-03T00:00:00Z'),
    body,
    bodyStatus: 'ok',
    authors: ['王記者'],
    creator: null,
    attributions: [],
    ...patch,
  };
}
describe('body similarity', () => {
  it('detects normalized identical bodies across media and exposes only a short matching passage', () => {
    const result = computeSimilarity([row(1, 'cna', text), row(2, 'udn', text.replaceAll('。', '！\n'))]);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]).toMatchObject({ kind: 'identical', score: 1, containment: 1 });
    expect(result.pairs[0].evidence.length).toBeLessThanOrEqual(100);
    expect(result.pairs[0].a).not.toHaveProperty('body');
  });
  it('finds high overlap after additions and keeps its direction unknown', () => {
    const rows = [row(1, 'udn', text), row(2, 'cna', text + unrelated.slice(0, 250))];
    const { pairs } = computeSimilarity(rows);
    expect(pairs[0].kind).toBe('high');
    expect(buildGraph(rows, pairs).edges).toEqual([expect.objectContaining({ kind: 'similarity' })]);
  });
  it('does not infer a match from identical headlines, short text, failed extraction or same media', () => {
    expect(computeSimilarity([row(1, 'cna', text), row(2, 'udn', unrelated)]).pairs).toEqual([]);
    expect(computeSimilarity([row(1, 'cna', '短新聞'), row(2, 'udn', '短新聞')]).pairs).toEqual([]);
    expect(computeSimilarity([row(1, 'cna', text), row(2, 'udn', text, { bodyStatus: 'blocked' })]).pairs).toEqual([]);
    expect(computeSimilarity([row(1, 'cna', text), row(2, 'cna', text)]).pairs).toEqual([]);
  });
  it('does not treat repetitive page boilerplate as meaningful overlap', () => {
    expect(computeSimilarity([row(1, 'cna', '訂閱電子報'.repeat(100)), row(2, 'udn', '訂閱電子報'.repeat(100))]).pairs).toEqual([]);
  });
  it('creates a directed foreign citation only from explicit attribution', () => {
    const attributions = extractAttributions('根據路透社報導，當局公布最新消息。', 'udn');
    const graph = buildGraph([row(1, 'udn', text, { attributions })], []);
    expect(graph.edges).toEqual([{ source: 'udn', target: 'reuters', kind: 'citation', count: 1, score: null }]);
    expect(graph.nodes.find((n) => n.id === 'reuters')).toMatchObject({ countryCode: 'GB', external: true });
  });
  it('caps pair evidence while retaining the highest-ranked matches and reporting truncation', () => {
    const rows = Array.from({ length: 94 }, (_, i) => row(i + 1, `outlet${i}`, text));
    const result = computeSimilarity(rows);
    expect(result.pairs).toHaveLength(MAX_PAIRS);
    expect(result.pairsTruncated).toBe(true);
    expect(result.analyzed).toBe(94);
    expect(new Set(result.pairs.map((pair) => pair.id)).size).toBe(MAX_PAIRS);
    expect(result.pairs.every((pair) => pair.score === 1)).toBe(true);
  });
  it('validates finite and bounded query values', () => {
    for (const hours of ['NaN', 'Infinity', '0', '169', '1.5']) expect(similarityParams({ hours })).toBeNull();
    for (const threshold of ['NaN', 'Infinity', '.49', '1.1']) expect(similarityParams({ threshold })).toBeNull();
    expect(similarityParams({})).toEqual({ hours: 48, threshold: 0.65 });
  });
});
