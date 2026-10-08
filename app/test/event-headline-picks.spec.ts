import { describe, expect, it } from 'vitest';
import { eventHeadlinePicks, eventMediaColumns } from '../../web/src/lib/event-headline-picks.mts';
import type { CompareArticle, HeadlineCamp } from '../../web/src/lib/headline-compare.mts';

const article = (id: number, media: string, camp: HeadlineCamp, title: string): CompareArticle => ({
  id,
  media,
  camp,
  title,
  mediaTitle: media,
  publishedAt: '2026-10-08T01:00:00Z',
  url: `https://example.com/${id}`,
});
const focus = '沈伯洋毒品政策辯論 蔣萬安回應';
const articles = [
  article(1, '藍一', 'blue', focus),
  article(2, '藍二', 'blue', focus),
  article(3, '藍一', 'blue', '毒品政策辯論！沈伯洋質疑蔣萬安立場'),
  article(4, '綠一', 'green', '沈伯洋談毒品政策：應重視科學證據'),
  article(5, '其他一', 'other', '毒品政策辯論開打　醫師解析爭議焦點'),
  article(6, '其他二', 'other', '颱風接近 全台停班停課最新資訊'),
];

describe('compact event headline picks', () => {
  it('uses existing outlet camps and omits unrelated and duplicate headlines', () => {
    const columns = eventHeadlinePicks(articles, focus);
    expect(columns.map((c) => c.camp)).toEqual(['blue', 'green', 'other']);
    const picks = columns.flatMap((c) => c.picks);
    expect(picks.map((p) => p.article.id)).toEqual([1, 4, 5]);
    expect(new Set(picks.map((p) => p.article.media)).size).toBe(picks.length);
    for (const c of columns)
      for (const p of c.picks) {
        expect(p.article.camp).toBe(c.camp);
        expect(p.parts.map((part) => part.text).join('')).toBe(p.article.title);
      }
  });
  it('keeps selection deterministic, respects per-column limits, and handles no matches', () => {
    expect(eventHeadlinePicks([...articles].reverse(), focus)).toEqual(eventHeadlinePicks(articles, focus));
    expect(eventHeadlinePicks(articles, focus, 1).every((c) => c.picks.length <= 1)).toBe(true);
    expect(eventHeadlinePicks(articles, '完全無關的天氣預報').every((c) => c.picks.length === 0)).toBe(true);
    expect(eventHeadlinePicks([], focus).every((c) => c.picks.length === 0)).toBe(true);
  });
});

describe('one visible headline per outlet', () => {
  it('keeps every media visible, even when its title duplicates another outlet or differs from the focus', () => {
    const columns = eventMediaColumns(articles, focus);
    const media = columns.flatMap((c) => c.media);
    expect(media).toHaveLength(new Set(articles.map((a) => a.media)).size);
    expect(new Set(media.map((m) => m.media))).toEqual(new Set(articles.map((a) => a.media)));
    const first = media.find((m) => m.media === '藍一')!;
    expect(first.lead.article.id).toBe(1);
    expect(first.remaining.map((r) => r.article.id)).toEqual([3]);
    expect(media.find((m) => m.media === '其他二')?.lead.article.id).toBe(6);
    const allIds = media.flatMap((m) => [m.lead.article.id, ...m.remaining.map((r) => r.article.id)]);
    expect(allIds.sort()).toEqual(articles.map((a) => a.id).sort());
    for (const c of columns) for (const m of c.media) expect(m.lead.article.camp).toBe(c.camp);
  });
  it('keeps deterministic ordering and needs no disclosure for single-report outlets', () => {
    expect(eventMediaColumns([...articles].reverse(), focus)).toEqual(eventMediaColumns(articles, focus));
    expect(eventMediaColumns([articles[0]], focus)[0].media[0].remaining).toEqual([]);
    expect(eventMediaColumns([], focus).every((c) => c.media.length === 0)).toBe(true);
  });
});
