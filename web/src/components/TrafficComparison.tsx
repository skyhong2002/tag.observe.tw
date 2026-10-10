'use client';

import { useEffect, useState } from 'react';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import TrafficSparkline from '@/components/TrafficSparkline';
import { mediaNames } from '@/lib/media-names.mts';
import { trafficGrowth, trafficNumber } from '@/lib/media-traffic.mts';
import {
  type ComparisonData,
  type ComparisonOutlet,
  collectionPoint,
  radarText,
  shortMonth,
  type TrafficPoint,
} from '@/lib/traffic-comparison.mts';

const control = 'min-h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700';
type Sort = 'traffic' | 'radar' | 'reference' | 'articles' | 'name';
type View = 'value' | 'change';

const radarPosition = (outlet: ComparisonOutlet) =>
  outlet.radar?.rank ?? outlet.radar?.bucket ?? (outlet.radar?.bucketLowerBound != null ? outlet.radar.bucketLowerBound + 1 : null);
/** Change against the source's previous available month; null when either month is missing. */
function monthChange(points: TrafficPoint[] | undefined, months: string[], month: string) {
  const before = months[months.indexOf(month) - 1];
  const now = points?.find((p) => p.month === month)?.traffic;
  const then = before ? points?.find((p) => p.month === before)?.traffic : null;
  return now != null && then ? (now - then) / then : null;
}
function Change({ value }: { value: number | null }) {
  return (
    <span
      className={
        value == null
          ? 'text-zinc-500'
          : value > 0
            ? 'text-emerald-700 dark:text-emerald-400'
            : value < 0
              ? 'text-red-700 dark:text-red-400'
              : ''
      }
    >
      {trafficGrowth(value)}
    </span>
  );
}

