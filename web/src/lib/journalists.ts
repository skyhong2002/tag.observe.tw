import type { Attribution } from '../../../app/src/similarity/attribution';
import type { SimilarityIndexStats } from '../../../app/src/similarity/types';
import { API_ORIGIN } from './api';
import type { ContentStatus } from './article-content';

export type { JournalistOutlet, JournalistPair, JournalistSimilarity, JournalistSummary } from '../../../app/src/journalists/aggregate';

import type { JournalistOutlet, JournalistPair, JournalistSimilarity, JournalistSummary } from '../../../app/src/journalists/aggregate';

export interface JournalistIndex {
  generatedAt: string;
  hours: number;
  threshold: number;
  method: string;
  /** Similarity index coverage of the period. */
  index: Pick<SimilarityIndexStats, 'analyzed' | 'pairs' | 'windowDays'> & { from: string };
  totals: { journalists: number; articles: number; credited: number };
  limit: number;
  journalists: JournalistSummary[];
}
export interface JournalistArticle {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  tags: string[];
  bodyStatus: ContentStatus;
  bodyChars: number;
  byline: string[];
  coauthors: string[];
  attributions: Attribution[];
  matches: number;
  compared: boolean;
}
export interface JournalistDetail {
  name: string;
  generatedAt: string;
  hours: number;
  threshold: number;
  method: string;
  stats: {
    articles: number;
    withBody: number;
    averageChars: number | null;
    cited: number;
    tags: Array<{ tag: string; count: number }>;
    similar: JournalistSimilarity;
  };
  media: JournalistOutlet[];
  articles: JournalistArticle[];
  pairs: JournalistPair[];
  index: {
    /** Own stories the index compared with every other outlet. */
    compared: number;
    /** Own stories with a usable body still waiting for the index. */
    pending: number;
    windowDays: number;
  };
}

export const INDEX_HOURS = [24, 48, 72, 168] as const;
export const DETAIL_HOURS = [24, 72, 168, 720] as const;
export const journalistHref = (name: string) => `/journalist/${encodeURIComponent(name)}/`;

export async function fetchJournalists(hours: number, threshold = 0.65, limit = 3000): Promise<JournalistIndex | null> {
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/journalists?hours=${hours}&threshold=${threshold}&limit=${limit}`, {
      next: { revalidate: 120 },
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    return response.ok ? ((await response.json()) as JournalistIndex) : null;
  } catch {
    return null;
  }
}
/** `missing` distinguishes "nobody by that name" from a failed request. */
export async function fetchJournalist(name: string, hours: number, threshold = 0.65): Promise<JournalistDetail | 'missing' | null> {
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/journalists/${encodeURIComponent(name)}?hours=${hours}&threshold=${threshold}`, {
      next: { revalidate: 300 },
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404 || response.status === 400) return 'missing';
    return response.ok ? ((await response.json()) as JournalistDetail) : null;
  } catch {
    return null;
  }
}
/** "晚 3 小時 20 分" style gap for a pair, from the signed minute difference. */
export function describeGap(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 1) return '一分鐘內';
  if (abs < 60) return `${abs} 分鐘`;
  if (abs < 48 * 60) return `${Math.floor(abs / 60)} 小時${abs % 60 ? ` ${abs % 60} 分` : ''}`;
  return `${Math.floor(abs / 1440)} 天`;
}
export function relationLabel(
  pair: Pick<JournalistPair, 'relation' | 'minutes' | 'sameAuthor' | 'publicationUnknown' | 'attributed'>,
): string {
  if (pair.sameAuthor) return '同署名跨站刊登';
  if (pair.attributed) return '已註明來源';
  if (pair.publicationUnknown) return '刊登時間未確認';
  if (pair.relation === 'same') return '一分鐘內同時刊登';
  return pair.relation === 'later' ? `對方早 ${describeGap(pair.minutes)} 刊登` : `本篇早 ${describeGap(pair.minutes)} 刊登`;
}

export const REPOSITORY_URL = 'https://github.com/skyhong2002/tag.observe.tw';
/** Why similarity on these pages is not a plagiarism finding; shown wherever pairs are listed. */
export const SIMILARITY_CAVEAT =
  '相似不等於抄襲：同一份新聞稿、通訊社稿、授權轉載與註明引用都會讓內文相近；刊登時間以各站標示為準，與寫稿先後無關。同名不同人不會分開。';
/** A pre-filled GitHub issue asking to take this person's page down. */
export function removalRequestHref(name: string): string {
  const params = new URLSearchParams({
    title: `記者頁移除請求：${name}`,
    body: `請將「${name}」自記者頁移除。\n\n頁面：https://tag.observe.tw${journalistHref(name)}\n\n這則 issue 是公開的，任何人都看得到。除了上面的名字，請不要填寫其他個人資料；不需要證明身分，送出後約 15 分鐘內頁面就會下架。`,
  });
  return `${REPOSITORY_URL}/issues/new?${params}`;
}
