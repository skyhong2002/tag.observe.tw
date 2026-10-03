import Link from 'next/link';
import { fetchCategories } from '@/lib/api';
import type { MediaCamps } from '@/lib/media-graph.mts';
import { fetchSimilarity, MAX_RANGE_DAYS, PERIOD_HOURS, periodQuery, type SimilarityPeriod } from '@/lib/similarity';
import catalog from '../../../../../app/data/media-catalog.json';
import SimilarityExplorer from './SimilarityExplorer';

export const metadata = { title: '新聞關係圖', description: '點選媒體圖示固定高亮新聞內文相似與引用關係，在圖表下方篩選與瀏覽文章證據。' };
const isDay = (value: string | undefined): value is string => {
  const time = Date.parse(`${value}T00:00:00Z`);
  return (
    !!value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '2000-01-01' &&
    Number.isFinite(time) &&
    new Date(time).toISOString().startsWith(value)
  );
};

/** Taipei dates `from`–`to` (inclusive, at most 31 days), else one of the rolling windows; 48 hours by default. */
function similarityPeriod(query: { hours?: string; from?: string; to?: string }): SimilarityPeriod {
  const { from, to } = query;
  if (isDay(from) && isDay(to) && from <= to && (Date.parse(to) - Date.parse(from)) / 86400e3 < MAX_RANGE_DAYS) return { from, to };
  const hours = Number(query.hours);
  return { hours: (PERIOD_HOURS as readonly number[]).includes(hours) ? hours : 48 };
}

export default async function SimilarityPage({
  searchParams,
}: {
  searchParams: Promise<{ hours?: string; from?: string; to?: string; threshold?: string }>;
}) {
  const query = await searchParams;
  const period = similarityPeriod(query);
  const requested = Number(query.threshold ?? 0.65);
  const threshold = Number.isFinite(requested) ? Math.min(1, Math.max(0.5, requested)) : 0.65;
  const params = periodQuery(period, threshold);
  const [data, categories] = await Promise.all([fetchSimilarity(period, threshold).catch(() => null), fetchCategories().catch(() => [])]);
  if (data) {
    const camps: MediaCamps = {};
    for (const node of data.nodes) {
      if (catalog.categories.blue.includes(node.id)) camps[node.id] = 'blue';
      else if (catalog.categories.green.includes(node.id)) camps[node.id] = 'green';
    }
    const tags = Object.entries(catalog.categories)
      .filter(([id]) => id !== 'blue' && id !== 'green')
      .map(([id, media]) => ({ id, media, label: categories.find((category) => category.key === id)?.label ?? id }));
    return <SimilarityExplorer key={`${params}-${data.generatedAt}`} data={data} camps={camps} tags={tags} />;
  }
  return (
    <div role="status" className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h1 className="text-xl font-semibold">新聞關係圖</h1>
      <p className="my-4 text-sm text-zinc-500">暫時無法取得分析資料，請稍後重新載入。這不代表沒有相似文章。</p>
      <Link href={`/similarity/?${params}`} className="text-sm text-brand-700 underline dark:text-brand-400">
        重新載入
      </Link>
    </div>
  );
}
