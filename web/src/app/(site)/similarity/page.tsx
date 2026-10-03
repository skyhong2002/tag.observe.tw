import Link from 'next/link';
import type { MediaCamps } from '@/lib/media-graph.mts';
import { fetchSimilarity } from '@/lib/similarity';
import catalog from '../../../../../app/data/media-catalog.json';
import SimilarityExplorer from './SimilarityExplorer';

export const metadata = { title: '新聞關係圖', description: '以媒體圖示查看新聞內文相似與引用關係，移到圖示查看引用篇數。' };
export default async function SimilarityPage({
  searchParams,
}: {
  searchParams: Promise<{ hours?: string; threshold?: string; mediaCount?: string }>;
}) {
  const query = await searchParams;
  const hours = [24, 48, 72, 168].includes(Number(query.hours)) ? Number(query.hours) : 48;
  const requested = Number(query.threshold ?? 0.65);
  const threshold = Number.isFinite(requested) ? Math.min(1, Math.max(0.5, requested)) : 0.65;
  const mediaCount = ['10', '20', '40', '60', '80', 'all'].includes(query.mediaCount ?? '') ? query.mediaCount! : 'auto';
  const data = await fetchSimilarity(hours, threshold).catch(() => null);
  if (data) {
    const camps: MediaCamps = {};
    for (const node of data.nodes) {
      if (catalog.categories.blue.includes(node.id)) camps[node.id] = 'blue';
      else if (catalog.categories.green.includes(node.id)) camps[node.id] = 'green';
    }
    return (
      <SimilarityExplorer
        key={`${hours}-${threshold}-${mediaCount}-${data.generatedAt}`}
        data={data}
        camps={camps}
        initialMediaLimit={mediaCount}
      />
    );
  }
  return (
    <div role="status" className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h1 className="text-xl font-semibold">新聞關係圖</h1>
      <p className="my-4 text-sm text-zinc-500">暫時無法取得分析資料，請稍後重新載入。這不代表沒有相似文章。</p>
      <Link href={`/similarity/?hours=${hours}&threshold=${threshold}`} className="text-sm text-brand-700 underline dark:text-brand-400">
        重新載入
      </Link>
    </div>
  );
}
