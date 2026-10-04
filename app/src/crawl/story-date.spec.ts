import { describe, expect, it } from 'vitest';
import { dateFromAttr, dateFromText } from './story-date.ts';

// 2026-10-04 12:00 in Taiwan.
const now = new Date('2026-10-04T04:00:00Z');
const iso = (d: Date | null) => d?.toISOString() ?? null;

describe('dateFromText', () => {
  it('reads the printed forms as Taipei time', () => {
    expect(iso(dateFromText('2024-11-28 16:57', now))).toBe('2024-11-28T08:57:00.000Z');
    expect(iso(dateFromText('發布 2024/8/4 08:56', now))).toBe('2024-08-04T00:56:00.000Z');
    expect(iso(dateFromText('2024.11.28', now))).toBe('2024-11-27T16:00:00.000Z');
    expect(iso(dateFromText('2024年11月28日 下午 3:05', now))).toBe('2024-11-28T07:05:00.000Z');
    expect(iso(dateFromText('民國113年11月28日', now))).toBe('2024-11-27T16:00:00.000Z');
    expect(iso(dateFromText('113年11月28日', now))).toBe('2024-11-27T16:00:00.000Z');
  });
  it('counts relative dates back from now', () => {
    expect(iso(dateFromText('4小時前', now))).toBe('2026-10-04T00:00:00.000Z');
    expect(iso(dateFromText('15 分鐘前', now))).toBe('2026-10-04T03:45:00.000Z');
    expect(iso(dateFromText('3天前', now))).toBe('2026-10-01T04:00:00.000Z');
    expect(iso(dateFromText('昨天 18:00', now))).toBe('2026-10-02T16:00:00.000Z');
  });
  it('ignores impossible and implausible dates', () => {
    expect(dateFromText('2024/13/01', now)).toBeNull();
    expect(dateFromText('2024-02-30', now)).toBeNull();
    expect(dateFromText('1990/01/01', now)).toBeNull();
    expect(dateFromText('2026/10/09', now)).toBeNull();
    expect(dateFromText('2026年世足賽', now)).toBeNull();
  });
});

describe('dateFromAttr', () => {
  it('reads ISO with or without a zone, and epoch times', () => {
    expect(iso(dateFromAttr('2024-04-22T15:43:00+08:00', now))).toBe('2024-04-22T07:43:00.000Z');
    expect(iso(dateFromAttr('2024-04-22T07:43:00Z', now))).toBe('2024-04-22T07:43:00.000Z');
    expect(iso(dateFromAttr('2024-04-22 15:43', now))).toBe('2024-04-22T07:43:00.000Z');
    expect(iso(dateFromAttr('2024-04-22', now))).toBe('2024-04-21T16:00:00.000Z');
    expect(iso(dateFromAttr('1713771780', now))).toBe('2024-04-22T07:43:00.000Z');
    expect(iso(dateFromAttr('1713771780000', now))).toBe('2024-04-22T07:43:00.000Z');
    expect(dateFromAttr('', now)).toBeNull();
    expect(dateFromAttr('article', now)).toBeNull();
  });
});
