import { describe, expect, it } from 'vitest';
import { gapLabel, kindLine, type RaceItem, raceRounds, raceSummary, statusLine, topicStart } from '../../web/src/lib/topic-race.mts';

const item = (media: string, over: Partial<RaceItem> = {}): RaceItem & { id: string } => ({
  id: `${media}-${Math.random()}`,
  media,
  mediaTitle: media.toUpperCase(),
  kind: 'topic',
  status: 'active',
  backlog: false,
  time: null,
  storyFirstAt: null,
  ...over,
});

describe('topicStart', () => {
  it('takes the earlier of the first story and first sighting', () => {
    expect(topicStart({ time: '2026-05-10T00:00:00Z', storyFirstAt: '2026-05-08T00:00:00Z' })).toBe('2026-05-08T00:00:00Z');
    expect(topicStart({ time: '2026-05-10T00:00:00Z', storyFirstAt: '2026-05-12T00:00:00Z' })).toBe('2026-05-10T00:00:00Z');
    expect(topicStart({ time: '2026-05-10T00:00:00Z' })).toBe('2026-05-10T00:00:00Z');
  });
  it('ignores the sighting of a backlog row: unknown without a first story', () => {
    expect(topicStart({ backlog: true, time: '2026-01-01T00:00:00Z', storyFirstAt: null })).toBeNull();
    expect(topicStart({ backlog: true, time: '2026-01-01T00:00:00Z', storyFirstAt: '2026-03-01T00:00:00Z' })).toBe('2026-03-01T00:00:00Z');
  });
});

describe('raceRounds', () => {
  const items = [
    item('b', { time: '2026-05-04T03:00:00Z' }),
    item('a', { backlog: true, time: '2026-01-01T00:00:00Z' }),
    item('c', { time: '2026-05-01T20:00:00Z', kind: 'feature' }),
    item('b', { time: '2026-05-01T02:00:00Z', kind: 'feature' }),
    item('d', { time: '2026-05-01T17:00:00Z' }),
  ];
  const rounds = raceRounds(items);
  const outlets = rounds[0].outlets;
  it('orders outlets by their earliest start, unknown starts last on their own', () => {
    expect(rounds.map((r) => r.outlets.map((o) => o.media))).toEqual([['b', 'd', 'c'], ['a']]);
    expect(outlets.map((o) => o.start)).toEqual(['2026-05-01T02:00:00Z', '2026-05-01T17:00:00Z', '2026-05-01T20:00:00Z']);
    expect(rounds[1]).toMatchObject({ start: null, end: null });
    expect(rounds[1].outlets[0].gapDays).toBeNull();
  });
  it('lists each outlet’s items earliest first', () => {
    expect(outlets[0].items.map((t) => t.kind)).toEqual(['feature', 'topic']);
    expect(outlets[0].items[0].id).toBe(items[3].id);
  });
  it('counts the gap in Taipei calendar days', () => {
    // 05-01 17:00Z is 05-02 01:00 in Taipei: one day after b's 05-01 10:00.
    expect(outlets.map((o) => o.gapDays)).toEqual([0, 1, 1]);
    expect(outlets.map((o, i) => gapLabel(o.gapDays, i))).toEqual(['最早', '+1 天', '+1 天']);
    expect(gapLabel(0, 2)).toBe('同一天');
    expect(gapLabel(null, 0)).toBeNull();
  });
  it('opens a new round when a keyword returns after everything went quiet', () => {
    const rounds = raceRounds([
      item('x', { time: '2026-09-28T00:00:00Z', storyLastAt: '2026-10-02T00:00:00Z' }),
      item('old', { backlog: true, storyFirstAt: '2017-04-02T00:00:00Z', storyLastAt: '2019-06-30T00:00:00Z', status: 'ended' }),
      item('old', { time: '2026-09-29T00:00:00Z' }),
      item('y', { backlog: true }),
      // Within 90 days of the 2019 end: still the old round.
      item('z', { time: '2019-09-01T00:00:00Z', kind: 'feature' }),
    ]);
    expect(rounds.map((r) => r.outlets.map((o) => o.media))).toEqual([['old', 'z'], ['x', 'old'], ['y']]);
    expect(rounds[0].end).toBe('2019-09-01T00:00:00Z');
    expect(rounds[1].end).toBe('2026-10-02T00:00:00Z');
    expect(rounds[1].outlets.map((o) => o.gapDays)).toEqual([0, 1]);
  });
  it('makes one group when no start is known', () => {
    const rounds = raceRounds([item('a', { backlog: true }), item('b', { backlog: true })]);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].start).toBeNull();
    expect(rounds[0].outlets.map((o) => o.gapDays)).toEqual([null, null]);
  });
});

describe('raceSummary', () => {
  it('counts outlets by kind and 議題 status', () => {
    const s = raceSummary([
      item('a'),
      item('a', { kind: 'feature' }),
      item('b', { status: 'ended' }),
      item('b'),
      item('c', { status: 'ended' }),
      item('d', { kind: 'feature' }),
    ]);
    expect(s).toEqual({ outlets: 4, topicOutlets: 3, featureOutlets: 2, bothOutlets: 1, activeOutlets: 2, endedOutlets: 1 });
    expect(kindLine(s)).toBe('4 家：3 家做成議題、2 家做成專題（1 家兩種都有）');
    expect(statusLine(s)).toBe('議題中 2 家仍在更新、1 家已停更');
  });
  it('words one-kind results plainly', () => {
    const features = raceSummary([item('a', { kind: 'feature' }), item('b', { kind: 'feature' })]);
    expect(kindLine(features)).toBe('2 家都做成專題');
    expect(statusLine(features)).toBeNull();
    const topics = raceSummary([item('a'), item('b')]);
    expect(kindLine(topics)).toBe('2 家都做成議題');
    expect(statusLine(topics)).toBe('議題中 2 家仍在更新');
  });
});