export default function TrafficComparison({ data, initial }: { data: ComparisonData; initial: Record<string, string | undefined> }) {
  const [trafficMonth, setTrafficMonth] = useState(
    data.trafficMonths.includes(initial.month ?? '') ? initial.month! : (data.trafficMonths.at(-1) ?? ''),
  );
  const crawlMonth = data.crawlMonths.at(-1) ?? null;
  const [referenceMonth, setReferenceMonth] = useState(
    data.referenceMonths.includes(initial.referenceMonth ?? '') ? initial.referenceMonth! : (data.referenceMonths.at(-1) ?? ''),
  );
  const [query, setQuery] = useState(initial.q ?? '');
  const [sort, setSort] = useState<Sort>(
    ['traffic', 'radar', 'reference', 'articles', 'name'].includes(initial.sort ?? '') ? (initial.sort as Sort) : 'articles',
  );
  const [view, setView] = useState<View>(initial.view === 'change' ? 'change' : 'value');
  const [ascending, setAscending] = useState(initial.dir === 'asc');
  const recentTrafficMonths = data.trafficMonths.filter((month) => month <= trafficMonth).slice(-3);
  const recentReferenceMonths = data.referenceMonths.filter((month) => month <= referenceMonth).slice(-3);
  const trafficAt = (outlet: ComparisonOutlet) => outlet.traffic.find((p) => p.month === trafficMonth);
  const referenceAt = (outlet: ComparisonOutlet) => outlet.referenceTraffic?.find((p) => p.month === referenceMonth);
  const articlesAt = (outlet: ComparisonOutlet) => (crawlMonth ? collectionPoint(outlet, crawlMonth).articles : null);
  const needle = query.trim().toLocaleLowerCase();
  const filtered = data.outlets.filter((o) => `${o.name} ${o.domain ?? ''} ${o.media ?? ''}`.toLocaleLowerCase().includes(needle));
  const metric = (o: ComparisonOutlet): number | string | null => {
    if (sort === 'name') return o.name;
    if (sort === 'articles') return articlesAt(o);
    // Smaller Radar positions are more popular, so negate them: descending lists the most popular first.
    if (sort === 'radar') return radarPosition(o) == null ? null : -(radarPosition(o) as number);
    if (sort === 'reference')
      return view === 'change' ? monthChange(o.referenceTraffic, data.referenceMonths, referenceMonth) : (referenceAt(o)?.traffic ?? null);
    return view === 'change' ? monthChange(o.traffic, data.trafficMonths, trafficMonth) : (trafficAt(o)?.traffic ?? null);
  };
  filtered.sort((a, b) => {
    const x = metric(a),
      y = metric(b);
    if (x == null || y == null) return x == null && y == null ? a.name.localeCompare(b.name, 'zh-Hant') : x == null ? 1 : -1;
    return (ascending ? 1 : -1) * (typeof x === 'string' ? x.localeCompare(y as string, 'zh-Hant') : x - (y as number));
  });
  useEffect(() => {
    const params = new URLSearchParams({ sort, dir: ascending ? 'asc' : 'desc' });
    if (trafficMonth && trafficMonth !== data.trafficMonths.at(-1)) params.set('month', trafficMonth);
    if (referenceMonth && referenceMonth !== data.referenceMonths.at(-1)) params.set('referenceMonth', referenceMonth);
    if (query) params.set('q', query);
    if (view === 'change') params.set('view', view);
    window.history.replaceState(null, '', `/media/sources/?${params}`);
  }, [trafficMonth, referenceMonth, sort, ascending, query, view, data.trafficMonths, data.referenceMonths]);
  const chooseSort = (value: Sort) => {
    setAscending(sort === value ? !ascending : value === 'name');
    setSort(value);
  };

  return (
    <section aria-label="媒體流量與收錄清單" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          aria-label="搜尋媒體或網域"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="搜尋媒體或網域"
          className={`${control} w-44 max-w-full`}
        />
        <fieldset className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <legend className="sr-only">流量顯示方式</legend>
          <span aria-hidden="true">顯示</span>
          <span className="inline-flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
            {(
              [
                ['value', '數值'],
                ['change', '月變化'],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`min-h-9 px-3 text-sm ${view === value ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : ''}`}
              >
                {text}
              </button>
            ))}
          </span>
        </fieldset>
        <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          Similarweb 月份
          <select
            aria-label="Similarweb 月份"
            className={control}
            value={trafficMonth}
            disabled={!data.trafficMonths.length}
            onChange={(e) => {
              setTrafficMonth(e.target.value);
            }}
          >
            {!data.trafficMonths.length && <option value="">尚無資料</option>}
            {data.trafficMonths.toReversed().map((month) => (
              <option key={month} value={month}>
                {shortMonth(month)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          GeneHong 月份
          <select
            aria-label="GeneHong 月份"
            className={control}
            value={referenceMonth}
            disabled={!data.referenceMonths.length}
            onChange={(e) => setReferenceMonth(e.target.value)}
          >
            {!data.referenceMonths.length && <option value="">尚無資料</option>}
            {data.referenceMonths.toReversed().map((month) => (
              <option key={month} value={month}>
                {shortMonth(month)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="relative overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[850px] table-fixed text-sm tabular-nums">
          <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
            <tr>
              {(
                [
                  { key: 'name', label: '媒體', sub: '' },
                  { key: 'articles', label: '本站收錄', sub: crawlMonth ? `${shortMonth(crawlMonth)} · 篇` : '篇' },
                  {
                    key: 'traffic',
                    label: 'Similarweb',
                    sub: trafficMonth ? `${shortMonth(trafficMonth)} · ${view === 'change' ? '較上月' : '月訪問次數'}` : '月訪問次數',
                  },
                  { key: 'radar', label: 'Cloudflare Radar', sub: '全球排名' },
                  {
                    key: 'reference',
                    label: 'GeneHong',
                    sub: referenceMonth ? `${shortMonth(referenceMonth)} · ${view === 'change' ? '較上月' : '原表值'}` : '原表值',
                  },
                ] as const
              ).map(({ key, label, sub }) => (
                <th
                  scope="col"
                  key={key}
                  aria-sort={sort === key ? (ascending ? 'ascending' : 'descending') : 'none'}
                  className={`px-2 py-2 sm:px-4 ${key === 'name' ? 'w-[28%] text-left' : key === 'articles' ? 'w-[12%] text-right' : 'text-right'}`}
                >
                  <button type="button" onClick={() => chooseSort(key)} className="min-h-8 font-medium">
                    {label} <span aria-hidden="true">{sort === key ? (ascending ? '↑' : '↓') : '↕'}</span>
                    {sub && <span className="block text-[10px] font-normal">{sub}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((outlet) => {
              const shared = outlet.sharedWith && `與${outlet.sharedWith}共用 ${outlet.domain}；整個網域的數字只列在${outlet.sharedWith}`;
              const point = trafficAt(outlet),
                count = articlesAt(outlet),
                reference = referenceAt(outlet);
              const identity = (
                <>
                  {outlet.media ? (
                    <MediaIcon media={outlet.media} title={outlet.name} size={24} />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800"
                    >
                      {outlet.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{outlet.name}</span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {outlet.domain ??
                        (outlet.media && mediaNames[outlet.media]?.status === 'historical' ? '歷史來源・原網域已停用' : '網域待確認')}
                      {outlet.sourceKind === 'discovery' && ' · 文章發現來源'}
                    </span>
                  </span>
                </>
              );
              return (
                <tr
                  key={outlet.key}
                  data-media={outlet.key}
                  className="border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
                >
                  <td className="px-2 py-2 sm:px-4">
                    {outlet.media ? (
                      <MediaHoverLink
                        media={outlet.media}
                        title={outlet.name}
                        icon={false}
                        className="flex items-center gap-2 hover:underline"
                      >
                        {identity}
                      </MediaHoverLink>
                    ) : (
                      <div className="flex items-center gap-2" title={outlet.name}>
                        {identity}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right sm:px-4">{count == null ? '—' : count.toLocaleString('zh-TW')}</td>
                  <td
                    className="px-2 py-2 text-right sm:px-4"
                    title={shared ?? (outlet.trafficFetchedAt && `${outlet.trafficFetchedAt.slice(0, 10)} 更新`)}
                  >
                    <div className="flex flex-col-reverse items-end gap-1">
                      <TrafficSparkline traffic={outlet.traffic} months={recentTrafficMonths} label="Similarweb 估算月訪問量" />
                      <span>
                        {view === 'change' ? (
                          <Change value={monthChange(outlet.traffic, data.trafficMonths, trafficMonth)} />
                        ) : (
                          trafficNumber(point?.traffic ?? null)
                        )}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-2 py-2 text-right sm:px-4"
                    title={
                      shared ??
                      (outlet.radar &&
                        `${outlet.radar.rank != null ? '精確名次' : '排名級距'}・資料期末 ${outlet.radar.dateEnd.slice(0, 10)}・${outlet.radar.fetchedAt.slice(0, 10)} 更新`)
                    }
                  >
                    {radarText(outlet.radar)}
                  </td>
                  <td
                    className="px-2 py-2 text-right sm:px-4"
                    title={
                      [
                        reference?.adjusted && `原表人工調整值 ${trafficNumber(reference.rawTraffic)}`,
                        reference?.ambiguous && '同一媒體有多列，待核對',
                        outlet.referenceDomain && outlet.referenceDomain !== outlet.domain && `原表網域 ${outlet.referenceDomain}`,
                      ]
                        .filter(Boolean)
                        .join('；') || undefined
                    }
                  >
                    <div className="flex flex-col-reverse items-end gap-1">
                      <TrafficSparkline traffic={outlet.referenceTraffic ?? []} months={recentReferenceMonths} label="GeneHong 整理表" />
                      <span>
                        {view === 'change' ? (
                          <Change value={monthChange(outlet.referenceTraffic, data.referenceMonths, referenceMonth)} />
                        ) : (
                          trafficNumber(reference?.traffic ?? null)
                        )}
                        {(reference?.adjusted || reference?.ambiguous) && <sup className="text-zinc-500">*</sup>}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && <p className="p-8 text-center text-sm text-zinc-500">沒有符合條件的媒體。</p>}
      </div>
    </section>
  );
}
