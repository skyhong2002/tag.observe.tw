import { describe, expect, it } from 'vitest';
import { evidenceItems } from '../../web/src/lib/story-origins.mts';
import type { SimilarityArticle, SimilarityEvidence, SimilarityPair } from '../src/similarity/types.ts';

const article = (id: number, media: string, time: string): SimilarityArticle => ({
  id,
  media,
  mediaTitle: media,
  title: `報導 ${id}`,
  publishedAt: time,
  url: `https://example.com/${id}`,
  country: '台灣',
  countryCode: 'TW',
  bodyLength: 800,
  authors: [],
  attributions: [],
});
const a = article(1, 'A', '2026-10-04T01:00:00Z'),
  b = article(2, 'B', '2026-10-04T02:00:00Z'),
  c = article(3, 'C', '2026-10-04T03:00:00Z');
const pair = (a: SimilarityArticle, b: SimilarityArticle, score = 0.9): SimilarityPair => ({
  id: `${a.id}-${b.id}`,
  a,
  b,
  score,
  containment: score,
  sharedShingles: 200,
  kind: 'high',
  evidence: `共同段落 ${a.id}:${b.id}`,
});
const citedA = { media: 'A', name: 'A', country: '台灣', countryCode: 'TW', kind: 'explicit' as const, evidence: '據 A 報導' };
// A–B–C chained by pairs: B and C both point to the earliest article, A, even without a C/A pair.
const evidence: SimilarityEvidence = {
  total: 45,
  page: 0,
  pageSize: 20,
  hiddenSources: 1,
  items: [
    {
      kind: 'origin',
      key: 'origin:story:1:3',
      publishedAt: c.publishedAt,
      articleId: 3,
      sourceId: 1,
      groupId: 'story:1',
      directPair: null,
    },
    { kind: 'citation', key: 'citation:2:A', publishedAt: b.publishedAt, articleId: 2, source: citedA },
    {
      kind: 'origin',
      key: 'origin:story:1:2',
      publishedAt: b.publishedAt,
      articleId: 2,
      sourceId: 1,
      groupId: 'story:1',
      directPair: pair(a, b),
    },
  ],
  articles: { 1: a, 2: b, 3: c },
  groups: {
    'story:1': { id: 'story:1', sourceId: 1, articleIds: [1, 2, 3], tiedFirst: 1, pairCount: 140, pairs: [pair(a, b), pair(b, c, 0.8)] },
  },
};

describe('story origins from an evidence page', () => {
  it('rebuilds origins pointing to the earliest article, keeping server order and keys', () => {
    const items = evidenceItems(evidence);
    expect(items.map((item) => item.key)).toEqual(['origin:story:1:3', 'citation:2:A', 'origin:story:1:2']);
    const origins = items.flatMap((item) => (item.kind === 'origin' ? [item.origin] : []));
    expect(origins.map((o) => [o.id, o.article.id, o.source.id])).toEqual([
      ['story:1:3', 3, 1],
      ['story:1:2', 2, 1],
    ]);
    // Without a measured C/A pair no direct score is invented.
    expect(origins[0].directPair).toBeNull();
    expect(origins[1].directPair?.score).toBe(0.9);
  });
  it('shares one group per story with its members, sent pairs and full pair count', () => {
    const origins = evidenceItems(evidence).flatMap((item) => (item.kind === 'origin' ? [item.origin] : []));
    expect(origins[0].group).toBe(origins[1].group);
    const group = origins[0].group;
    expect(group.source?.id).toBe(1);
    expect(group.articles.map((member) => member.id)).toEqual([1, 2, 3]);
    expect(group.pairs).toHaveLength(2);
    expect(group.pairCount).toBe(140);
    expect(group.tiedFirst).toBe(1);
  });
  it('attaches the citing article and the cited outlet with its evidence', () => {
    const [citation] = evidenceItems(evidence).filter((item) => item.kind === 'citation');
    expect(citation).toMatchObject({ kind: 'citation', publishedAt: b.publishedAt, citation: { article: { id: 2 }, source: citedA } });
  });
  it('skips references whose articles or group are missing instead of inventing them', () => {
    const partial: SimilarityEvidence = { ...evidence, articles: { 1: a, 3: c }, groups: {} };
    expect(evidenceItems(partial)).toEqual([]);
    expect(evidenceItems({ ...evidence, items: [], articles: {}, groups: {} })).toEqual([]);
    const withoutSource = evidenceItems({ ...evidence, articles: { 2: b, 3: c } });
    expect(withoutSource.map((item) => item.kind)).toEqual(['citation']);
  });
});
