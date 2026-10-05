import Link from 'next/link';
import {
  ObservationPeriodLabel,
  ObservationStats,
  ObservationStatus,
  observationLink,
  observationMuted,
  observationPanel,
  ReaderRanking,
} from '@/components/Observation';
import { fetchObservation } from '@/lib/observation-api';
import { pageMetadata } from '@/lib/seo.mts';

export const metadata = pageMetadata(
  '/observe/',
  '網站觀測',
  '公開呈現新文易數的 Google 搜尋表現、站內熱門內容與使用體驗，並說明資料期間、更新狀態與樣本限制。',
);
const tabs = [
  { id: 'search', label: '搜尋表現' },
  { id: 'content', label: '熱門內容' },
  { id: 'experience', label: '使用體驗' },
];
const metricLabels = { LCP: '主要內容顯示速度', INP: '操作反應速度', CLS: '版面穩定度' };
export default async function ObservePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [params, data] = await Promise.all([searchParams, fetchObservation()]);
  const tab = tabs.some((t) => t.id === params.tab) ? params.tab : 'search';
  const search = data?.search;
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <header>
        <p className={observationMuted}>新文易數・公開觀測</p>
        <h1 className="mt-2 text-3xl font-bold">網站觀測</h1>
        <p className={`${observationMuted} mt-3`}>分享網站被找到、被閱讀與被使用的情況。所有人都能查看同一份彙整資料。</p>
      </header>
      <ObservationStatus data={data} />
      <nav aria-label="觀測分類" className="flex gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/observe/?tab=${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === t.id ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {data && tab === 'search' && search && (
        <section className={observationPanel} aria-labelledby="search-title">
          <h2 id="search-title" className="text-xl font-semibold">
            Google 搜尋表現
          </h2>
          <ObservationPeriodLabel period={search.period} zone="美國太平洋時間" />
          {search.totals ? (
            <>
              <ObservationStats
                items={[
                  { label: '搜尋曝光', value: search.totals.impressions.toLocaleString('zh-TW') },
                  { label: '搜尋點擊', value: search.totals.clicks.toLocaleString('zh-TW') },
                  {
                    label: '點閱率',
                    value: search.totals.impressions ? `${((search.totals.clicks / search.totals.impressions) * 100).toFixed(1)}%` : '—',
                  },
                ]}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm tabular-nums">
                  <caption className="pb-3 text-left text-zinc-500">每日搜尋紀錄（有回傳資料的日期）</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="py-3 text-left">
                        日期
                      </th>
                      <th scope="col">曝光</th>
                      <th scope="col">點擊</th>
                    </tr>
                  </thead>
                  <tbody>
                    {search.daily.map((row) => (
                      <tr key={row.date} className="border-t border-zinc-200 dark:border-zinc-800">
                        <th scope="row" className="py-3 text-left font-normal">
                          {row.date}
                        </th>
                        <td>{row.impressions.toLocaleString('zh-TW')}</td>
                        <td>{row.clicks.toLocaleString('zh-TW')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="my-6 text-sm leading-7">Google 尚未回傳這段期間的搜尋紀錄。這不代表網站沒有被收錄，也不能解讀為零曝光。</p>
          )}
          <p className={`${observationMuted} mt-4`}>
            來源：Google Search
            Console，僅採用已完成處理的網頁搜尋資料，通常會延遲數日。沒有回傳的日期不補零；不公開個別搜尋字詞。這份報表不能判定每個網址的收錄狀態。
          </p>
        </section>
      )}
      {data && tab === 'content' && (
        <>
          <section className={observationPanel}>
            <h2 className="text-xl font-semibold">站內閱讀概況</h2>
            <ObservationPeriodLabel period={data.content.period} zone="台灣時間" />
            {data.content.totals ? (
              <ObservationStats
                items={[
                  { label: '全站瀏覽次數', value: data.content.totals.views.toLocaleString('zh-TW') },
                  { label: '工作階段', value: data.content.totals.sessions.toLocaleString('zh-TW') },
                ]}
              />
            ) : (
              <p className="mt-5 text-sm">這段期間尚無可用的閱讀統計。</p>
            )}
            <p className={observationMuted}>
              來源：Google Analytics 4。全站瀏覽包含首頁及其他頁面，排行只列事件與標籤頁。工作階段表示一段造訪，不等於獨立讀者。
            </p>
          </section>
          <ReaderRanking data={data} />
          <Link href="/readers/" className={observationLink}>
            開啟讀者關注專頁 →
          </Link>
        </>
      )}
      {data && tab === 'experience' && (
        <section className={observationPanel} aria-labelledby="experience-title">
          <h2 id="experience-title" className="text-xl font-semibold">
            真實使用體驗
          </h2>
          <ObservationPeriodLabel period={data.content.period} zone="台灣時間" />
          {data.experience.metrics.length ? (
            <div className="my-6 grid gap-4 sm:grid-cols-3">
              {data.experience.metrics.map((m) => (
                <div key={m.name} className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
                  <h3 className="font-semibold">
                    {m.name}・{metricLabels[m.name]}
                  </h3>
                  <p className="my-3 text-2xl font-semibold">{m.goodPercent}% 良好</p>
                  <p className={observationMuted}>{m.samples} 份有效樣本</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="my-6 text-sm leading-7">目前尚無足夠的分類統計可判讀使用體驗。每項指標至少累積 30 份有效樣本後才顯示結果。</p>
          )}
          <p className={observationMuted}>
            LCP 觀察主要內容何時出現，INP 觀察互動回應，CLS 觀察版面位移。這裡呈現所有裝置回報樣本中的「良好」比例，不是第 75 百分位，也不是
            Google 的 Core Web Vitals 通過判定。
          </p>
          <p className={`${observationMuted} mt-3`}>
            資料來自同意或允許分析的瀏覽器；樣本是頁面載入紀錄，不是獨立使用者。沒有互動的頁面可能沒有 INP。尚未達門檻的指標暫不列出。
          </p>
        </section>
      )}
      <p className={observationMuted}>
        此頁公開彙整數字，不公開使用者識別資料或個別瀏覽紀錄。
        <Link href="/api/v1/site-observation" prefetch={false} className={observationLink}>
          下載同一份公開資料
        </Link>
      </p>
    </div>
  );
}
