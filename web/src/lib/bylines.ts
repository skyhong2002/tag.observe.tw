import type { BylineSummary, CreditEntity } from '../../../app/src/journalists/credit-entities';
import type { Attribution } from '../../../app/src/similarity/attribution';
import { API_ORIGIN } from './api';

export type { CreditEntity, CreditKind } from '../../../app/src/journalists/credit-entities';
export { CREDIT_KINDS, CREDIT_LABELS } from '../../../app/src/journalists/credit-entities';
export type { BylineSummary };
export const BYLINE_HOURS = [24, 48, 72, 168, 720] as const;
export const bylineHref = (key: string, hours = 48) => `/byline/${encodeURIComponent(key)}/${hours === 48 ? '' : `?hours=${hours}`}`;
export const bylineHours = (value?: string) => ((BYLINE_HOURS as readonly number[]).includes(Number(value)) ? Number(value) : 48);
export const periodLabel = (hours: number) => (hours < 48 ? `${hours} 小時` : `${hours / 24} 天`);
export interface BylineIndex {
  generatedAt: string;
  hours: number;
  page: number;
  pageSize: number;
  total: number;
  credited: number;
  counts: Record<string, number>;
  outlets: Array<{ media: string; name: string }>;
  bylines: BylineSummary[];
}
export interface BylineDetail {
  generatedAt: string;
  hours: number;
  page: number;
  pageSize: number;
  total: number;
  byline: BylineSummary;
  articles: Array<{
    id: number;
    media: string;
    mediaTitle: string;
    title: string;
    url: string;
    image: string | null;
    publishedAt: string;
    tags: string[];
    credits: string[];
    entities: CreditEntity[];
    attributions: Attribution[];
  }>;
}
export async function fetchBylines<T = BylineIndex>(
  path: string,
  params: Record<string, string | undefined>,
): Promise<T | 'missing' | null> {
  const query = new URLSearchParams(Object.entries(params).filter((item): item is [string, string] => item[1] !== undefined));
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/bylines${path}?${query}`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(30000),
    });
    if (response.status === 404) return 'missing';
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}
