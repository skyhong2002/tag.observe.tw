'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import ArticleListItem from '@/components/ArticleListItem';
import { SectionTitle, StatTiles } from '@/components/DataSections';
import DeferredChart from '@/components/DeferredChart';
import { filterChipClass } from '@/components/FilterChips';
import MediaHoverLink from '@/components/MediaHoverLink';
import MethodLink from '@/components/MethodLink';
import { pill, pillOff, pillOn } from '@/components/reader/FollowButton';
import TabButtons from '@/components/TabButtons';
import TableScroller from '@/components/TableScroller';
import { taipei, taipeiDate } from '@/lib/api';
import { formInput, formLabel, formSubmit } from '@/lib/form-styles';
import { table } from '@/lib/table-styles';
import {
  type Observation,
  type ObservationScope,
  observationHref,
  observationQuery,
  observationScope,
} from '../../../../../app/src/observation-scope.ts';

const TrendChart = lazy(() => import('@/components/TrendChart'));
type Saved = { anchor: string; any: string[]; version: 1 };
const STORE = 'tag-observe:observations:v1';
const format = (n: number) => n.toLocaleString('zh-TW');
const note = 'text-xs text-zinc-500 dark:text-zinc-400';
const link = 'text-brand-700 hover:underline dark:text-brand-400';
const card = 'space-y-3 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900';
export function SavedObservations({ scope }: { scope?: ObservationScope }) {
  const [saved, setSaved] = useState<Saved[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORE) ?? '[]');
      if (Array.isArray(stored))
        setSaved(
          stored.slice(0, 30).flatMap((s) => {
            try {
              return s.version === 1 && Array.isArray(s.any) ? [observationScope(s.anchor, s.any.join(','))] : [];
            } catch {
              return [];
            }
          }),
        );
    } catch {
      setMessage('瀏覽器儲存空間無法使用；仍可將網址加入書籤。');
    }
  }, []);
  function update(next: Saved[]) {
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
      setSaved(next);
      setMessage('已更新此瀏覽器的觀察清單。');
    } catch {
      setMessage('無法儲存；請將網址加入書籤。');
    }
  }
  const exists = scope && saved.some((s) => observationHref(s) === observationHref(scope));
  return (
    <section className="space-y-2" aria-label="此瀏覽器的觀察清單">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-medium">
          我的觀察 <span className={`${note} font-normal`}>此瀏覽器</span>
        </h2>
        {scope && (
          <button
            type="button"
            className={`${pill} ${exists ? pillOn : pillOff}`}
            disabled={!exists && saved.length >= 30}
            onClick={() => {
              update(
                exists
                  ? saved.filter((s) => observationHref(s) !== observationHref(scope))
                  : [...saved, { version: 1, anchor: scope.anchor, any: scope.any }],
              );
            }}
          >
            {exists ? '移除此觀察' : '儲存此觀察'}
          </button>
        )}
      </div>
      {saved.length ? (
        <ul className="flex flex-wrap gap-2">
          {saved.map((s) => (
            <li key={observationHref(s)} className="flex items-center gap-1">
              <Link href={observationHref(s)} className={`${filterChipClass(false)} text-sm`}>
                {s.anchor}
                {s.any.length ? ` × (${s.any.join(' / ')})` : ''}
              </Link>
              <button
                type="button"
                className="px-1 text-sm text-zinc-500 hover:text-brand-700 dark:text-zinc-400 dark:hover:text-brand-400"
                aria-label={`移除 ${s.anchor} 的觀察`}
                onClick={() => update(saved.filter((item) => observationHref(item) !== observationHref(s)))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={note}>儲存後可從這裡重開，持續取得最新資料。也可以直接收藏或分享網址。</p>
      )}
      {message && (
        <p role="status" className={note}>
          {message}
        </p>
      )}
    </section>
  );
}

type Bin = { from: string; to: string; total: number | null };
export default function TrackingView({ data }: { data: Observation }) {
  const router = useRouter();
  const [span, setSpan] = useState<'day' | 'week' | 'month'>('week');
  const [cutoff, setCutoff] = useState(data.window.at);
  const [share, setShare] = useState('');
  const bins = useMemo(() => {
    const result: Bin[] = [];
    for (const day of data.days) {
      const week = new Date(`${day.day}T00:00:00Z`);
      week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
      const key = span === 'day' ? day.day : span === 'month' ? day.day.slice(0, 7) : week.toISOString().slice(0, 10);
      const last = result[result.length - 1];
      if (last && (span === 'month' ? last.from.slice(0, 7) === key : span === 'week' ? last.from >= key : false)) {
        last.to = day.day;
        if (day.articles !== null) last.total = (last.total ?? 0) + day.articles;
      } else result.push({ from: day.day, to: day.day, total: day.articles });
    }
    return result;
  }, [data.days, span]);
  const scopeInputs = (
    <>
      <input type="hidden" name="v" value="1" />
      <input type="hidden" name="anchor" value={data.scope.anchor} />
      {data.scope.any.length > 0 && <input type="hidden" name="with" value={data.scope.any.join(',')} />}
    </>
  );
  const href = useCallback(
    (at?: string) => {
      const q = observationQuery(data.scope);
      q.set('from', data.window.from);
      q.set('to', data.window.to);
      if (at) q.set('at', at);
      return `/tracking/?${q}`;
    },
    [data.scope, data.window.from, data.window.to],
  );
  const selectBin = useCallback(
    (index: number) => {
      const bin = bins[index];
      if (bin && bin.total !== null) router.push(href(bin.to > data.window.at ? data.window.at : bin.to), { scroll: false });
    },
    [bins, data.window.at, href, router],
  );
  const chartDays = useMemo(() => bins.map((b) => b.from), [bins]);
  const chartBars = useMemo(() => bins.map((b) => b.total), [bins]);
  const lines = useMemo(() => [], []);
  const months = [...new Set(data.days.map((d) => d.day.slice(0, 7)))];
  return (
    <>
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {data.scope.anchor}
            {data.scope.any.length > 0 && <> ×（{data.scope.any.join(' 或 ')}）</>}
          </h2>
          <button
            type="button"
            className={`${pill} ${pillOff}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(new URL(href(data.window.at), window.location.origin).href);
                setShare('已複製目前日期與條件的連結');
              } catch {
                setShare('請直接複製瀏覽器網址分享');
              }
            }}
          >
            分享這個畫面
          </button>
        </div>
        {share && (
          <p role="status" className={note}>
            {share}
          </p>
        )}
        <form action="/tracking/" className="flex flex-wrap items-end gap-3">
          {scopeInputs}
          <label className={formLabel}>
            開始日期
            <input type="date" name="from" defaultValue={data.window.from} max={data.window.to} required className={formInput} />
          </label>
          <label className={formLabel}>
            結束日期
            <input
              type="date"
              name="to"
              defaultValue={data.window.to}
              max={new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)}
              required
              className={formInput}
            />
          </label>
          <button type="submit" className={formSubmit}>
            更新範圍
          </button>
          <span className={note}>最多 366 天 · 日期皆為台北時間</span>
        </form>
        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <h3 className="text-sm font-medium">{data.window.at < data.window.to ? '回看當時的報導' : '目前觀察範圍'}</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            統計與事件只顯示至 <strong>{data.window.at}</strong>
            {data.window.at === new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) ? ' 目前' : ' 當日結束'}。
          </p>
          <form action="/tracking/" className="mt-3 flex flex-wrap items-end gap-3">
            {scopeInputs}
            <input type="hidden" name="from" value={data.window.from} />
            <input type="hidden" name="to" value={data.window.to} />
            <label className={formLabel}>
              回看日期
              <input
                type="date"
                name="at"
                value={cutoff}
                onChange={(e) => setCutoff(e.target.value)}
                min={data.window.from}
                max={data.window.to}
                required
                className={formInput}
              />
            </label>
            <button type="submit" className={formSubmit}>
              回看到這一天
            </button>
            {data.window.at < data.window.to && (
              <Link href={href()} className={`${link} py-2 text-sm`}>
                回到範圍末日 →
              </Link>
            )}
          </form>
        </div>
      </section>
      <StatTiles
        tiles={[
          { label: '符合條件的報導', value: `${format(data.totals.articles)} 篇` },
          { label: '收錄來源', value: `${format(data.totals.media)} 個` },
          { label: '獨立事件', value: `${format(data.totals.events)} 段` },
          { label: '有報導的日期', value: `${format(data.days.filter((d) => (d.articles ?? 0) > 0).length)} 天` },
        ]}
      />
      <section className="space-y-3">
        <SectionTitle id="trend" note="各期符合條件的報導篇數；點選長條回看到該期末日。回看日以後留空。">
          報導量變化
        </SectionTitle>
        <TabButtons
          label="圖表時間單位"
          options={[
            ['day', '日'],
            ['week', '週'],
            ['month', '月'],
          ]}
          value={span}
          onChange={setSpan}
        />
        <div className={card}>
          <DeferredChart className="h-96 w-full" label="符合條件的報導篇數趨勢">
            <TrendChart
              days={chartDays}
              lines={lines}
              bars={chartBars}
              label="符合條件的報導篇數趨勢"
              unit="報導篇數"
              scale="count"
              barLabel="符合條件的報導"
              onSelect={selectBin}
            />
          </DeferredChart>
          <p className={note}>
            {data.window.from} — {data.window.to} · 截至 {data.window.at}
          </p>
        </div>
        {!data.totals.articles && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">這個範圍尚無符合條件的收錄報導。可減少搭配詞或調整日期。</p>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">查看各期數字與回看</summary>
          <TableScroller card label="各期報導篇數與回看日期" className="mt-3">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className={table.cell}>日期</th>
                  <th className={table.num}>報導篇數</th>
                  <th className={table.cell}>回看</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {bins.map((bin) => (
                  <tr key={bin.from} className={table.row}>
                    <th scope="row" className={`${table.cell} text-left font-normal`}>
                      {bin.from}
                      {bin.to !== bin.from && <> — {bin.to}</>}
                    </th>
                    <td className={table.num}>{bin.total === null ? '尚未回看' : format(bin.total)}</td>
                    <td className={table.cell}>
                      {bin.total !== null && (
                        <Link href={href(bin.to > data.window.at ? data.window.at : bin.to)} scroll={false} className={link}>
                          回看到期末
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroller>
        </details>
      </section>
      <section className="space-y-3" aria-label="不同日期的獨立事件">
        <SectionTitle id="events" note="保留原有事件編號；須有同一小時的主要標籤符合條件才列入，不將整段事件的文章算進上方篇數。">
          同一觀察裡的不同事件
        </SectionTitle>
        {!data.events.length ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">此範圍沒有符合條件的事件快照。仍可由逐日統計與下方報導觀察。</p>
        ) : (
          <TableScroller card label="不同事件的日期與標題，可左右捲動">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className={table.leadHead}>符合日期</th>
                  <th className={table.cell}>事件</th>
                  <th className={table.num}>符合小時</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.events.map((event, index) => {
                  const older = data.events[index + 1];
                  const gap = older ? Math.floor((Date.parse(event.firstAt) - Date.parse(older.lastAt)) / 86400000) : 0;
                  return (
                    <tr key={event.id} className={table.row} data-observation-event={event.id}>
                      <th scope="row" className={`${table.lead} text-left font-normal`}>
                        <div className={table.leadBox}>
                          <p className="whitespace-nowrap tabular-nums">{taipeiDate(event.firstAt)}</p>
                          <p className={note}>至 {taipeiDate(event.lastAt)}</p>
                          <Link href={href(taipeiDate(event.lastAt))} scroll={false} className={`${link} whitespace-nowrap text-xs`}>
                            回看到這段事件
                          </Link>
                        </div>
                      </th>
                      <td className={table.cell}>
                        <h3 className="font-medium">
                          <Link prefetch={false} href={`/eve/${event.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
                            {event.headline?.title ?? event.tags.join('、')}
                          </Link>
                        </h3>
                        <p className={`mt-1 ${note}`}>
                          事件 #{event.id}
                          {gap > 3 && <> · 與前段相隔 {gap} 天</>}
                        </p>
                        <ul aria-label="事件標籤" className="mt-1 flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {event.tags.map((tag) => (
                            <li key={tag}>
                              <Link
                                prefetch={false}
                                href={`/tag/${encodeURIComponent(tag)}/`}
                                className="hover:text-brand-700 dark:hover:text-brand-400"
                              >
                                #{tag}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className={table.num}>{event.matchedHours}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroller>
        )}
        <p className={note}>
          事件頁會顯示該事件的完整歷程。事件快照起於 {data.eventHistoryFrom ? taipeiDate(data.eventHistoryFrom) : '尚無資料'}。
        </p>
      </section>
      <section className="space-y-3">
        <SectionTitle id="outlets" note="顯示篇數最多的 20 個來源；JSON 含全部來源。零筆表示收錄中沒有命中，不代表該媒體沒有報導。">
          哪些來源持續報導？
        </SectionTitle>
        <TableScroller card label="各來源逐月報導篇數，可左右捲動">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-right text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className={`${table.leadHead} text-left`}>收錄來源</th>
                <th className={table.num}>合計</th>
                {months.map((month) => (
                  <th className={table.num} key={month}>
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.outlets.slice(0, 20).map((outlet) => (
                <tr key={outlet.media} className={table.row}>
                  <th scope="row" className={`${table.lead} text-left font-normal`}>
                    <div className={table.leadBox}>
                      <MediaHoverLink media={outlet.media} className={`${link} ${table.leadText}`}>
                        {outlet.title}
                      </MediaHoverLink>
                    </div>
                  </th>
                  <td className={table.num}>{format(outlet.articles)}</td>
                  {months.map((month) => {
                    const future = `${month}-01` > data.window.at;
                    const count = Object.entries(outlet.days)
                      .filter(([day]) => day.startsWith(month))
                      .reduce((n, [, count]) => n + count, 0);
                    return (
                      <td key={month} className={table.num}>
                        {future ? '—' : format(count)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
      </section>
      <section className="space-y-3">
        <SectionTitle id="articles" note="依刊登時間排序，最多列出 60 篇。同一文章編號只計一次，轉載稿仍各自計數。">
          截至回看日的最新報導
        </SectionTitle>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {data.recent.map((a) => (
            <ArticleListItem
              key={a.id}
              showMedia
              href={`/article/${a.id}/`}
              article={{
                ...a,
                mediaTitle: data.outlets.find((o) => o.media === a.media)?.title ?? a.media,
                image: null,
                url: null,
                authors: [],
              }}
            />
          ))}
        </ul>
      </section>
      <p className={note}>
        資料更新：{taipei(data.generatedAt)} ·{' '}
        <a
          className={link}
          href={`/api/v1/observations?${new URLSearchParams({ ...Object.fromEntries(observationQuery(data.scope)), from: data.window.from, to: data.window.to, at: data.window.at })}`}
        >
          下載本次 JSON 資料
        </a>{' '}
        · <MethodLink />
      </p>
    </>
  );
}
