import { describe, expect, it } from 'vitest';
import { highlightedRelationship, sameGraphSelection } from '../../web/src/lib/graph-evidence.mts';
import type { SimilarityEdge } from '../src/similarity/types.ts';

const edge: SimilarityEdge = { source: 'a', target: 'b', kind: 'citation', count: 1, score: null };

describe('pinned graph relationships', () => {
  it('highlights all incident links in either direction and excludes unrelated ones', () => {
    expect(highlightedRelationship(edge, { node: 'a' })).toBe(true);
    expect(highlightedRelationship(edge, { node: 'b' })).toBe(true);
    expect(highlightedRelationship({ ...edge, kind: 'similarity' }, { node: 'a' })).toBe(true);
    expect(highlightedRelationship(edge, { node: 'c' })).toBe(false);
    expect(highlightedRelationship(edge, null)).toBe(false);
  });
  it('pins exactly the selected directed edge and recognizes repeated selection by identity', () => {
    expect(sameGraphSelection({ edge }, { edge: { ...edge, count: 9 } })).toBe(true);
    expect(highlightedRelationship({ ...edge, source: 'b', target: 'a' }, { edge })).toBe(false);
    expect(highlightedRelationship({ ...edge, kind: 'similarity' }, { edge })).toBe(false);
    expect(sameGraphSelection({ node: 'a' }, { node: 'a' })).toBe(true);
    expect(sameGraphSelection({ node: 'a' }, { edge })).toBe(false);
    expect(sameGraphSelection(null, { node: 'a' })).toBe(false);
  });
});
