import { describe, expect, it } from 'vitest';
import { eventHeadlineGroups } from '../../web/src/lib/event-headline-groups.mts';
import type { CompareArticle } from '../../web/src/lib/headline-compare.mts';
import { mediaHeadlineParts } from '../../web/src/lib/headline-group.mts';

const marked = (parts: ReturnType<typeof mediaHeadlineParts>[number]) =>
  parts
    .filter((p) => p.different)
    .map((p) => p.text)
    .join('');
const article = (id: number, media: string, title: string, publishedAt = '2026-10-08T01:00:00Z'): CompareArticle => ({
  id,
  media,
  title,
  publishedAt,
  mediaTitle: media,
  camp: 'other',
  url: `https://example.com/${id}`,
});

describe('event headlines grouped by media', () => {
  it('retains every article, including multiple headlines from the same media, newest first', () => {
    const input = [
      article(1, '甲媒體', '新聞！破圈'),
      article(2, '乙媒體', '新聞！封殺'),
      article(3, '甲媒體', '新聞！炸鍋', '2026-10-08T02:00:00Z'),
    ];
    const groups = eventHeadlineGroups(input);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.media === '甲媒體')?.headlines.map((r) => r.article.id)).toEqual([3, 1]);
    expect(
      groups
        .flatMap((g) => g.headlines)
        .map((r) => r.article.id)
        .sort(),
    ).toEqual([1, 2, 3]);
    for (const group of groups) for (const row of group.headlines) expect(row.parts.map((p) => p.text).join('')).toBe(row.article.title);
  });

  it('does not treat repeated wording within one media as cross-media shared wording', () => {
    const input = [article(1, '甲', '新聞！破圈'), article(2, '甲', '新聞！破圈'), article(3, '乙', '新聞！封殺')];
    expect(mediaHeadlineParts(input).map(marked)).toEqual(['破圈', '破圈', '封殺']);
    const shared = [...input, article(4, '乙', '新聞！破圈')];
    expect(mediaHeadlineParts(shared).map(marked)).toEqual(['', '', '封殺', '']);
    expect(mediaHeadlineParts([...input].reverse()).reverse()).toEqual(mediaHeadlineParts(input));
  });

  it('compares all headlines beyond sixty and leaves single-media input plain', () => {
    const input = Array.from({ length: 61 }, (_, i) => article(i, '甲', '新聞！破圈'));
    expect(mediaHeadlineParts(input).every((parts) => marked(parts) === '')).toBe(true);
    expect(mediaHeadlineParts([...input, article(99, '乙', '新聞！封殺')]).map(marked)).toEqual([...Array(61).fill('破圈'), '封殺']);
    expect(eventHeadlineGroups([])).toEqual([]);
  });
});
