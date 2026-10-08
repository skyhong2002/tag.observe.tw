import intervals from '../../data/crawl-intervals.json' with { type: 'json' };

export const groupPeriodMs = (group: 'news' | 'hourly') => {
  const minutes = Number(process.env[group === 'news' ? 'CRAWL_NEWS_MINUTES' : 'CRAWL_HOURLY_MINUTES'] || (group === 'news' ? 9 : 60));
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : group === 'news' ? 9 : 60) * 60e3;
};
const settings = intervals.media as Record<string, { minutes: number; reason: string; accelerate?: boolean; reviewedAt?: string }>;
export function sourceDispatchGroup(media: string, group: 'news' | 'hourly' | 'off'): 'news' | 'hourly' | 'off' {
  const configured = settings[media];
  return group !== 'off' &&
    configured?.accelerate &&
    Number.isFinite(configured.minutes) &&
    configured.minutes > 0 &&
    configured.minutes < groupPeriodMs('hourly') / 60e3
    ? 'news'
    : group;
}
export function sourceSchedule(media: string, group: 'news' | 'hourly') {
  const configured = settings[media];
  const baseMinutes = groupPeriodMs(configured?.accelerate ? 'news' : group) / 60e3;
  const minutes =
    configured && Number.isFinite(configured.minutes) && configured.minutes > 0 ? Math.max(baseMinutes, configured.minutes) : baseMinutes;
  return {
    minutes,
    dueAfterMinutes: configured && minutes > baseMinutes ? minutes : minutes * 0.8,
    reason: configured?.reason ?? '維持原排程；近期資料不足或更新頻繁',
    reviewedAt: configured?.reviewedAt ?? intervals.observedAt,
  };
}

/** Earliest eligibility, not a promise of dispatch while the queue is busy. */
export const nextIndexEligibleAt = (last: Date | null, minutes: number) => (last ? new Date(last.getTime() + minutes * 60e3) : null);

export function crawlTimestamp(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' || !value) return null;
  const normalized = value.replace(' ', 'T');
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}
