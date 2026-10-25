import { describe, expect, it } from 'vitest';
import { campColour, mixHex, spreadCamps, spreadX } from '../src/app/liveboard/compare.mts';
import { layoutWordCloud } from '../src/lib/word-cloud.mts';

describe('spreadCamps', () => {
  // Green ranks twice as many articles in all; share of voice evens that out.
  const green = [
    { tag: '沈伯洋', weight: 84, count: 300 },
    { tag: '蔣萬安', weight: 82, count: 200 },
    { tag: '中國', weight: 70, count: 100 },
  ];
  const blue = [
    { tag: '蔣萬安', weight: 81, count: 100 },
    { tag: '徐佳青', weight: 72, count: 80 },
    { tag: '沈伯洋', weight: 80, count: 20 },
  ];
  const at = new Map(spreadCamps(green, blue, 10).map((t) => [t.tag, t]));
  it('puts an even share of voice in the middle, whatever each camp wrote in all', () => {
    // 200/600 against 100/200: a third against a half.
    expect(at.get('蔣萬安')?.blue).toBeGreaterThan(0.5);
    // 300/600 against 20/200: five times as much from green, past the edge.
    expect(at.get('沈伯洋')?.blue).toBe(0);
  });
  it('counts a word one camp did not rank as half its smallest', () => {
    // 徐佳青 0.4 of blue against green's 50/600: well past four times.
    expect(at.get('徐佳青')?.blue).toBe(1);
    // 中國 100/600 against blue's 10/200: over three times green's.
    expect(at.get('中國')?.blue).toBeLessThan(0.15);
  });
  it('is twice either way at a quarter from the middle', () => {
    // x is a quarter of green's and half of blue's.
    const even = spreadCamps(
      [
        { tag: 'x', weight: 1, count: 1 },
        { tag: 'y', weight: 1, count: 3 },
      ],
      [
        { tag: 'x', weight: 1, count: 2 },
        { tag: 'y', weight: 1, count: 2 },
      ],
      2,
    );
    expect(even.find((t) => t.tag === 'x')?.blue).toBeCloseTo(0.75);
  });
  it('sizes by the larger score and keeps the heaviest `words`', () => {
    expect(at.get('沈伯洋')?.weight).toBe(84);
    expect(spreadCamps(green, blue, 2).map((t) => t.tag)).toEqual(['沈伯洋', '蔣萬安']);
  });
});

describe('spectrum placement and colour', () => {
  it('runs green to blue across, inside the padding', () => {
    expect(spreadX(0, 1000, 70)).toBe(70);
    expect(spreadX(0.5, 1000, 70)).toBe(500);
    expect(spreadX(1, 1000, 70)).toBe(930);
  });
  it('passes through the ink, not a mix of the two hues', () => {
    expect(campColour(0, '#15803d', '#27272a', '#1d4ed8')).toBe('#15803d');
    expect(campColour(0.5, '#15803d', '#27272a', '#1d4ed8')).toBe('#27272a');
    expect(campColour(1, '#15803d', '#27272a', '#1d4ed8')).toBe('#1d4ed8');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
  it('keeps each word near its x, never placing it somewhere else', () => {
    const terms = Array.from({ length: 20 }, (_, i) => ({ label: `詞${i}`, count: 20 - i }));
    const anchors = new Map(terms.map((t, i) => [t.label, { x: i % 2 ? 150 : 850, y: 150 }]));
    const placed = layoutWordCloud(terms, 1000, 300, {
      min: 14,
      max: 40,
      anchors,
      anchorOnly: true,
      anchorReach: 80,
      anchorStretch: 150 / 80,
    });
    expect(placed.length).toBeGreaterThan(10);
    for (const w of placed) expect(Math.abs(w.x + w.width / 2 - (anchors.get(w.label)?.x ?? 0))).toBeLessThanOrEqual(81);
  });
});
