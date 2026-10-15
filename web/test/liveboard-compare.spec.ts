import { describe, expect, it } from 'vitest';
import { panelRects, splitCamps } from '../src/app/liveboard/compare.mts';

const terms = (...tags: string[]) => tags.map((tag, i) => ({ tag, weight: 10 - i }));

describe('splitCamps', () => {
  it('puts what only one camp writes on its side and what both write between', () => {
    const green = terms('沈伯洋', '蔣萬安', '罷免', '台積電');
    const blue = [
      { tag: '蔣萬安', weight: 12 },
      { tag: '黃國昌', weight: 9 },
      { tag: '台積電', weight: 5 },
    ];
    expect(splitCamps(green, blue, 10)).toEqual({
      left: [
        { tag: '沈伯洋', weight: 10 },
        { tag: '罷免', weight: 8 },
      ],
      // Shared words take the larger weight, strongest first.
      middle: [
        { tag: '蔣萬安', weight: 12 },
        { tag: '台積電', weight: 7 },
      ],
      right: [{ tag: '黃國昌', weight: 9 }],
    });
  });
  it('only counts a word as shared when both have it in their top', () => {
    const green = terms('甲', '乙', '丙');
    const blue = terms('丁', '戊', '甲');
    expect(splitCamps(green, blue, 10, 2).middle).toEqual([]);
    expect(splitCamps(green, blue, 10, 3).middle.map((t) => t.tag)).toEqual(['甲']);
  });
  it('keeps at most `per` in each cloud', () => {
    const many = terms('a', 'b', 'c', 'd', 'e');
    expect(splitCamps(many, [], 2).left.map((t) => t.tag)).toEqual(['a', 'b']);
  });
});

describe('panelRects', () => {
  it('sets the clouds side by side under the band on a wide screen', () => {
    const r = panelRects(1200, 600, 100, 20, 30);
    expect(r.left).toEqual({ x: 0, y: 120, width: 380, height: 480 });
    expect(r.middle.x).toBe(410);
    expect(r.right.x + r.right.width).toBe(1200);
  });
  it('stacks them on a tall one', () => {
    const r = panelRects(420, 900, 100, 20, 30);
    expect(r.left.width).toBe(420);
    expect(r.middle.y).toBeGreaterThan(r.left.y + r.left.height);
    expect(r.right.y + r.right.height).toBeCloseTo(900);
  });
});
