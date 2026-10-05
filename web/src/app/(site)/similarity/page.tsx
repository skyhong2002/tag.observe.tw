import Link from 'next/link';
import { fetchCategories } from '@/lib/api';
import type { MediaCamps } from '@/lib/media-graph.mts';
import { pageMetadata } from '@/lib/seo.mts';
import { fetchSimilarity, periodQuery } from '@/lib/similarity';
import catalog from '../../../../../app/data/media-catalog.json';
import { type SimilarityQuery, similarityPeriod, similarityThreshold } from './query';
import SimilarityExplorer from './SimilarityExplorer';

export const metadata = pageMetadata(
  '/similarity/',
  '新聞關係圖',
  '探索新聞媒體間的內文相似與來源／引用關係，點選連線查看文章證據、刊登先後與來源線索。',
  true,
);
export default async function SimilarityPage({ searchParams }: { searchParams: Promise<SimilarityQuery> }) {
  const query = await searchParams;
  const period = similarityPeriod(query);
  const threshold = similarityThreshold(query);
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
