import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client.ts';
import { setRequestedExclusions } from '../journalists/names.ts';
import { dailyRelationCounts } from '../v1/similarity.ts';
import { classifyRelation } from './relation.ts';
import { aggregateRelations, loadEvidence, type StoredPair, storyGroups } from './store.ts';
import type { SimilarityArticle } from './types.ts';

const article = (id: number, media: string, patch: Partial<SimilarityArticle> = {}): SimilarityArticle => ({
  id,
  media,
  mediaTitle: media,
  country: '台灣',
  countryCode: 'TW',
  title: '新聞',
  url: `https://example.com/${id}`,
  publishedAt: `2026-10-05T11:${String(id).padStart(2, '0')}:00Z`,
  authors: [],
  bodyLength: 1000,
  attributions: [],
  ...patch,
});
const citation = (media: string) => ({
  media,
  name: media,
  country: '台灣',
  countryCode: 'TW',
  kind: 'explicit' as const,
  evidence: `來源：${media}`,
});
const stored = (a: SimilarityArticle, b: SimilarityArticle): StoredPair => ({
  aId: a.id,
  bId: b.id,
  aMedia: a.media,
  bMedia: b.media,
  aPublished: new Date(a.publishedAt),
  bPublished: new Date(b.publishedAt),
  score: 1,
  containment: 1,
  shared: 1000,
  kind: 'identical',
  evidence: '共同段落',
});

describe('source-aware similarity', () => {
  it('keeps the CNA/MSN same-byline and explicit credit without inferring precedence', () => {
    const a = article(1, 'cna', { authors: ['高華謙'], publishedAt: '2026-10-05T11:15:00Z' });
    const b = article(2, 'msn', { authors: ['中央社記者高華謙台北5日電'], attributions: [citation('cna')], publishedAt: a.publishedAt });
    expect(classifyRelation(a, b)).toMatchObject({ kind: 'attributed', sharedAuthors: ['高華謙'], bCitesA: true, publication: 'same' });
    const known = new Map([
      [a.id, a],
      [b.id, b],
    ]);
    const graph = aggregateRelations(
      [stored(a, b)],
      known,
      new Map([
        ['cna', 1],
        ['msn', 1],
      ]),
      [],
    );
    expect(graph.nodes.every((node) => node.earliest === 0 && node.later === 0 && node.attributed === 1)).toBe(true);
    expect(dailyRelationCounts([stored(a, b)], known).map((row) => row.category)).toEqual(['attributed', 'attributed']);
  });
  it('separates same bylines, shared sources and unidentified sources', () => {
    const a = article(1, 'cna', { authors: ['高華謙'] });
    expect(classifyRelation(a, article(2, 'msn', { authors: ['高華謙'] })).kind).toBe('same-byline');
    expect(
      classifyRelation(
        article(1, 'udn', { attributions: [citation('reuters')] }),
        article(2, 'ltn', { attributions: [citation('reuters')] }),
      ),
    ).toMatchObject({ kind: 'attributed', commonSources: [{ media: 'reuters', name: 'reuters' }] });
    expect(classifyRelation(article(1, 'msn', { authors: ['中央社'] }), article(2, 'udn', { authors: ['中央社'] })).kind).toBe(
      'unattributed',
    );
  });
  it('does not change byline classification when someone is removed from journalist listings', () => {
    setRequestedExclusions(['高華謙']);
    try {
      expect(classifyRelation(article(1, 'cna', { authors: ['高華謙'] }), article(2, 'msn', { authors: ['高華謙'] })).kind).toBe(
        'same-byline',
      );
    } finally {
      setRequestedExclusions([]);
    }
  });
  it('refreshes cached names after an author credit is corrected', () => {
    const a = article(1, 'cna', { authors: ['高華謙'] });
    const b = article(2, 'msn', { authors: ['高華謙'] });
    expect(classifyRelation(a, b).kind).toBe('same-byline');
    b.authors[0] = '王小明';
    expect(classifyRelation(a, b).kind).toBe('unattributed');
  });
  it('uses actual minute differences and excludes pending dates from precedence', () => {
    const a = article(1, 'a', { publishedAt: '2026-10-05T11:15:00Z' });
    const b = article(2, 'b', { publishedAt: '2026-10-05T11:15:59Z' });
    expect(classifyRelation(a, b).publication).toBe('same');
    expect(classifyRelation(a, { ...b, publishedAt: '2026-10-05T11:16:00Z' }).publication).toBe('a-earlier');
    expect(classifyRelation(a, { ...b, datePending: true }).publication).toBe('unknown');
  });
  it('does not manufacture A/C edges from A/B and B/C and deduplicates daily article counts', () => {
    const a = article(1, 'a'),
      b = article(2, 'b'),
      c = article(3, 'c');
    const pairs = [stored(a, b), stored(b, c)],
      known = new Map([a, b, c].map((item) => [item.id, item]));
    const { origins } = storyGroups(pairs);
    expect(origins.map((origin) => [origin.source.id, origin.article.id])).toEqual([
      [1, 2],
      [2, 3],
    ]);
    const graph = aggregateRelations(pairs, known, new Map(), []);
    expect(graph.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ['b', 'a'],
      ['c', 'b'],
    ]);
    const counts = dailyRelationCounts(pairs, known);
    expect(counts.find((row) => row.media === 'b' && row.category === 'unattributed')?.count).toBe(1);
    expect(counts.find((row) => row.media === 'b' && row.category === 'copied')?.count).toBe(1);
    expect(counts.find((row) => row.media === 'b' && row.category === 'copying')?.count).toBe(1);
  });
});

