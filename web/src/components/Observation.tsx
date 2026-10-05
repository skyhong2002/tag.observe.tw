import Link from 'next/link';
import type { Observation, ObservationPeriod } from '@/lib/observation.mts';

export const observationPanel = 'rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7 dark:border-zinc-800 dark:bg-zinc-950';
export const observationMuted = 'text-sm leading-7 text-zinc-600 dark:text-zinc-400';
export const observationLink = 'text-brand-700 underline underline-offset-4 dark:text-brand-400';
export function ObservationPeriodLabel({ period, zone }: { period: ObservationPeriod; zone: string }) {
  return (
    <p className={observationMuted}>
      {period.start} — {period.end}（{zone}，完整日）
    </p>
  );
}
export function ObservationStatus({ data }: { data: Observation | null }) {
  if (!data)
    return (
      <p role="status" className={observationPanel}>
        目前尚無可用的觀測資料。請稍後再來查看。
      </p>
    );
  const stale = Date.now() - Date.parse(data.updatedAt) > 48 * 3600_000;
  return (
    <div className={observationMuted}>
      <p>
        最後成功更新：
        {new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(data.updatedAt),
        )}
        （台灣時間）・手動更新
      </p>
      {stale && (
        <p role="status" className="font-medium text-amber-800 dark:text-amber-300">
          資料已超過 48 小時未更新，以下保留上次成功取得的結果。
        </p>
      )}
      <p>本站剛開始累積資料，數字可能包含測試流量；不代表所有讀者，也不作為即時服務可用率。</p>
    </div>
  );
}
export function ReaderRanking({ data }: { data: Observation }) {
  return (
    <section className={observationPanel} aria-labelledby="reader-ranking-title">
      <h2 id="reader-ranking-title" className="text-xl font-semibold">
        近 7 天讀者關注
      </h2>
      <ObservationPeriodLabel period={data.content.period} zone="台灣時間" />
      <p className={`${observationMuted} mt-3`}>
        依事件與標籤頁的瀏覽次數排序；每頁至少 10 次瀏覽、3 位活躍使用者才列入，最多 20 筆。這是站內閱讀情況，與媒體報導量的標籤排行不同。
      </p>
      {data.content.ranking.length ? (
        <ol className="mt-5 divide-y divide-zinc-200 dark:divide-zinc-800">
          {data.content.ranking.map((row, i) => (
            <li key={row.path} className="flex items-start gap-4 py-4">
              <span className="w-6 shrink-0 text-xl tabular-nums text-zinc-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={row.path} className={`${observationLink} break-words font-medium`}>
                  {row.title}
                </Link>
                <p className={observationMuted}>{row.path.startsWith('/eve/') ? '事件' : '標籤'}</p>
              </div>
              <span className="shrink-0 text-sm tabular-nums">{row.views.toLocaleString('zh-TW')} 次</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 rounded-xl bg-zinc-50 p-5 text-sm leading-7 dark:bg-zinc-900">
          還沒有達到樣本門檻的內容。累積足夠閱讀紀錄並更新資料後，排行會在這裡出現。
        </p>
      )}
      <p className={`${observationMuted} mt-4`}>
        同一人重複瀏覽會增加次數。停用分析、阻擋追蹤或尚未處理的資料可能未計入；瀏覽次數不等於獨立讀者數。
      </p>
    </section>
  );
}
export function ObservationStats({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
          <dt className={observationMuted}>{item.label}</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
