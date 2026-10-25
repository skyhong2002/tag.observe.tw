import { describe, expect, it } from 'vitest';
import { relationDetails, relationLabel } from '../../web/src/lib/relation-label.mts';
import { groupStories, type LiveArticle } from '../src/v1/liveboard.ts';

const a: LiveArticle = {
  id: 1,
  media: 'cna',
  mediaTitle: '中央社',
  camp: 'other',
  title: '新聞',
  url: 'https://example.com/1',
  image: null,
  publishedAt: '2026-10-05T11:15:00Z',
  datePending: false,
  tags: [],
  text: '正文'.repeat(200),
  authors: ['高華謙'],
};
const b: LiveArticle = {
  ...a,
  id: 2,
  media: 'msn',
  mediaTitle: 'MSN新聞',
  attributions: [{ media: 'cna', name: '中央社', country: '台灣', countryCode: 'TW', evidence: '來源：中央社', kind: 'explicit' }],
};
const pair = { aId: 1, bId: 2, score: 1, containment: 1, kind: 'identical', evidence: '共同段落', computedAt: new Date() };

describe('liveboard API relationship evidence', () => {
  it('preserves shared byline and explicit CNA attribution in grouped stories', () => {
    const [story] = groupStories(
      [pair],
      new Map([
        [1, a],
        [2, b],
      ]),
    );
    const featured = story.followers[0];
    expect(relationLabel(featured.relation)).toBe('同署名跨站刊登');
    expect(relationDetails(featured.relation, a.mediaTitle, b.mediaTitle)).toBe('同署名：高華謙 · MSN新聞註明來源中央社');
  });
});
