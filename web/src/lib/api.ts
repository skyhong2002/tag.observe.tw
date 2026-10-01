export const API_ORIGIN = process.env.TAG_API_ORIGIN ?? 'http://127.0.0.1:18130';

export interface Category {
  key: string;
  label: string;
  media: number;
}
export interface RankingEntry {
  rank: number;
  position: number;
  tag: string;
  score: number;
  count: number;
  media: Record<string, number>;
  normalized: number;
  burst: number;
  history: Record<string, number | null>;
}
export interface Ranking {
  snapshot: {
    id: number;
    category: string;
    hourStart: string;
    computedAt: string;
    weight: number;
    articleCount: number;
    mediaCount: number;
    historyAvailable: number[];
  };
  order: 'burst' | 'score';
  entries: RankingEntry[];
}
export interface Article {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  tags: string[];
}
export interface SeriesPoint {
  t: string;
  score: number;
  count: number;
  rank: number | null;
}
export type MediaInfo = Record<string, { title: string | null; icon: string | null }>;

async function get<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(API_ORIGIN + path, { next: { revalidate }, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}
export const fetchCategories = () => get<Category[]>('/api/v1/categories', 3600);
export const fetchMedia = () => get<MediaInfo>('/api/v1/media', 3600);
export const fetchRanking = (category: string, order: 'burst' | 'score', limit = 50) =>
  get<Ranking>(`/api/v1/ranking?category=${encodeURIComponent(category)}&order=${order}&limit=${limit}`);
export const fetchTagArticles = (tag: string, hours = 48) =>
  get<{ tag: string; articles: Article[] }>(`/api/v1/tags/${encodeURIComponent(tag)}/articles?hours=${hours}&limit=80`);
export const fetchTagSeries = (tag: string, category = 'all', hours = 72) =>
  get<{ points: SeriesPoint[] }>(
    `/api/v1/tags/${encodeURIComponent(tag)}/series?category=${encodeURIComponent(category)}&hours=${hours}`,
    300,
  );

export const taipei = (iso: string) =>
  new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour12: false,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
// Without minutes, zh-TW renders the hour as "18時"; format with minutes instead.
export const taipeiHour = (iso: string) => taipei(iso).replace(/:\d\d$/, ':00');
