// Versioned, shareable exact-tag scope. Kept separate from media-owned /topic/ pages.
export interface ObservationScope {
  version: 1;
  anchor: string;
  any: string[];
}
export interface ObservationBucket {
  day: string;
  articles: number | null;
  media: number | null;
}
export interface ObservationEvent {
  id: number;
  firstAt: string;
  lastAt: string;
  matchedHours: number;
  tags: string[];
  headline: { id: number | null; title: string; media: string } | null;
}
export interface Observation {
  scope: ObservationScope & { id: string };
  window: { from: string; to: string; at: string; end: string };
  generatedAt: string;
  totals: { articles: number; media: number; events: number };
  days: ObservationBucket[];
  outlets: Array<{ media: string; title: string; articles: number; days: Record<string, number> }>;
  events: ObservationEvent[];
  recent: Array<{ id: number; title: string; media: string; publishedAt: string; tags: string[] }>;
  eventHistoryFrom: string | null;
}
export const OBSERVATION_VERSION = 1;
export const MAX_OBSERVATION_DAYS = 366;
export function observationScope(anchor: unknown, alternatives: unknown): ObservationScope {
  if (typeof anchor !== 'string' || (alternatives !== undefined && typeof alternatives !== 'string')) throw Error('標籤格式錯誤');
  const tag = anchor.trim();
  const any = [
    ...new Set(
      String(alternatives ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ]
    .filter((t) => t !== tag)
    .sort();
  if (!tag || [...tag].length > 60 || /[\u0000-\u001f,]/u.test(tag)) throw Error('主標籤須為 1–60 字，不能含逗號或控制字元');
  if (any.length > 5 || any.some((t) => [...t].length > 60 || /[\u0000-\u001f]/u.test(t))) throw Error('搭配標籤最多 5 個，每個最多 60 字');
  return { version: 1, anchor: tag, any };
}
export function matchesObservation(tags: readonly string[], scope: ObservationScope) {
  return tags.includes(scope.anchor) && (!scope.any.length || scope.any.some((tag) => tags.includes(tag)));
}
export function observationQuery(scope: ObservationScope) {
  const q = new URLSearchParams({ v: '1', anchor: scope.anchor });
  if (scope.any.length) q.set('with', [...scope.any].sort().join(','));
  return q;
}
export function observationHref(scope: ObservationScope) {
  return `/tracking/?${observationQuery(scope)}`;
}
