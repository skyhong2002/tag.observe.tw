import { API_ORIGIN } from './api';

// /api/v1/site-observation (app/src/v1/site-observation.ts).
export const OBSERVATION_DAYS = [7, 28, 90] as const;
export type ObservationDays = (typeof OBSERVATION_DAYS)[number];

export interface ObservedPage {
  path: string;
  kind: 'event' | 'tag' | 'topic' | 'feature' | 'article' | 'journalist' | 'media' | 'page';
  title: string;
  views: number;
}
export interface Observation {
  updatedAt: string | null;
  days: number;
  start: string;
  end: string;
  trackingSince: string | null;
  traffic: {
    daily: Array<{ date: string; views: number; sessions: number; users: number }>;
    views: number;
    sessions: number;
    channels: Array<{ name: string; value: number }>;
    devices: Array<{ name: string; value: number }>;
    events: Array<{ name: string; value: number }>;
  } | null;
  pages: ObservedPage[];
  content: ObservedPage[];
  search: {
    daily: Array<{ date: string; clicks: number; impressions: number; position: number }>;
    clicks: number;
    impressions: number;
    position: number | null;
    pages: Array<Omit<ObservedPage, 'views'> & { clicks: number; impressions: number }>;
  } | null;
  vitals: Array<{ name: 'LCP' | 'INP' | 'CLS'; good: number; needsImprovement: number; poor: number }> | null;
}

export async function fetchObservation(days: ObservationDays): Promise<Observation | null> {
  const response = await fetch(`${API_ORIGIN}/api/v1/site-observation?days=${days}`, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  return response?.ok ? response.json() : null;
}

/** Stored paths are decoded; links need the encoded form. */
export const pageHref = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export const KIND_LABELS: Record<ObservedPage['kind'], string> = {
  event: '事件',
  tag: '標籤',
  topic: '議題',
  feature: '專題',
  article: '文章',
  journalist: '記者',
  media: '媒體',
  page: '頁面',
};
