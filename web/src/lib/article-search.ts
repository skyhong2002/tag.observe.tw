import { API_ORIGIN } from '@/lib/api';

// The article list behind 搜尋新聞 (/search/) and 文章 (/article/): one page of
// /api/v1/articles with its camp and outlet facets.

export type Camp = 'green' | 'other' | 'blue';
export const CAMPS: Array<{ key: Camp; label: string; bar: string; badge: string | null }> = [
  {
    key: 'green',
    label: '綠營傾向',
    bar: 'bg-emerald-700 text-white',
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800',
  },
  { key: 'other', label: '其他', bar: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-400 dark:text-zinc-950', badge: null },
  {
    key: 'blue',
    label: '藍營傾向',
    bar: 'bg-blue-700 text-white',
    badge: 'bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800',
  },
];
export const RANGES = [
  { days: 1, label: '1 天' },
  { days: 7, label: '7 天' },
  { days: 31, label: '31 天' },
];
export const PAGE = 30;

export interface Hit {
  id: number;
  media: string;
  mediaTitle: string;
  camp: Camp;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  datePending: boolean;
  tags: string[];
}
export interface Facets {
  total: number;
  camps: Record<Camp, number>;
  media: Array<{ media: string; count: number }>;
}
export interface SearchResult {
  count: number;
  nextCursor: string | null;
  facets?: Facets;
  articles: Hit[];
}

export const isCamp = (value: string | undefined): value is Camp => CAMPS.some((c) => c.key === value);
export const rangeDays = (value: string | undefined, fallback: number) =>
  RANGES.some((r) => String(r.days) === value) ? Number(value) : fallback;
export const validCursor = (value: string | undefined) => (value && /^\d+_\d+$/.test(value) ? value : null);

export async function searchArticles(params: Record<string, string>): Promise<SearchResult | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/articles?${new URLSearchParams(params)}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? ((await res.json()) as SearchResult) : null;
  } catch {
    return null;
  }
}

/**
 * One listing page plus the facets of the whole match. While one camp is
 * filtered the facets still describe every camp, so they come from a
 * separate one-row request.
 */
export async function fetchArticleListing({
  q,
  days,
  camp,
  cursor,
}: {
  q?: string;
  days: number;
  camp: Camp | null;
  cursor: string | null;
}): Promise<{ page: SearchResult | null; facets: Facets | undefined }> {
  const base = { ...(q ? { q } : {}), hours: String(days * 24) };
  const [page, overall] = await Promise.all([
    searchArticles({
      ...base,
      limit: String(PAGE),
      ...(camp ? { camp } : {}),
      ...(cursor ? { cursor } : {}),
      ...(camp ? {} : { facets: '1' }),
    }),
    camp ? searchArticles({ ...base, limit: '1', facets: '1' }) : Promise.resolve(null),
  ]);
  return { page, facets: (camp ? overall : page)?.facets };
}
