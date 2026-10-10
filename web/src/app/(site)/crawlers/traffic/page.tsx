import CrawlerTabs from '@/components/CrawlerTabs';
import MethodLink from '@/components/MethodLink';
import TrafficCollectionTable, { type CollectionRow, type CollectionState } from '@/components/TrafficCollectionTable';
import { API_ORIGIN } from '@/lib/api';
import { pageMetadata } from '@/lib/seo.mts';
import { shortMonth, sourceStatusLabels } from '@/lib/traffic-comparison.mts';
import { loadComparison } from '../../media/traffic/load';

export const revalidate = 60;
export const metadata = pageMetadata(
  '/crawlers/traffic/',
  '資料蒐集：流量資料',
  '查看 Similarweb 與 Cloudflare Radar 各媒體網域的抓取狀態、最近成功時間與等待抓取的網域。',
);

const taipei = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });

function Batch({
  name,
  status,
  checkedAt,
  error,
  counts,
  schedule,
}: {
  name: string;
  status: keyof typeof sourceStatusLabels | null;
  checkedAt: string | null;
  error: string | null;
  counts: Record<CollectionState, number>;
  schedule: string;
}) {
  const code = error?.match(/HTTP \d+/)?.[0];
  const total = counts.ok + counts.nodata + counts.waiting;
  return (
    <section aria-label={`${name} 批次狀態`} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <h2 className="font-semibold">{name}</h2>
      <p className="mt-1">
        {status ? sourceStatusLabels[status] : '尚未抓取'}
        {code && `（${code}）`}
        {checkedAt && <span className="text-zinc-500"> · 最近檢查 {taipei(checkedAt, true)}</span>}
      </p>
      <p className="mt-1 tabular-nums">
        已取得 {counts.ok}／{total} 個網域
        {counts.nodata > 0 && ` · 無資料 ${counts.nodata}`}
        {counts.waiting > 0 && ` · 等待抓取 ${counts.waiting}`}
        {counts.shared > 0 && <span className="text-zinc-500"> · 共用網域 {counts.shared}</span>}
      </p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{schedule}</p>
    </section>
  );
}

export default async function TrafficCollectionPage() {
  const [data, failedAt] = await Promise.all([
    loadComparison(),
    fetch(`${API_ORIGIN}/api/v1/media-traffic-live`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
      .then((response) => (response.ok ? response.json() : null))
      .then((live: { failedAt?: Record<string, string> } | null) => live?.failedAt ?? {})
      .catch(() => ({}) as Record<string, string>),
  ]);
  const rows: CollectionRow[] = data.outlets
    .filter((outlet) => outlet.sourceKind === 'publisher' && outlet.domain)
    .map((outlet) => {
      const domain = outlet.domain as string;
      const shared = Boolean(outlet.sharedWith);
      return {
        key: outlet.key,
        media: outlet.media,
        name: outlet.name,
        domain,
        sharedWith: outlet.sharedWith ?? null,
        similarweb: shared ? 'shared' : outlet.trafficFetchedAt ? 'ok' : failedAt[domain] ? 'nodata' : 'waiting',
        similarwebAt: outlet.trafficFetchedAt ?? failedAt[domain] ?? null,
        similarwebLabel: outlet.trafficFetchedAt
          ? taipei(outlet.trafficFetchedAt)
          : failedAt[domain]
            ? taipei(failedAt[domain])
            : null,
        profileMonth: outlet.trafficProfile ? shortMonth(outlet.trafficProfile.month) : null,
        radar: shared ? 'shared' : outlet.radar ? 'ok' : 'waiting',
        radarAt: outlet.radar?.fetchedAt ?? null,
        radarLabel: outlet.radar ? taipei(outlet.radar.fetchedAt) : null,
        radarPeriod: outlet.radar ? taipei(outlet.radar.dateEnd) : null,
      } satisfies CollectionRow;
    });
  const count = (field: 'similarweb' | 'radar') =>
    Object.fromEntries((['ok', 'nodata', 'waiting', 'shared'] as const).map((s) => [s, rows.filter((r) => r[field] === s).length])) as Record<
      CollectionState,
      number
    >;
  return (
    <div className="space-y-5">
      <CrawlerTabs current="traffic" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">流量資料</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          「流量與排名」頁各媒體網域的 Similarweb 與 Cloudflare Radar 抓取狀態 <MethodLink />
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <Batch
          name="Similarweb"
          status={data.liveTrafficStatus}
          checkedAt={data.liveTrafficCheckedAt}
          error={data.liveTrafficError}
          counts={count('similarweb')}
          schedule="每小時分批抓取，先抓等待中與最舊的網域，每個網域約每週重抓；被限流（HTTP 403）時停止，下一輪接著抓。"
        />
        <Batch
          name="Cloudflare Radar"
          status={data.radarStatus}
          checkedAt={data.radarCheckedAt}
          error={data.radarError}
          counts={count('radar')}
          schedule="每日抓取一次，先抓等待中與最舊的網域；單批超過五分鐘時，隔天接著抓。"
        />
      </div>
      <TrafficCollectionTable rows={rows} />
    </div>
  );
}
