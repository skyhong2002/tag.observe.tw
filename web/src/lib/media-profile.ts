import type { MediaKeywords } from '@/components/MediaWordCloud';
import catalog from '../../../app/data/news-source-catalog.json';
import baseline from '../../../app/data/traffic-baseline.json';
import { API_ORIGIN } from './api';
import { mediaNames } from './media-names.mts';
import { safeWebsiteUrl } from './media-traffic.mts';

export interface MediaProfile {
  media: string;
  title: string;
  icon: string | null;
  categoryLabel: string | null;
  camp: 'blue' | 'green' | 'other';
  today: number;
  last24h: number;
  last7d: number;
  collectingSince: string | null;
  lastArticle: string | null;
  lastCrawlOk: string | null;
  status: 'ok' | 'stale' | 'failing' | 'disabled';
}
export const profileStatus = { ok: '持續收錄', stale: '近期無新文章', failing: '暫時無法更新', disabled: '已停止收錄' };
export const profileCamp = { blue: '藍營傾向', green: '綠營傾向', other: '未列藍綠' };

async function get<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(6000) });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}
export async function loadMediaProfile(media: string) {
  const data = await get<{ media: MediaProfile[] }>('/api/v1/media-stats');
  return data?.media.find((item) => item.media === media) ?? null;
}
export const loadMediaKeywords = (media: string, hours: number) =>
  get<MediaKeywords>(`/api/v1/media/${encodeURIComponent(media)}/keywords?hours=${hours}`);
export function mediaReference(media: string) {
  const source = catalog.sources.find((item) => item.media === media);
  const baselineSource = baseline.sources.find((item) => item.media === media);
  const websiteUrl =
    safeWebsiteUrl(source?.websiteUrl) ??
    safeWebsiteUrl(mediaNames[media]?.sourceUrl) ??
    safeWebsiteUrl(baselineSource ? `https://${baselineSource.domain}` : null);
  return websiteUrl ? { websiteUrl, domain: new URL(websiteUrl).hostname } : undefined;
}