describe('graph relation colors and direction', () => {
  it('separates shared bylines from unidentified pairs between the same outlets', () => {
    const a = article(1, 'a', { authors: ['高華謙'] });
    const b = article(2, 'b', { authors: ['高華謙'], attributions: [citation('a')] });
    const c = article(3, 'a', { authors: ['王小明'] });
    const d = article(4, 'b', { authors: ['李大華'] });
    const known = new Map([a, b, c, d].map((x) => [x.id, x]));
    const result = aggregateRelations([stored(a, b), stored(c, d)], known, new Map(), [
      { articleId: b.id, media: b.media, source: a.media, publishedAt: new Date(b.publishedAt) },
    ]);
    expect(result.edges).toMatchObject([
      { kind: 'similarity', relation: 'same-byline', directed: false, count: 1 },
      { kind: 'similarity', relation: 'unattributed', directed: true, source: 'b', target: 'a', count: 1 },
    ]);
    expect(result.nodes.find((n) => n.id === 'b')?.outgoing).toBe(1);
  });
  it('uses explicit credit direction even when publication order is reversed, without duplicate lines', () => {
    const a = article(1, 'a', { attributions: [citation('b')] });
    const b = article(2, 'b');
    const known = new Map([a, b].map((x) => [x.id, x]));
    expect(aggregateRelations([stored(a, b)], known, new Map(), []).edges).toMatchObject([
      { relation: 'attributed', directed: true, source: 'a', target: 'b' },
    ]);
    expect(
      aggregateRelations([stored(a, b)], known, new Map(), [
        { articleId: a.id, media: a.media, source: b.media, publishedAt: new Date(a.publishedAt) },
      ]).edges,
    ).toMatchObject([{ kind: 'citation', source: 'a', target: 'b', count: 1 }]);
  });
  it('keeps opposite publication orders separate, and never assigns an arrow to pending dates or common third-party credits', () => {
    const a = article(1, 'a'),
      b = article(2, 'b'),
      c = article(3, 'a');
    const pending = article(4, 'b', { datePending: true });
    const sharedA = article(5, 'a', { attributions: [citation('reuters')] });
    const sharedB = article(6, 'b', { attributions: [citation('reuters')] });
    const result = aggregateRelations(
      [stored(a, b), stored(b, c), stored(c, pending), stored(sharedA, sharedB)],
      new Map([a, b, c, pending, sharedA, sharedB].map((x) => [x.id, x])),
      new Map(),
      [],
    );
    expect(result.edges).toMatchObject([
      { source: 'b', target: 'a', relation: 'unattributed', directed: true },
      { source: 'a', target: 'b', relation: 'unattributed', directed: true },
      { source: 'a', target: 'b', relation: 'unattributed', directed: false },
      { source: 'a', target: 'b', relation: 'attributed', directed: false },
    ]);
  });
});

it('clicking each colored line returns only its category and publication direction', async () => {
  const a = article(1, 'a', { authors: ['高華謙'] });
  const b = article(2, 'b', { authors: ['高華謙'], attributions: [citation('a')] });
  const c = article(3, 'a'),
    d = article(4, 'b'),
    e = article(5, 'a');
  const pairs = [stored(a, b), stored(c, d), stored(d, e)];
  const known = new Map([a, b, c, d, e].map((x) => [x.id, x]));
  const graph = aggregateRelations(pairs, known, new Map(), []);
  const view = {
    ...graph,
    ...storyGroups(pairs),
    pairs,
    articleById: known,
    from: new Date('2026-10-05'),
    to: new Date('2026-10-06'),
    threshold: 0.65,
    citations: [],
    analyzed: new Map<string, number>(),
  };
  for (const edge of graph.edges) {
    const result = await loadEvidence({} as Db, view, { mode: 'similarity', edge, direction: 'all', query: '', page: 0 });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  }
});
