import Link from 'next/link';
import { fetchCategories } from '@/lib/api';
import type { MediaCamps } from '@/lib/media-graph.mts';
import { pageMetadata } from '@/lib/seo.mts';
import { fetchSimilarity, periodQuery } from '@/lib/similarity';
import type { TaiwanReaders } from '@/lib/traffic-comparison.mts';
import { loadTaiwanReaders } from '../media/traffic/load';
import { type SimilarityQuery, similarityPeriod, similarityThreshold } from './query';
import SimilarityExplorer from './SimilarityExplorer';

export const metadata = pageMetadata(
  '/similarity/',
  '媒體關係圖',
  '探索新聞媒體間的內文相似與來源／引用關係，點選連線查看文章證據、刊登先後與來源線索。',
  true,
);
export default async function SimilarityPage({ searchParams }: { searchParams: Promise<SimilarityQuery> }) {
  const query = await searchParams;
  const period = similarityPeriod(query);
  const threshold = similarityThreshold(query);
  const params = periodQuery(period, threshold);
  const [data, categories, readers] = await Promise.all([
    fetchSimilarity(period, threshold).catch(() => null),
    fetchCategories().catch(() => []),
    loadTaiwanReaders().catch(() => ({}) as Record<string, TaiwanReaders>),
  ]);
  if (data) {
    const members = (key: string) => categories.find((category) => category.key === key)?.members ?? [];
    const camps: MediaCamps = {};
    for (const node of data.nodes) {
      if (members('blue').includes(node.id)) camps[node.id] = 'blue';
      else if (members('green').includes(node.id)) camps[node.id] = 'green';
    }
    const tags = categories
      .filter(({ key }) => key !== 'all' && key !== 'blue' && key !== 'green')
      .map((category) => ({ id: category.key, media: category.members, label: category.label }));
    return <SimilarityExplorer key={`${params}-${data.generatedAt}`} data={data} camps={camps} tags={tags} readers={readers} />;
  }
  return (
    <div role="status" className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h1 className="text-xl font-semibold">媒體關係圖</h1>
      <p className="my-4 text-sm text-zinc-500 dark:text-zinc-400">暫時無法取得分析資料，請稍後重新載入。這不代表沒有相似文章。</p>
      <Link href={`/similarity/?${params}`} className="text-sm text-brand-700 underline dark:text-brand-400">
        重新載入
      </Link>
    </div>
  );
}
