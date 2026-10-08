import { describe, expect, it } from 'vitest';
import { eventHeadlineGroups } from '../../web/src/lib/event-headline-groups.mts';
import { eventHeadlinePicks } from '../../web/src/lib/event-headline-picks.mts';
import type { CompareArticle } from '../../web/src/lib/headline-compare.mts';
import { distinctiveHeadlineParts } from '../../web/src/lib/headline-emphasis.mts';

const articles = [
  { media: 'a', title: '快新聞／沈伯洋1打5？上趙少康節目驚見「5大主持人」　本人正面迎戰' },
  { media: 'b', title: '國民黨狂抹黑毒品立場 沈伯洋正面看待：大型衛教也不錯' },
  { media: 'c', title: '蔣萬安：任何市政議題都能討論 沈伯洋稱第一場可談毒品政策' },
  { media: 'd', title: '沈伯洋毒品立場引發討論　蔣萬安最新回應' },
];

describe('sparse headline emphasis', () => {
  it('preserves exact text, omits boilerplate and short fragments, and caps marked area', () => {
    const result = distinctiveHeadlineParts(articles);
    expect(result.flat().some((p) => p.different)).toBe(true);
    result.forEach((parts, i) => {
      expect(parts.map((p) => p.text).join('')).toBe(articles[i].title);
      const marks = parts.filter((p) => p.different);
      expect(marks.length).toBeLessThanOrEqual(2);
      expect(marks.reduce((n, p) => n + [...p.text].length, 0)).toBeLessThanOrEqual(Math.floor([...articles[i].title].length * 0.25));
      expect(marks.every((p) => [...p.text].length >= 4 && [...p.text].length <= 12)).toBe(true);
      expect(marks.some((p) => /快新聞|本人|最新回應|引發討論/.test(p.text))).toBe(false);
    });
  });
  it('does not paint an entire unique sentence or require a highlight on every title', () => {
    const input = [
      { media: 'a', title: '新聞！被問是否還會參加其他候選人的競選活動' },
      { media: 'b', title: '新聞！本人回應' },
    ];
    expect(
      distinctiveHeadlineParts(input)
        .flat()
        .some((p) => p.different),
    ).toBe(false);
    expect(
      distinctiveHeadlineParts([{ media: 'a', title: '只有一家媒體的標題' }])
        .flat()
        .some((p) => p.different),
    ).toBe(false);
  });
  it('uses identical emphasis for featured and expanded versions, independent of input order', () => {
    const input: CompareArticle[] = articles.map((a, id) => ({
      ...a,
      id,
      mediaTitle: a.media,
      camp: id % 2 ? 'green' : 'blue',
      url: `https://example.com/${id}`,
      publishedAt: '2026-10-08T01:00:00Z',
    }));
    const groups = eventHeadlineGroups(input);
    const full = new Map(groups.flatMap((g) => g.headlines.map((h) => [h.article.id, h.parts] as const)));
    const picks = eventHeadlinePicks(input, articles[1].title).flatMap((c) => c.picks);
    expect(picks.length).toBeGreaterThan(0);
    for (const pick of picks) expect(pick.parts).toEqual(full.get(pick.article.id));
    expect(distinctiveHeadlineParts([...articles].reverse()).reverse()).toEqual(distinctiveHeadlineParts(articles));
  });
});
