import { describe, expect, it } from 'vitest';
import { bucketByHour, coverageWindow, dayRange, pickPeriodThreads, taipeiDay, trailsEnding } from './event-archive.ts';

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
});
