import { API_ORIGIN } from './api';

// How articles were written (app/src/v1/writing.ts): social-post retelling,
// who posted, and headline wording. Labels describe the text; none rates it.

export const ROLES = ['公職政治', '前任公職', '評論名嘴', '專家企業', '醫療健康', '氣象', '藝人網紅', '機構', '網友民眾', '未知'] as const;
export type Role = (typeof ROLES)[number];
export const TITLE_TAGS = ['懸念', '反應', '攻擊'] as const;
export type TitleTag = (typeof TITLE_TAGS)[number];

export const ROLE_LABEL: Record<Role, string> = {
  公職政治: '公職、政治人物',
  前任公職: '前任公職',
  評論名嘴: '評論、名嘴',
  專家企業: '專家、企業人士',
  醫療健康: '醫療健康',
  氣象: '氣象',
  藝人網紅: '藝人、網紅',
  機構: '公司、團體',
  網友民眾: '網友、民眾',
  未知: '身分未標明',
};
export const PLATFORM_LABEL: Record<string, string> = {
  Facebook: '臉書',
  Threads: 'Threads',
  Instagram: 'Instagram',
  X: 'X',
  YouTube: 'YouTube',
  節目直播: '節目或直播',
  PTT: 'PTT',
  Dcard: 'Dcard',
  社群: '社群平台',
};
export const TITLE_TAG_LABEL: Record<TitleTag, { label: string; hint: string }> = {
  懸念: { label: '懸念', hint: '標題不說重點，例如「先做1事」「原因曝」「回應了」' },
  反應: { label: '反應', hint: '標題強調情緒反應，例如「反應驚人」「傻眼」「一面倒」' },
  攻擊: { label: '攻擊', hint: '標題用攻擊性動詞，例如「怒轟」「狠酸」「開嗆」' },
};

export interface WritingCounts {
  articles: number;
  social: number;
  roles: Record<string, number>;
  platforms: Record<string, number>;
  titleTags: Record<string, number>;
}
export interface WritingOverview {
  generatedAt: string;
  version: string;
  days: number;
  from: string;
  totals: WritingCounts;
  daily: Array<WritingCounts & { day: string }>;
  media: Array<WritingCounts & { media: string; name: string }>;
  posters: Array<{ name: string; role: Role; articles: number; outlets: number }>;
}
export interface MediaWriting {
  media: string;
  name: string;
  version: string;
  days: number;
  from: string;
  excludedFromStatistics: boolean;
  totals: WritingCounts;
  daily: Array<{ day: string; articles: number; social: number }>;
}
export interface WritingArticle {
  id: number;
  media: string;
  name: string;
  title: string;
  url: string;
  publishedAt: string;
  platform: string | null;
  poster: string | null;
  role: Role | null;
  evidence: string | null;
  titleTags: TitleTag[];
}
export interface ArticleWriting {
  articleId: number;
  version: string;
  analyzedAt: string;
  social: {
    platform: string;
    poster: string | null;
    role: Role | null;
    roleSource: 'clause' | 'people' | null;
    evidence: string | null;
  } | null;
  titleTags: TitleTag[];
}

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(API_ORIGIN + path, {
      next: { revalidate },
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const fetchWritingOverview = (days: number) => getJson<WritingOverview>(`/api/v1/writing?days=${days}`, 300);
export const fetchMediaWriting = (media: string, days = 90) =>
  getJson<MediaWriting>(`/api/v1/media/${encodeURIComponent(media)}/writing?days=${days}`, 300);
export const fetchArticleWriting = (id: number) => getJson<ArticleWriting>(`/api/v1/articles/${id}/writing`, 300);
export function fetchWritingArticles(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v));
  return getJson<{ articles: WritingArticle[]; next: number | null }>(`/api/v1/writing/articles?${params}`, 120);
}

export const share = (part: number, whole: number) => (whole ? `${((100 * part) / whole).toFixed(1)}%` : '–');

/** 「沈政男（醫療健康）的臉書貼文」 */
export function postPhrase(s: NonNullable<ArticleWriting['social']>) {
  const platform = PLATFORM_LABEL[s.platform] ?? s.platform;
  const who = s.poster
    ? `${s.poster}${s.role && s.role !== '未知' ? `（${ROLE_LABEL[s.role]}）` : ''}`
    : s.role && s.role !== '未知'
      ? ROLE_LABEL[s.role]
      : '';
  return { who, platform };
}
