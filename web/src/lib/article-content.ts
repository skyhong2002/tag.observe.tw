export type ContentStatus = 'ok' | 'short' | 'missing' | 'blocked' | 'error' | 'not_fetched' | 'expired';
export interface Publisher {
  media: string;
  name: string;
  country: string;
  countryCode: string;
}
export interface DiscoverySource {
  media: string;
  title: string;
  url: string;
  discoveredAt: string;
}
export interface StoredArticle {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  publishedDate?: string;
  publishedDatePrecision?: 'day';
  tags: string[];
  description: string | null;
  authors: string[];
  publisher: Publisher;
  discoverySources?: DiscoverySource[];
  collections?: Array<{ id: string; media: string; title: string; kind: 'topic' | 'feature' }>;
}
export interface StoredContent {
  article: StoredArticle;
  content: {
    status: ContentStatus;
    body: string | null;
    chars: number;
    source: string | null;
    fetchedAt: string | null;
    expiresAt: string | null;
    attributions: Array<Publisher & { evidence: string; kind: 'explicit' }>;
  };
}
export interface MediaContent {
  media: string;
  title: string;
  sourceKind: 'discovery' | 'publisher';
  publisher: Publisher | null;
  limit: number;
  count: number;
  nextCursor: string | null;
  articles: Array<StoredArticle & { bodyStatus: ContentStatus; bodyChars: number; contentFetchedAt: string | null }>;
}
// State sentences only; content presentation and what is compared are in the
// footer's 資料來源與計算方式 (components/method/article.tsx).
export const CONTENT_STATUS: Record<ContentStatus, { label: string; detail: string }> = {
  ok: { label: '文章內文', detail: '以下是本站取得的文章內文。' },
  short: { label: '內文較短', detail: '已取得的文字較短，可能不完整。' },
  missing: { label: '未取得正文', detail: '已讀取原站頁面，但沒有取得可保存的正文；標題與摘要不會代替全文。' },
  blocked: { label: '原站限制讀取', detail: '原站的存取限制使本站無法取得正文。' },
  error: { label: '讀取失敗', detail: '取得原站正文時發生錯誤，目前沒有可閱讀的完整正文。' },
  not_fetched: { label: '尚未取得正文', detail: '這篇文章已收錄，正文尚未擷取。' },
  expired: { label: '原站閱讀', detail: '全文請至原站閱讀。' },
};
