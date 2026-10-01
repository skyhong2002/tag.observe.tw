import { describe, expect, it } from 'vitest';
import { bucketByHour, dayRange, taipeiDay } from './event-archive.ts';

const cats = { blue: ['udn'], green: ['ltn'] };
const t = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 30, h, m));

describe('event archive', () => {
  it('maps Taipei days to UTC ranges', () => {
    expect(dayRange('2026-10-01')).toEqual({ from: t(16), to: new Date(Date.UTC(2026, 9, 1, 16)) });
    expect(taipeiDay(t(15, 59))).toBe('2026-09-30');
    expect(taipeiDay(t(16))).toBe('2026-10-01');
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
});
