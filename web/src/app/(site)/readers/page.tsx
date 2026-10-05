import Link from 'next/link';
import { ObservationStatus, observationLink, observationMuted, ReaderRanking } from '@/components/Observation';
import { fetchObservation } from '@/lib/observation-api';
import { pageMetadata } from '@/lib/seo.mts';

export const metadata = pageMetadata(
  '/readers/',
  '讀者關注',
  '依近 7 個完整日的站內瀏覽紀錄，查看達到樣本門檻的事件與標籤頁，以及資料期間與更新狀態。',
);
export default async function ReadersPage() {
  const data = await fetchObservation();
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <header>
        <p className={observationMuted}>新文易數・公開觀測</p>
        <h1 className="mt-2 text-3xl font-bold">讀者關注</h1>
        <p className={`${observationMuted} mt-3`}>最近有哪些事件與標籤受到站內讀者關注？</p>
      </header>
      <ObservationStatus data={data} />
      {data && <ReaderRanking data={data} />}
      <Link href="/observe/?tab=content" className={observationLink}>
        查看完整網站觀測 →
      </Link>
    </div>
  );
}
