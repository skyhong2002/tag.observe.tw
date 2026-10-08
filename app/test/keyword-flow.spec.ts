import { describe, expect, it } from 'vitest';
import { dayKeywordFlow, keywordFlow, threadKeywordFlow } from '../../web/src/lib/keyword-flow.mts';

const col = (key: string) => ({ key, label: key, title: key });

describe('keyword flow', () => {
  it('orders keywords by when they came in and keeps main ones', () => {
    const { rows } = keywordFlow(
      [col('a'), col('b'), col('c')],
      [
        new Map([['甲', 4]]),
        new Map([
          ['甲', 2],
          ['乙', 9],
        ]),
        new Map([['丙', 1]]),
      ],
      { limit: 2, major: ['丙'] },
    );
    expect(rows.map((r) => [r.tag, r.first, r.major])).toEqual([
      ['乙', 1, false],
      ['丙', 2, true],
    ]);
    expect(rows[0].cells).toEqual([null, 1, null]);
  });
  it('places a day of hours on the stories ranked in the top then', () => {
    const hours = ['2026-10-07T16:00:00.000Z', '2026-10-07T17:00:00.000Z'];
    const trail = (a: number | null, b: number | null) => [a, b, ...Array(22).fill(null)];
    const { columns, rows } = dayKeywordFlow('2026-10-08', hours, [
      { major: ['颱風', '停班'], trail: trail(1, null) },
      { major: ['選舉'], trail: trail(9, 2) },
    ]);
    expect(columns.map((c) => c.label)).toEqual(['00', '01']);
    expect(rows.map((r) => [r.tag, r.raw])).toEqual([
      ['颱風', [1, null]],
      ['停班', [1, null]],
      ['選舉', [null, 0.875]],
    ]);
  });
  it("merges an event's hours into Taipei days", () => {
    const { columns, rows } = threadKeywordFlow(
      [
        { hourStart: '2026-10-07T15:00:00.000Z', tags: [['甲', 3]] },
        {
          hourStart: '2026-10-07T16:00:00.000Z',
          tags: [
            ['甲', 5],
            ['乙', 2],
          ],
        },
        { hourStart: '2026-10-07T17:00:00.000Z', tags: [['甲', 1]] },
      ],
      ['甲'],
      'day',
    );
    expect(columns.map((c) => c.key)).toEqual(['2026-10-07', '2026-10-08']);
    expect(rows.find((r) => r.tag === '甲')?.raw).toEqual([3, 5]);
  });
});
