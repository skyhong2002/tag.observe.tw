import { describe, expect, it } from 'vitest';
import { type Candidate, perOutlet, rankRelated } from './article-related.ts';

const at = (hours: number) => new Date(Date.UTC(2026, 9, 1, hours));
const article = { title: '辛巴威直升機墜毀起火 知名富豪夫婦等6人罹難', publishedAt: at(0) };
const candidate = (id: number, title: string, sharedTags: string[], hours = 1, media = 'cna'): Candidate => ({
  id,
  media,
  title,
  publishedAt: at(hours),
  sharedTags,
});
// Rare tags weigh more, as with IDF over the window.
const weights: Record<string, number> = { 辛巴威: 9, 直升機: 7, 罹難: 7, 墜毀: 8, 富豪: 8, 選舉: 3 };
const weight = (tag: string) => weights[tag] ?? 5;

describe('rankRelated', () => {
  it('keeps several shared tags and ranks rarer tags and closer titles first', () => {
    const ranked = rankRelated(
      article,
      [
        candidate(1, '加州醫療直升機墜海 機上5人2死', ['直升機', '墜毀']),
        candidate(2, '富豪夫婦搭直升機失事 辛巴威當局調查', ['辛巴威', '直升機', '富豪']),
      ],
      weight,
    );
    expect(ranked.map((c) => c.id)).toEqual([2, 1]);
  });
  it('drops weak matches: one tag with a different title, two generic tags with no title overlap', () => {
    const ranked = rankRelated(
      article,
      [
        candidate(1, '尼泊爾雪崩 15名工作人員罹難', ['罹難']),
        candidate(2, '尼泊爾土石流釀30死 上百名登山客急撤離', ['罹難', '直升機']),
        candidate(3, '辛巴威直升機墜毀！知名富豪夫妻罹難', ['辛巴威']),
      ],
      weight,
    );
    expect(ranked.map((c) => c.id)).toEqual([3]);
  });
  it('lists one copy of near-identical titles and skips copies of the article itself', () => {
    const ranked = rankRelated(
      article,
      [
        candidate(1, '辛巴威直升機墜毀起火 知名富豪夫婦等6人罹難', ['辛巴威', '直升機', '富豪']),
        candidate(2, '直升機失事調查 富豪夫婦身分確認 辛巴威航管說明', ['辛巴威', '直升機', '富豪'], 2),
        candidate(3, '直升機失事調查 富豪夫婦身分確認 辛巴威航管說明 | 線報', ['辛巴威', '直升機', '富豪'], 3),
      ],
      weight,
    );
    expect(ranked.map((c) => c.id)).toEqual([2]);
  });
  it('breaks ties by publication time closest to the article', () => {
    const ranked = rankRelated(
      { title: '選舉新聞', publishedAt: at(10) },
      [candidate(1, '甲', ['選舉', '富豪', '墜毀'], 0), candidate(2, '乙', ['選舉', '富豪', '墜毀'], 11)],
      weight,
    );
    expect(ranked.map((c) => c.id)).toEqual([2, 1]);
  });
});

describe('perOutlet', () => {
  it('keeps the first items of each outlet in order', () => {
    const items = ['udn', 'udn', 'udn', 'cna', 'udn', 'ltn'].map((media, id) => ({ id, media }));
    expect(perOutlet(items, 2).map((item) => item.id)).toEqual([0, 1, 3, 5]);
  });
});
