import Link from 'next/link';
import { ArticleList } from '@/components/ArticleResults';
import ArticleTabs from '@/components/ArticleTabs';
import FormSuggestInput from '@/components/FormSuggestInput';
import { FormOutletPicker } from '@/components/OutletPicker';
import { fetchMedia } from '@/lib/api';
import { rangeDays, searchArticles, validCursor } from '@/lib/article-search';
import { fetchSimilarity } from '@/lib/similarity';
import { sourceRanking } from '@/lib/source-ranking.mts';

export const metadata = { title: '進階文章查詢', robots: { index: false, follow: true } };
export const revalidate = 60;
type Query = {
  q?: string;
  credit?: string;
  media?: string;
  source?: string;
  tag?: string;
  section?: string;
  days?: string;
  from?: string;
  to?: string;
  cursor?: string;
};
const input =
  'mt-1 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100';
const validDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
export default async function ArticleQueryPage({ searchParams }: { searchParams: Promise<Query> }) {
  const sp = await searchParams,
    days = rangeDays(sp.days, 7),
    cursor = validCursor(sp.cursor);
  const filters: Record<string, string> = { hours: String(days * 24) };
  for (const key of ['q', 'credit', 'media', 'source', 'tag', 'section'] as const) if (sp[key]?.trim()) filters[key] = sp[key].trim();
  let error = '';
  if (sp.from || sp.to) {
    if (!sp.from || !sp.to || !validDay(sp.from) || !validDay(sp.to) || sp.from > sp.to) error = '請選擇有效的開始與結束日期。';
    else {
      const since = Date.parse(`${sp.from}T00:00:00+08:00`),
        until = Date.parse(`${sp.to}T00:00:00+08:00`) + 86400000;
      if (until - since > 31 * 86400000) error = '日期範圍最多 31 天。';
      else {
        filters.since = new Date(since).toISOString();
        filters.until = new Date(until).toISOString();
      }
    }
  }
  const [media, similarity, result] = await Promise.all([
    fetchMedia().catch(() => ({})),
    fetchSimilarity({ hours: 168 }, 0.65).catch(() => null),
    error ? null : searchArticles({ ...filters, limit: '30', facets: '1', ...(cursor ? { cursor } : {}) }),
  ]);
  const sources = similarity ? sourceRanking(similarity) : [];
  const href = (nextCursor?: string) =>
    `/article/query/?${new URLSearchParams(Object.entries({ ...sp, cursor: nextCursor }).filter((entry): entry is [string, string] => !!entry[1]))}`;
  return (
    <div className="space-y-5 pb-8">
      <ArticleTabs current="query" />

      <form
        action="/article/query/"
        className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-3"
      >
        <label htmlFor="query-q" className="text-xs text-zinc-500 dark:text-zinc-400">
          標題、摘要或標籤
          <FormSuggestInput
            id="query-q"
            source={{ kind: 'tags' }}
            submitOnPick={false}
            name="q"
            defaultValue={sp.q}
            maxLength={60}
            placeholder="搜尋字詞"
            className={input}
          />
        </label>
        <label htmlFor="query-credit" className="text-xs text-zinc-500 dark:text-zinc-400">
          原文署名包含
          <FormSuggestInput
            id="query-credit"
            source={{ kind: 'credits', hours: Math.min(days * 24, 720) }}
            submitOnPick={false}
            name="credit"
            defaultValue={sp.credit}
            maxLength={120}
            placeholder="姓名、筆名或編輯部"
            className={input}
          />
        </label>
        <label htmlFor="query-media" className="text-xs text-zinc-500 dark:text-zinc-400">
          刊登媒體
          <FormOutletPicker
            id="query-media"
            name="media"
            defaultValue={sp.media ?? ''}
            outlets={Object.entries(media)
              .map(([key, value]) => ({ media: key, name: value.title ?? key }))
              .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))}
            className={input}
          />
        </label>
        <label htmlFor="query-source" className="text-xs text-zinc-500 dark:text-zinc-400">
          明示來源／引用
          <FormSuggestInput
            id="query-source"
            source={{ kind: 'list', items: sources.map((source) => ({ value: source.id, label: source.name, hint: source.id })) }}
            submitOnPick={false}
            showOnEmpty
            name="source"
            defaultValue={sp.source}
            placeholder="選擇或輸入來源代碼，如 cna"
            className={input}
          />
        </label>
        <label htmlFor="query-tag" className="text-xs text-zinc-500 dark:text-zinc-400">
          完整標籤
          <FormSuggestInput
            id="query-tag"
            source={{ kind: 'tags' }}
            submitOnPick={false}
            name="tag"
            defaultValue={sp.tag}
            maxLength={60}
            placeholder="例如：台積電"
            className={input}
          />
        </label>
        <label className="text-xs text-zinc-500 dark:text-zinc-400">
          原站分類（完整名稱）
          <input name="section" defaultValue={sp.section} maxLength={64} placeholder="例如：政治" className={input} />
        </label>
        <label className="text-xs text-zinc-500 dark:text-zinc-400">
          最近期間
          <select name="days" defaultValue={String(days)} className={input}>
            {[1, 3, 7, 31].map((value) => (
              <option key={value} value={value}>
                最近 {value} 天
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-500 dark:text-zinc-400">
          開始日期（台北時間）
          <input type="date" name="from" defaultValue={sp.from} className={input} />
        </label>
        <label className="text-xs text-zinc-500 dark:text-zinc-400">
          結束日期（含當日）
          <input type="date" name="to" defaultValue={sp.to} className={input} />
        </label>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="min-h-10 shrink-0 whitespace-nowrap rounded-lg bg-brand-700 px-5 text-sm font-medium text-white">
            查詢文章
          </button>
          <Link href="/article/query/" className="shrink-0 whitespace-nowrap text-sm text-brand-700 hover:underline dark:text-brand-400">
            清除條件
          </Link>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">指定日期時取代最近期間，最多 31 天。</span>
        </div>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : !result ? (
        <p role="status" className="py-8 text-zinc-500 dark:text-zinc-400">
          暫時無法取得查詢結果，請確認來源代碼、媒體與日期範圍後再試。
        </p>
      ) : (
        <>
          <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
            符合 {result.facets?.total.toLocaleString('zh-TW') ?? '—'} 篇文章 · 依刊登時間排序
          </p>
          <ArticleList page={result} empty="沒有符合這組條件的文章。" />
          <nav aria-label="查詢結果分頁" className="flex justify-between text-sm">
            {cursor ? (
              <Link href={href()} className="py-2 text-brand-700 dark:text-brand-400">
                ← 回到最新結果
              </Link>
            ) : (
              <span />
            )}{' '}
            {result.nextCursor && (
              <Link href={href(result.nextCursor)} className="py-2 text-brand-700 dark:text-brand-400">
                更早的文章 →
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
