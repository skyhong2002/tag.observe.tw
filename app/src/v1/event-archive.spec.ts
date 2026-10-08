import { describe, expect, it } from 'vitest';
import {
  bucketByHour,
  coverageWindow,
  dayRange,
  dayRuns,
  foldDayThreads,
  pickPeriodThreads,
  taipeiDay,
  trailsEnding,
} from './event-archive.ts';

const cats = { blue: ['udn'], green: ['ltn'] };
const t = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 30, h, m));

describe('event archive', () => {
  it('maps Taipei days to UTC ranges', () => {
    expect(dayRange('2026-10-01')).toEqual({ from: t(16), to: new Date(Date.UTC(2026, 9, 1, 16)) });
    expect(taipeiDay(t(15, 59))).toBe('2026-09-30');
    expect(taipeiDay(t(16))).toBe('2026-10-01');
  });
  it('judges coverage over the finished day, or the last 24h for today', () => {
    const day = dayRange('2026-10-01');
    expect(coverageWindow('2026-10-01', new Date(Date.UTC(2026, 9, 5)))).toEqual({ start: day.from, end: day.to });
    const now = new Date(Date.UTC(2026, 9, 1, 3, 20));
    expect(coverageWindow('2026-10-01', now)).toEqual({ start: new Date(now.getTime() - 24 * 3600e3), end: now });
  });
  it("draws each trail up to the thread's own last hour, best rank per hour", () => {
    const rows = [
      { threadId: 1, hourStart: t(5), rank: 1 },
      { threadId: 1, hourStart: t(5), rank: 3 },
      { threadId: 1, hourStart: t(7), rank: 2 },
      { threadId: 1, hourStart: t(8), rank: 9 },
      { threadId: 2, hourStart: t(4), rank: 7 },
      { threadId: null, hourStart: t(7), rank: 4 },
    ];
    const trails = trailsEnding(
      rows,
      new Map([
        [1, t(7)],
        [2, t(8)],
      ]),
      4,
    );
    expect(trails.get(1)).toEqual([null, 1, null, 2]);
    expect(trails.get(2)).toEqual([null, null, null, null]);
  });
  it('buckets articles per hour and camp, once per article, ignoring the outside', () => {
    const rows = [
      { id: 1, media: 'udn', publishedAt: t(2, 10) },
      { id: 1, media: 'udn', publishedAt: t(2, 10) },
      { id: 2, media: 'ltn', publishedAt: t(2, 50) },
      { id: 3, media: 'cna', publishedAt: t(4) },
      { id: 4, media: 'udn', publishedAt: t(5) },
      { id: 5, media: 'udn', publishedAt: t(1, 59) },
    ];
    const b = bucketByHour(rows, t(2), t(5), cats);
    expect(b.map((x) => x.t)).toEqual([t(2), t(3), t(4)].map((d) => d.toISOString()));
    expect(b[0]).toMatchObject({ blue: 1, green: 1, other: 0 });
    expect(b[1]).toMatchObject({ blue: 0, green: 0, other: 0 });
    expect(b[2]).toMatchObject({ other: 1 });
  });
  it('weighs period threads by summed hourly score and drops re-opened duplicates', () => {
    const rows = [
      { threadId: 1, hourStart: t(5), score: 10, rank: 2 },
      { threadId: 1, hourStart: t(5), score: 4, rank: 1 },
      { threadId: 1, hourStart: t(6), score: 10, rank: 3 },
      { threadId: 2, hourStart: t(5), score: 30, rank: 1 },
      { threadId: 3, hourStart: t(5), score: 8, rank: 4 },
      { threadId: 3, hourStart: t(6), score: 8, rank: 4 },
      { threadId: 4, hourStart: t(6), score: 1, rank: 9 },
      { threadId: null, hourStart: t(6), score: 99, rank: 1 },
    ];
    const majors = new Map<number, string[]>([
      [1, ['台股', '台積電']],
      [2, ['颱風']],
      [3, ['台積電', '台股', '美股']],
      [4, ['大罷免']],
    ]);
    expect(pickPeriodThreads(rows, majors, 5)).toEqual([
      { id: 2, weight: 30, hours: 1, bestRank: 1 },
      { id: 1, weight: 20, hours: 2, bestRank: 1 },
      { id: 4, weight: 1, hours: 1, bestRank: 9 },
    ]);
    expect(pickPeriodThreads(rows, majors, 1).map((p) => p.id)).toEqual([2]);
  });
  it("sums a thread's hours within the Taipei day on a 00:00-23:00 trail", () => {
    const { from } = dayRange('2026-10-01'); // 2026-09-30T16:00Z
    const rows = [
      { threadId: 1, hourStart: t(15), score: 50, rank: 1 }, // the evening before
      { threadId: 1, hourStart: t(16), score: 10, rank: 2 },
      { threadId: 1, hourStart: t(16), score: 4, rank: 1 },
      { threadId: 1, hourStart: t(18), score: 6, rank: 3 },
      { threadId: 2, hourStart: new Date(Date.UTC(2026, 9, 1, 15)), score: 7, rank: 5 },
    ];
    const runs = dayRuns(rows, from);
    expect(runs.get(1)).toMatchObject({ weight: 16, hours: 2, bestRank: 1 });
    expect(runs.get(1)?.trail.slice(0, 3)).toEqual([1, null, 3]);
    expect(runs.get(2)?.trail[23]).toBe(5);
    expect(runs.get(2)?.trail).toHaveLength(24);
  });
  it('folds same-story threads into the heaviest and ranks stories by their sum', () => {
    const story = (major: string[], urls: string[] = []) => ({ major, urls });
    const majors = new Map([
      [1, story(['蔡康永', '陳美鳳'])],
      [2, story(['颱風', '氣象署'], ['a'])],
      [3, story(['蔡康永', '台獨'])],
      [4, story(['台股'])],
      [5, story(['徐佳青', '僑委會', '民眾黨'])],
      [6, story(['民眾黨', '黃國昌'])],
      [7, story(['東北季風', '低溫'], ['b', 'a'])],
    ]);
    const weights = new Map([
      [1, 10],
      [2, 15],
      [3, 8],
      [4, 1],
      [5, 9],
      [6, 2],
      [7, 3],
    ]);
    // 6 shares only 民眾黨 with 5: a different story that day.
    expect(foldDayThreads(weights, majors)).toEqual([
      { id: 1, weight: 18, folded: [3] },
      { id: 2, weight: 18, folded: [7] },
      { id: 5, weight: 9, folded: [] },
      { id: 6, weight: 2, folded: [] },
      { id: 4, weight: 1, folded: [] },
    ]);
  });
});
