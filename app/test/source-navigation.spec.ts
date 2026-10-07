import { describe, expect, it } from 'vitest';
import { graphHref, readGraphState, relationshipQuery } from '../../web/src/lib/relationship-query.mts';
import { sourceRanking } from '../../web/src/lib/source-ranking.mts';
import type { SimilarityNode } from '../src/similarity/types.ts';
import { parseArticleQuery } from '../src/v1/articles.ts';

describe('relationship navigation and citation ranking', () => {
  it('round-trips the selected pair, period and evidence filters through section links', () => {
    const original = new URLSearchParams(
      'from=2026-10-01&to=2026-10-07&threshold=0.8&mode=citation&direction=incoming&edgeKind=citation&source=udn&target=cna&view=evidence&limit=0&camp=blue&page=2&q=台積電&showAll=1&edgeRelation=attributed&edgeDirected=false&relation=same-byline&unrelated=1',
    );
    const carried = relationshipQuery(original);
    expect(carried.get('target')).toBe('cna');
    expect(carried.get('edgeRelation')).toBe('attributed');
    expect(carried.get('edgeDirected')).toBe('false');
    expect(carried.has('unrelated')).toBe(false);
    expect(readGraphState(carried)).toMatchObject({
      mode: 'citation',
      relation: 'same-byline',
      direction: 'incoming',
      limit: 0,
      camp: 'blue',
      page: 2,
      q: '台積電',
      showAll: true,
    });
    expect(graphHref({ hours: 72, node: 'reuters', mode: 'citation', direction: 'incoming' })).toContain('node=reuters');
    expect(readGraphState(new URLSearchParams('limit=-1&page=-2&mode=oops'))).toMatchObject({ limit: 30, page: 0, mode: 'all' });
  });
  it('counts citation targets without treating similarity or earlier publication as citations', () => {
    const node = (id: string, incoming: number): SimilarityNode => ({
      id,
      name: id,
      country: '台灣',
      countryCode: 'TW',
      articles: 10,
      external: false,
      incoming,
      outgoing: 0,
      similar: 10,
      earliest: 10,
      later: 0,
    });
    const rows = sourceRanking({
      nodes: [node('cna', 2), node('udn', 0)],
      edges: [
        { source: 'udn', target: 'cna', kind: 'citation', count: 2, score: null },
        { source: 'cna', target: 'udn', kind: 'similarity', count: 10, score: 0.9 },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'cna', incoming: 2, citingMedia: ['udn'] });
  });
  it('accepts combined metadata filters and validates source identifiers', () => {
    expect(parseArticleQuery({ credit: ' 王小明 ', source: 'cna', section: '政治', media: 'udn', hours: '168' })).toMatchObject({
      credit: '王小明',
      source: 'cna',
      section: '政治',
      media: ['udn'],
    });
    expect(parseArticleQuery({ source: 'cna%' })).toEqual({ error: 'bad citation source' });
  });
});
