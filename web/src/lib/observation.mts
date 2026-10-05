// Shared, dependency-free projection: only this public aggregate contract leaves the server.
export interface ObservationPeriod {
  start: string;
  end: string;
}
export interface Observation {
  version: 1;
  updatedAt: string;
  content: {
    period: ObservationPeriod;
    totals: { views: number; sessions: number } | null;
    ranking: Array<{ path: string; title: string; views: number }>;
  };
  search: {
    period: ObservationPeriod;
    totals: { clicks: number; impressions: number } | null;
    daily: Array<{ date: string; clicks: number; impressions: number }>;
  };
  experience: {
    status: 'definitions_missing' | 'insufficient' | 'ready';
    metrics: Array<{ name: 'LCP' | 'INP' | 'CLS'; samples: number; goodPercent: number }>;
  };
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid observation');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.length || value.length > max || /[\x00-\x1f]/.test(value)) throw Error('Invalid text');
  return value;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error('Invalid number');
  return value;
}
function count(value: unknown): number {
  const n = number(value);
  if (!Number.isSafeInteger(n)) throw Error('Invalid count');
  return n;
}
function date(value: unknown): string {
  const s = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s)
    throw Error('Invalid date');
  return s;
}
function period(value: unknown): ObservationPeriod {
  const v = record(value);
  const result = { start: date(v.start), end: date(v.end) };
  if (result.start > result.end) throw Error('Invalid period');
  return result;
}
function rows(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw Error('Invalid rows');
  return value;
}
export function observationPath(value: unknown): string {
  const s = text(value, 1500);
  if (/^\/eve\/[1-9]\d*\/$/.test(s)) return s;
  if (!s.startsWith('/tag/') || !s.endsWith('/')) throw Error('Invalid path');
  const tag = decodeURIComponent(s.slice(5, -1));
  if (!tag || tag.length > 100 || /[/\\?#\x00-\x20]/.test(tag) || tag === '.' || tag === '..') throw Error('Invalid tag');
  return `/tag/${encodeURIComponent(tag)}/`;
}
export function publicObservation(input: unknown): Observation {
  const v = record(input);
  if (v.version !== 1) throw Error('Invalid version');
  const updatedAt = text(v.updatedAt, 40);
  if (!Number.isFinite(Date.parse(updatedAt))) throw Error('Invalid timestamp');
  const c = record(v.content),
    s = record(v.search),
    e = record(v.experience);
  const contentTotals = c.totals === null ? null : record(c.totals);
  const searchTotals = s.totals === null ? null : record(s.totals);
  const status = e.status;
  if (status !== 'definitions_missing' && status !== 'insufficient' && status !== 'ready') throw Error('Invalid experience status');
  return {
    version: 1,
    updatedAt,
    content: {
      period: period(c.period),
      totals: contentTotals ? { views: count(contentTotals.views), sessions: count(contentTotals.sessions) } : null,
      ranking: rows(c.ranking, 20).map((r) => {
        const row = record(r);
        const views = count(row.views);
        if (views < 10) throw Error('Insufficient views');
        return { path: observationPath(row.path), title: text(row.title, 180), views };
      }),
    },
    search: {
      period: period(s.period),
      totals: searchTotals ? { clicks: count(searchTotals.clicks), impressions: count(searchTotals.impressions) } : null,
      daily: rows(s.daily, 28).map((r) => {
        const row = record(r);
        return { date: date(row.date), clicks: count(row.clicks), impressions: count(row.impressions) };
      }),
    },
    experience: {
      status,
      metrics: rows(e.metrics, 3).map((r) => {
        const row = record(r);
        const name = row.name;
        if (name !== 'LCP' && name !== 'INP' && name !== 'CLS') throw Error('Invalid metric');
        const samples = count(row.samples),
          goodPercent = number(row.goodPercent);
        if (samples < 30 || goodPercent > 100) throw Error('Invalid metric sample');
        return { name, samples, goodPercent };
      }),
    },
  };
}
