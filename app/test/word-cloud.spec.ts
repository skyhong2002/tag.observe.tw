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
