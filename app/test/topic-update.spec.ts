import { describe, expect, it } from 'vitest';
import { groupByUpdate, updatedAtOf } from '../../web/src/lib/topic-update.mts';

describe('updatedAtOf', () => {
  it('uses the API value when sent, even null', () => {
    expect(updatedAtOf({ updatedAt: '2026-10-01T00:00:00Z', storyLastAt: null, time: '2026-10-03T00:00:00Z' })).toBe(
      '2026-10-01T00:00:00Z',
    );
    expect(updatedAtOf({ updatedAt: null, time: '2026-10-03T00:00:00Z' })).toBeNull();
  });
  it('derives it on older API builds', () => {
    expect(updatedAtOf({ storyLastAt: '2026-09-01T00:00:00Z', time: '2026-10-03T00:00:00Z', backlog: true })).toBe('2026-09-01T00:00:00Z');
    expect(updatedAtOf({ storyLastAt: null, time: '2026-10-03T00:00:00Z', backlog: false })).toBe('2026-10-03T00:00:00Z');
    expect(updatedAtOf({ storyLastAt: null, time: '2026-10-03T00:00:00Z', backlog: true })).toBeNull();
  });
});

describe('groupByUpdate', () => {
  // 2026-10-04 12:00 in Taiwan.
  const now = new Date('2026-10-04T04:00:00Z');
  const t = (id: string, updatedAt: string | null) => ({ id, updatedAt, time: '2026-09-28T00:00:00Z' });
  it('groups by the Taiwan day of the last update, unknown last', () => {
    const groups = groupByUpdate(
      [
        t('a', '2026-10-03T16:30:00Z'), // 10/4 00:30 Taiwan
        t('b', '2026-10-03T15:00:00Z'), // 10/3 23:00 Taiwan
        t('c', '2026-09-28T00:00:00Z'),
        t('d', '2026-08-01T00:00:00Z'),
        t('e', null),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['今天更新', ['a']],
      ['昨天更新', ['b']],
      ['本週更新', ['c']],
      ['更早', ['d']],
      ['更新時間不明（追蹤前已上架）', ['e']],
    ]);
  });
  it('leaves out empty groups', () => {
    expect(groupByUpdate([t('x', null)], now).map((g) => g.key)).toEqual(['unknown']);
  });
});
