import { afterEach, describe, expect, it, vi } from 'vitest';
import { crawlTimestamp, groupPeriodMs, nextIndexEligibleAt, sourceDispatchGroup, sourceSchedule } from './schedule.ts';

afterEach(() => vi.unstubAllEnvs());
describe('per-media crawl schedule', () => {
  it('routes explicitly accelerated sources through the fast dispatcher and respects disabled registrations', () => {
    vi.stubEnv('CRAWL_NEWS_MINUTES', '9');
    vi.stubEnv('CRAWL_HOURLY_MINUTES', '60');
    expect(sourceDispatchGroup('news_pchome', 'hourly')).toBe('news');
    expect(sourceSchedule('news_pchome', 'hourly')).toMatchObject({ minutes: 9, dueAfterMinutes: 7.2 });
    expect(sourceSchedule('ntdtv_tw', 'hourly')).toMatchObject({ minutes: 30, dueAfterMinutes: 30 });
    expect(sourceDispatchGroup('news_pchome', 'off')).toBe('off');
    expect(sourceDispatchGroup('unknown-media', 'hourly')).toBe('hourly');
  });
  it('shares configured intervals and never accelerates an explicitly slower group', () => {
    vi.stubEnv('CRAWL_NEWS_MINUTES', '9');
    expect(sourceSchedule('pts', 'news')).toMatchObject({ minutes: 30, dueAfterMinutes: 30 });
    expect(sourceSchedule('unknown-media', 'news')).toMatchObject({ minutes: 9, dueAfterMinutes: 7.2 });
    vi.stubEnv('CRAWL_NEWS_MINUTES', '90');
    expect(sourceSchedule('pts', 'news').minutes).toBe(90);
    expect(sourceSchedule('unknown-media', 'news').minutes).toBe(90);
  });
  it('uses safe group defaults when the environment is invalid', () => {
    vi.stubEnv('CRAWL_NEWS_MINUTES', 'NaN');
    vi.stubEnv('CRAWL_HOURLY_MINUTES', '-1');
    expect(groupPeriodMs('news')).toBe(9 * 60e3);
    expect(groupPeriodMs('hourly')).toBe(60 * 60e3);
  });
  it('interprets SQL timestamps as UTC and exposes the exact eligibility boundary', () => {
    const last = crawlTimestamp('2026-10-08 14:00:00');
    expect(last?.toISOString()).toBe('2026-10-08T14:00:00.000Z');
    expect(crawlTimestamp('2026-10-08T14:00:00Z')).toEqual(last);
    expect(crawlTimestamp('invalid')).toBeNull();
    expect(nextIndexEligibleAt(last, 30)?.toISOString()).toBe('2026-10-08T14:30:00.000Z');
    expect(nextIndexEligibleAt(null, 30)).toBeNull();
  });
});
