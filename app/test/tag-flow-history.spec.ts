import { describe, expect, it } from 'vitest';
import {
  flowVisibleRange,
  prependTagFlow,
  settledKeywordOrder,
  type TagFlow,
  tagFlowTimeline,
  visibleFlowKeywords,
} from '../../web/src/lib/tag-flow-history.mts';

const window = (from: string, to: string, points: TagFlow['points'] = []): TagFlow => ({
  tag: '蔣萬安',
  span: 'day',
  hours: 336,
  from,
  to,
  points,
  sampled: false,
  hasMore: true,
});
describe('tag history windows', () => {
  it('brings historical topics into view after the visible period settles', () => {
    const current = tagFlowTimeline(
      window('2026-10-01T16:00:00.000Z', '2026-10-03T16:00:00.000Z', [
        {
          t: '2026-10-01T16:00:00.000Z',
          count: 5,
          tags: [
            ['民調', 5],
            ['選舉', 2],
          ],
        },
      ]),
    );
    const historical = tagFlowTimeline(
      window('2026-09-29T16:00:00.000Z', '2026-10-01T16:00:00.000Z', [
        {
          t: '2026-09-29T16:00:00.000Z',
          count: 100,
          tags: [
            ['歷史', 100],
            ['選舉', 20],
          ],
        },
      ]),
    );
    const initialOrder = visibleFlowKeywords(current, 0, current.length, '');
    const olderOrder = visibleFlowKeywords(historical, 0, historical.length, '');
    expect(settledKeywordOrder(initialOrder, olderOrder, 2)).toEqual(['選舉', '歷史']);
  });
  it('preserves the relative order of shared leading topics', () => {
    expect(settledKeywordOrder(['選舉', '民調', '交通'], ['民調', '歷史', '選舉', '交通'], 3)).toEqual(['選舉', '民調', '歷史', '交通']);
  });
  it('appends more rows without changing the existing visible prefix', () => {
    const ranked = Array.from({ length: 30 }, (_, i) => `tag-${i}`);
    const initial = settledKeywordOrder(['tag-3', 'tag-0'], ranked, 12);
    const expanded = settledKeywordOrder(initial, ranked, 24);
    expect(expanded.slice(0, 12)).toEqual(initial.slice(0, 12));
    expect(expanded.slice(12, 24)).toEqual(ranked.slice(12, 24));
    expect(settledKeywordOrder(expanded, [], 12)).toEqual([]);
  });
  it('prepends older windows without shifting or recounting existing dates', () => {
    const current = window('2026-10-01T16:00:00.000Z', '2026-10-03T16:00:00.000Z', [
      { t: '2026-10-01T16:00:00.000Z', count: 2, tags: [['選舉', 2]] },
    ]);
    const older = window('2026-09-29T16:00:00.000Z', current.from, [{ t: '2026-09-29T16:00:00.000Z', count: 3, tags: [['歷史', 3]] }]);
    const result = prependTagFlow(current, { ...older, hasMore: false });
    expect(result.to).toBe(current.to);
    expect(result.hasMore).toBe(false);
    expect(tagFlowTimeline(result).slice(2)).toEqual(tagFlowTimeline(current));
    expect(result.points).toHaveLength(2);
    expect(() => prependTagFlow(current, { ...older, to: current.to })).toThrow('Invalid history window');
  });
  it('keeps empty dates so a gap is not mistaken for the end of history', () => {
    const columns = tagFlowTimeline(window('2026-09-29T16:00:00.000Z', '2026-10-02T16:00:00.000Z'));
    expect(columns.map((column) => column.label)).toEqual(['9/30', '10/1', '10/2']);
    expect(columns.every((column) => column.tags.size === 0)).toBe(true);
  });
  it('ranks and searches the visible dates, not distant loaded history', () => {
    const columns = tagFlowTimeline(
      window('2026-09-29T16:00:00.000Z', '2026-10-02T16:00:00.000Z', [
        { t: '2026-09-29T16:00:00.000Z', count: 100, tags: [['歷史', 100]] },
        {
          t: '2026-09-30T16:00:00.000Z',
          count: 4,
          tags: [
            ['台北選舉', 3],
            ['民調', 2],
          ],
        },
        { t: '2026-10-01T16:00:00.000Z', count: 5, tags: [['民調', 5]] },
      ]),
    );
    expect(visibleFlowKeywords(columns, 1, 3, '')).toEqual(['民調', '台北選舉']);
    expect(visibleFlowKeywords(columns, 1, 3, ' 選舉 ')).toEqual(['台北選舉']);
  });
  it('limits rendering to a viewport even after loading a thousand dates', () => {
    expect(flowVisibleRange(48 + 500 * 70, 1108, 70, 1000)).toEqual({ start: 500, end: 514 });
    expect(flowVisibleRange(0, 400, 56, 14)).toEqual({ start: 0, end: 4 });
  });
});
