import { describe, expect, it } from 'vitest';
import { statusFor, taipeiMidnight } from './media-stats.ts';

const now = Date.parse('2026-09-29T07:00:00Z'); // 15:00 Taipei
const h = (x: number) => new Date(now - x * 3600e3);
describe('media stats', () => {
  it('computes the start of the Taipei day', () => {
    expect(taipeiMidnight(now).toISOString()).toBe('2026-09-28T16:00:00.000Z');
    expect(taipeiMidnight(Date.parse('2026-09-28T16:30:00Z')).toISOString()).toBe('2026-09-28T16:00:00.000Z');
    expect(taipeiMidnight(Date.parse('2026-09-28T15:59:00Z')).toISOString()).toBe('2026-09-27T16:00:00.000Z');
  });
  it('classifies crawl health', () => {
    const base = { disabled: false, group: 'news', lastArticle: h(1), runs3h: 20, failed3h: 0 };
    expect(statusFor(base, now)).toBe('ok');
    expect(statusFor({ ...base, lastArticle: h(7) }, now)).toBe('stale');
    expect(statusFor({ ...base, group: 'hourly', lastArticle: h(7) }, now)).toBe('ok');
    expect(statusFor({ ...base, failed3h: 20 }, now)).toBe('failing');
    expect(statusFor({ ...base, lastArticle: null }, now)).toBe('stale');
    expect(statusFor({ ...base, disabled: true }, now)).toBe('disabled');
  });
});
