import { describe, expect, it } from 'vitest';
import { layoutWordCloud } from '../../web/src/lib/word-cloud.mts';

describe('word-cloud packing', () => {
  it('lays out mixed scripts deterministically without overlaps or clipped boxes', () => {
    const terms = Array.from({ length: 50 }, (_, i) => ({ label: i % 3 === 0 ? `Technology ${i}` : `關鍵字${i}`, count: 50 - i }));
    const placed = layoutWordCloud(terms);
    expect(placed.length).toBeGreaterThan(20);
    expect(placed).toEqual(layoutWordCloud(terms));
    expect(placed[0].fontSize).toBeGreaterThan(placed.at(-1)!.fontSize);
    for (const [i, term] of placed.entries()) {
      expect(term.x).toBeGreaterThanOrEqual(0);
      expect(term.y).toBeGreaterThanOrEqual(0);
      expect(term.x + term.width).toBeLessThanOrEqual(300);
      expect(term.y + term.height).toBeLessThanOrEqual(230);
      for (const other of placed.slice(i + 1))
        expect(
          term.x + term.width <= other.x ||
            other.x + other.width <= term.x ||
            term.y + term.height <= other.y ||
            other.y + other.height <= term.y,
        ).toBe(true);
    }
  });
  it('handles empty, invalid, repeated and excessively long terms', () => {
    expect(layoutWordCloud([])).toEqual([]);
    expect(layoutWordCloud([{ label: '無法容納'.repeat(200), count: 20 }])).toEqual([]);
    expect(layoutWordCloud([{ label: 'AI', count: 3 }], 0, 0)).toEqual([]);
    const result = layoutWordCloud([
      { label: '', count: 3 },
      { label: 'AI', count: 3 },
      { label: 'AI', count: 2 },
      { label: '錯誤', count: Infinity },
      { label: '零', count: 0 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('AI');
  });
});

describe('word-cloud size range', () => {
  const terms = Array.from({ length: 30 }, (_, i) => ({ label: `詞${i}`, count: 30 - i }));
  it('spreads a wide cloud between the requested sizes', () => {
    const compact = layoutWordCloud(terms);
    const wide = layoutWordCloud(terms, 760, 400, { min: 13, max: 76, budget: 0.7 });
    expect(wide[0].fontSize).toBeGreaterThan(compact[0].fontSize * 1.5);
    expect(wide[0].fontSize).toBeGreaterThanOrEqual(wide.at(-1)!.fontSize * 3);
    expect(wide.every((word) => word.x + word.width <= 760 && word.y + word.height <= 400)).toBe(true);
    expect(wide.length).toBeGreaterThanOrEqual(25);
  });
  it('places more than 50 terms on request and keeps the spread with a steeper curve and lower floor', () => {
    const many = Array.from({ length: 160 }, (_, i) => ({ label: `詞${i}`, count: 160 - i }));
    const wide = layoutWordCloud(many, 960, 520, { min: 11, max: 80, budget: 0.7, curve: 1.3, words: 160 });
    expect(wide.length).toBeGreaterThan(50);
    const phone = layoutWordCloud(many, 320, 600, { min: 9, max: 72, floor: 9, budget: 1.1, curve: 1.3, words: 160 });
    expect(phone.at(-1)!.fontSize).toBeGreaterThanOrEqual(9);
    expect(phone[0].fontSize).toBeGreaterThanOrEqual(phone.at(-1)!.fontSize * 3);
    expect(phone.every((word) => word.x + word.width <= 320 && word.y + word.height <= 600)).toBe(true);
  });
  it('fills the gaps of a large canvas with a few hundred terms', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ label: i % 4 === 0 ? `Tag${i}` : `關鍵字${i}`, count: 1000 / (i + 1) }));
    const placed = layoutWordCloud(many, 1120, 640, { min: 10, max: 88, floor: 10, budget: 0.7, curve: 1.5, words: 500 });
    expect(placed.length).toBeGreaterThan(300);
    for (const [i, a] of placed.entries())
      for (const b of placed.slice(i + 1))
        expect(a.x + a.width + 3 <= b.x || b.x + b.width + 3 <= a.x || a.y + a.height + 3 <= b.y || b.y + b.height + 3 <= a.y).toBe(true);
  });
  it('rejects an inverted or empty size range', () => {
    expect(layoutWordCloud(terms, 760, 330, { min: 40, max: 20 })).toEqual([]);
    expect(layoutWordCloud(terms, 760, 330, { min: 0, max: 20 })).toEqual([]);
  });
});
