import type { JournalistSummary } from '../../../app/src/journalists/aggregate.ts';

export type Metric = 'compared' | 'unmatched' | 'matched' | 'later' | 'earlier' | 'sameAuthor' | 'attributed' | 'cited';
export type SortKey = 'name' | 'media' | 'articles' | Metric;
export const metrics: Array<{ key: Metric; label: string }> = [
  { key: 'compared', label: '已比對' },
  { key: 'unmatched', label: '未見相近' },
  { key: 'matched', label: '內文相近' },
  { key: 'later', label: '對方較早' },
  { key: 'earlier', label: '本篇較早' },
  { key: 'sameAuthor', label: '同署名' },
  { key: 'attributed', label: '已註明來源' },
  { key: 'cited', label: '引用' },
];
export function metricCount(row: JournalistSummary, key: Metric): number | null {
  if (key === 'compared' || key === 'cited') return row[key];
  if (key === 'unmatched') return row.unmatched ?? null;
  if (key === 'matched') return row.similar.articles;
  return row.similar[key] ?? 0;
}
export function metricShare(row: JournalistSummary, key: Metric): number | null {
  const count = metricCount(row, key);
  return row.articles > 0 && count !== null ? count / row.articles : null;
}
export function sortValue(row: JournalistSummary, key: SortKey, mode: 'count' | 'share'): number {
  if (key === 'name') return 0;
  if (key === 'media') return row.media.length;
  if (key === 'articles') return row.articles;
  return (mode === 'share' ? metricShare(row, key) : metricCount(row, key)) ?? -1;
}
export interface TableFilters {
  query: string;
  media: string;
  relation: Metric | '';
  minArticles: number;
  minCoverage: number;
  metric: Metric;
  minShare: string;
  maxShare: string;
}
export function matchesFilters(row: JournalistSummary, filters: TableFilters): boolean {
  if (!row.name.toLowerCase().includes(filters.query.trim().toLowerCase())) return false;
  if (filters.media && !row.media.some((outlet) => outlet.media === filters.media)) return false;
  if (filters.relation && !(Number(metricCount(row, filters.relation)) > 0)) return false;
  if (row.articles < filters.minArticles) return false;
  if (filters.minCoverage > 0 && (metricShare(row, 'compared') ?? -1) * 100 < filters.minCoverage) return false;
  const share = metricShare(row, filters.metric);
  if (filters.minShare !== '' && (share === null || share * 100 < Number(filters.minShare))) return false;
  if (filters.maxShare !== '' && (share === null || share * 100 > Number(filters.maxShare))) return false;
  return true;
}
