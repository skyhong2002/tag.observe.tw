import { describe, expect, it } from 'vitest';
import { mediaRelations } from '../../web/src/lib/media-relations.mts';
import type { SimilarityEdge, SimilarityNode } from '../src/similarity/types.ts';

const node = (id: string, overrides: Partial<SimilarityNode> = {}): SimilarityNode => ({
  id,
  name: `${id}-name`,
  country: '台灣',
  countryCode: 'TW',
  articles: 10,
  external: false,
  similar: 0,
  earliest: 0,
  later: 0,
  outgoing: 0,
  incoming: 0,
  ...overrides,
});
const edge = (source: string, target: string, kind: SimilarityEdge['kind'], count: number): SimilarityEdge => ({
  source,
  target,
  kind,
  count,
  score: null,
});

describe('mediaRelations', () => {
  const nodes = [node('me', { articles: 42 }), node('cna'), node('udn'), node('reuters', { external: true, articles: 0 }), node('other')];
  const edges = [
    edge('me', 'cna', 'similarity', 5), // me published later than cna
    edge('cna', 'me', 'similarity', 2), // cna published later than me
    edge('me', 'reuters', 'citation', 3),
    edge('udn', 'me', 'citation', 4),
    edge('udn', 'me', 'similarity', 1),
    edge('cna', 'udn', 'similarity', 9), // not ours
    edge('me', 'me', 'similarity', 7), // self loops never count
  ];

  it('splits each partner by direction and kind, ranked by total articles', () => {
    const result = mediaRelations({ nodes, edges }, 'me');
    expect(result.node?.articles).toBe(42);
    expect(result.partners).toEqual([
      { id: 'cna', name: 'cna-name', external: false, later: 5, earliest: 2, cites: 0, citedBy: 0, total: 7 },
      { id: 'udn', name: 'udn-name', external: false, later: 0, earliest: 1, cites: 0, citedBy: 4, total: 5 },
      { id: 'reuters', name: 'reuters-name', external: true, later: 0, earliest: 0, cites: 3, citedBy: 0, total: 3 },
    ]);
  });

  it('names partners missing from the node list by id', () => {
    const result = mediaRelations({ nodes: [node('me')], edges: [edge('ghost', 'me', 'citation', 1)] }, 'me');
    expect(result.partners).toEqual([
      { id: 'ghost', name: 'ghost', external: false, later: 0, earliest: 0, cites: 0, citedBy: 1, total: 1 },
    ]);
  });

  it('reports an unknown outlet without relationships', () => {
    expect(mediaRelations({ nodes, edges }, 'nobody')).toEqual({ node: null, partners: [] });
  });

  it('orders equal totals by name', () => {
    const result = mediaRelations(
      {
        nodes: [node('me'), node('b', { name: 'Beta' }), node('a', { name: 'Alpha' })],
        edges: [edge('me', 'b', 'citation', 1), edge('me', 'a', 'citation', 1)],
      },
      'me',
    );
    expect(result.partners.map((p) => p.id)).toEqual(['a', 'b']);
  });
});
