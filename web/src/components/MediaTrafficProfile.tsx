import {
  type ComparisonOutlet,
  channelLabels,
  channelShares,
  countryName,
  percent,
  shortMonth,
  taiwanShare,
} from '@/lib/traffic-comparison.mts';

// Similarweb category ids; others print with spaces instead of underscores.
const categoryName = (category: string) => ({ news_and_media: '新聞與媒體' })[category.toLowerCase()] ?? category.replace(/_/g, ' ');
const duration = (seconds: number) => {
  const whole = Math.round(seconds);
  return whole >= 60 ? `${Math.floor(whole / 60)} 分 ${whole % 60} 秒` : `${whole} 秒`;
};

function Bars({ rows }: { rows: Array<{ label: string; share: number; strong?: boolean }> }) {
  return (
    <ul className="space-y-1">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3rem] items-center gap-2">
          <span className={`truncate ${row.strong ? 'font-medium' : ''}`}>{row.label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-brand-600 dark:bg-brand-400"
              style={{ width: `${Math.max(2, row.share * 100)}%` }}
            />
          </span>
          <span className="text-right tabular-nums">{percent(row.share)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Similarweb's newest month for one outlet: where visitors come from (countries,
 *  channels), how they browse, and the site's ranks. Rendered on /media/[media]/. */
export default function MediaTrafficProfile({ outlet }: { outlet: ComparisonOutlet }) {
  const profile = outlet.trafficProfile;
  if (!profile) return null;
  const tw = taiwanShare(profile);
  const visits = outlet.traffic.find((point) => point.month === profile.month)?.traffic;
  const channels = channelShares(profile);
  const engagement = [
    profile.bounceRate != null && ['跳出率', percent(profile.bounceRate)],
    profile.pagesPerVisit != null && ['每次造訪', `${profile.pagesPerVisit.toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 頁`],
    profile.timeOnSite != null && ['平均停留', duration(profile.timeOnSite)],
  ].filter(Boolean) as Array<[string, string]>;
  const ranks = [
    profile.countryRank && [`${countryName(profile.countryRank.code)}排名`, `第 ${profile.countryRank.rank.toLocaleString('zh-TW')} 名`],
    profile.globalRank != null && ['全球排名', `第 ${profile.globalRank.toLocaleString('zh-TW')} 名`],
    profile.categoryRank && [
      '類別排名',
      `第 ${profile.categoryRank.rank.toLocaleString('zh-TW')} 名 · ${categoryName(profile.categoryRank.category)}`,
    ],
  ].filter(Boolean) as Array<[string, string]>;
  return (
    <section aria-label="網站流量來源" className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <h2 className="mb-3 flex items-baseline justify-between gap-2 text-sm font-semibold">
        網站流量來源
        <span className="text-[11px] font-normal text-zinc-500">Similarweb · {shortMonth(profile.month)}</span>
      </h2>
      {tw && (
        <p className="mb-3 leading-5">
          {'share' in tw ? (
            <>
              台灣訪客占 <span className="font-semibold tabular-nums">{percent(tw.share)}</span>
              {visits != null && (
                <>
                  ，約 <span className="font-semibold tabular-nums">{Math.round(visits * tw.share).toLocaleString('zh-TW')}</span> 次訪問
                </>
              )}
            </>
          ) : (
            <>台灣不在前五大來源國家，占比低於 {percent(tw.below)}</>
          )}
        </p>
      )}
      {profile.countries.length > 0 && (
        <>
          <h3 className="mb-1.5 text-zinc-500 dark:text-zinc-400">來源國家（前五）</h3>
          <Bars rows={profile.countries.map((c) => ({ label: countryName(c.code), share: c.share, strong: c.code === 'TW' }))} />
        </>
      )}
      {channels.length > 0 && (
        <>
          <h3 className="mt-3 mb-1.5 text-zinc-500 dark:text-zinc-400">導流來源</h3>
          <Bars rows={channels.map(([channel, share]) => ({ label: channelLabels[channel], share }))} />
        </>
      )}
      {(engagement.length > 0 || ranks.length > 0) && (
        <dl className="mt-3 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-1.5 border-t border-zinc-200 pt-3 leading-5 dark:border-zinc-800">
          {[...engagement, ...ranks].map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-zinc-500 dark:text-zinc-400">{term}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-[11px] leading-4 text-zinc-500">整個網域的估算值，比例以訪問次數計，非精確 page views。</p>
    </section>
  );
}
