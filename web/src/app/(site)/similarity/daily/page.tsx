import MethodLink from '@/components/MethodLink';
import { relationshipQuery } from '@/lib/relationship-query.mts';
import { pageMetadata } from '@/lib/seo.mts';
import { periodQuery } from '@/lib/similarity';
import DailyTrend from '../DailyTrend';
import { type SimilarityQuery, similarityPeriod, similarityThreshold } from '../query';
import SimilarityTabs from '../SimilarityTabs';

export const metadata = pageMetadata(
  '/similarity/daily/',
  '每日趨勢 · 新聞關係圖',
  '逐日查看新聞比對篇數、相似配對與來源／引用，對照各媒體先刊、後續相似報導的篇數與比例。',
);

export default async function SimilarityDailyPage({ searchParams }: { searchParams: Promise<SimilarityQuery> }) {
  const query = await searchParams;
  const threshold = similarityThreshold(query);
  return (
    <div className="space-y-5">
      <header className="space-y-4">
        <SimilarityTabs
          current="daily"
          query={relationshipQuery({ ...query, ...Object.fromEntries(periodQuery(similarityPeriod(query), threshold)) }).toString()}
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">每日趨勢</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            相似度門檻 {threshold} · <MethodLink />
          </p>
        </div>
      </header>
      <DailyTrend threshold={threshold} />
    </div>
  );
}
