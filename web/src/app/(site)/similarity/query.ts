import { MAX_RANGE_DAYS, PERIOD_HOURS, type SimilarityPeriod } from '@/lib/similarity';

export type SimilarityQuery = Record<string, string | undefined>;

const isDay = (value: string | undefined): value is string => {
  const time = Date.parse(`${value}T00:00:00Z`);
  return (
    !!value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '2000-01-01' &&
    Number.isFinite(time) &&
    new Date(time).toISOString().startsWith(value)
  );
};

/** Taipei dates `from`–`to` (inclusive, at most 31 days), else one of the rolling windows; 48 hours by default. */
export function similarityPeriod(query: SimilarityQuery): SimilarityPeriod {
  const { from, to } = query;
  if (isDay(from) && isDay(to) && from <= to && (Date.parse(to) - Date.parse(from)) / 86400e3 < MAX_RANGE_DAYS) return { from, to };
  const hours = Number(query.hours);
  return { hours: (PERIOD_HOURS as readonly number[]).includes(hours) ? hours : 48 };
}

export function similarityThreshold(query: SimilarityQuery): number {
  const requested = Number(query.threshold ?? 0.65);
  return Number.isFinite(requested) ? Math.min(1, Math.max(0.5, requested)) : 0.65;
}
