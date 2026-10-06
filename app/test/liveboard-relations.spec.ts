import { describe, expect, it } from 'vitest';
import { COPY_TONE_LABEL, copyTone, featuredFollower, storyCards } from '../../web/src/lib/liveboard.mts';
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

describe('liveboard comparison cards', () => {
  it('presents the screenshot as shared byline and credited CNA content, one card per story', () => {
    const [story] = groupStories(
      [pair],
      new Map([
        [1, a],
        [2, b],
      ]),
    );
    const featured = featuredFollower(story)!;
    expect(relationLabel(featured.relation)).toBe('同署名跨站刊登');
    expect(relationDetails(featured.relation, a.mediaTitle, b.mediaTitle)).toBe('同署名：高華謙 · MSN新聞註明來源中央社');
    expect(COPY_TONE_LABEL[copyTone(featured)]).toBe('內文相同');
    expect(storyCards([story], 0)[0].key).toBe(`copy:${story.key}`);
  });
  it('never substitutes an indirect score when the featured article changes', () => {
    const [story] = groupStories(
      [pair],
      new Map([
        [1, a],
        [2, b],
      ]),
    );
    story.followers[0].direct = false;
    expect(featuredFollower(story)).toBeNull();
    expect(storyCards([story], 0)).toEqual([]);
    expect(copyTone({ kind: 'high', score: 0.99 })).not.toBe('same');
  });
});
