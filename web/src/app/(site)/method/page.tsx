import { EventMethod, MediaMethod, RankingMethod, SimilarityMethod, SourceMethod, TopicMethod } from '@/components/MethodNotes';

// Every method block in one place; the footer shows only the ones for the page at hand.

export const metadata = {
  title: '資料來源與計算方式',
  description: '新文易數如何抓取新聞、取得標籤，以及關鍵字排行、新聞關係圖、事件分群與藍綠分類的計算方式。',
};

export default function MethodPage() {
  return (
    <article className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">資料來源與計算方式</h1>
      <div className="mt-6 space-y-3 text-sm leading-[1.9] text-zinc-700 dark:text-zinc-300 [&_h3]:pt-6 [&_h3]:text-base [&_h3]:first:pt-0">
        <SourceMethod />
        <RankingMethod />
        <SimilarityMethod />
        <MediaMethod />
        <EventMethod />
        <TopicMethod />
      </div>
    </article>
  );
}
