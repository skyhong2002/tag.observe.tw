'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import FilterButtons from '@/components/FilterButtons';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import { table } from '@/lib/table-styles';
import { adminFetch, note } from '../AdminGate';
import { type Definition, LabelChip, type Outlet, OutletIcon, ROBOTS, robotsLabel, TRIGGERS } from './labels';

// A bookmark that opens /admin/media/ for whatever news page is showing.
export function Bookmarklet() {
  const link = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const source = `javascript:location.href='${location.origin}/admin/media/?url='+encodeURIComponent(location.href)`;
    // React refuses javascript: hrefs, so set it on the element directly.
    link.current?.setAttribute('href', source);
    setCode(source);
  }, []);
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">從新聞網站直接設定</h2>
      <p className={note}>
        把下面的按鈕拖到 Chrome
        的書籤列。之後在任何新聞網站的文章頁按這個書籤，就會跳到這家媒體的設定頁，可以調整標籤（藍營、綠營、新聞、非主流…）、重抓這篇文章或馬上跑爬蟲。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          ref={link}
          href="/admin/media/"
          onClick={(event) => event.preventDefault()}
          className="inline-flex min-h-9 cursor-grab items-center rounded-full bg-brand-700 px-4 text-sm font-medium text-white shadow-sm"
        >
          設定這家媒體
        </a>
        <button
          type="button"
          disabled={!code}
          onClick={() => navigator.clipboard.writeText(code).then(() => setCopied(true))}
          className="min-h-9 rounded-full border border-zinc-300 px-3 text-sm hover:border-brand-600 dark:border-zinc-700"
        >
          {copied ? '已複製' : '複製書籤網址'}
        </button>
      </div>
      <details className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        <summary className="cursor-pointer">沒辦法拖曳？手動加入</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>按「複製書籤網址」。</li>
          <li>在 Chrome 書籤列按右鍵 →「新增網頁…」。</li>
          <li>名稱填「設定這家媒體」，網址欄貼上剛才複製的內容，儲存。</li>
        </ol>
      </details>
    </section>
  );
}

// Crawl figures come from the public /api/v1/media-stats; outlets only in the
// favicon catalog (never crawled) have none and read 未收錄.
type Status = 'ok' | 'stale' | 'failing' | 'disabled';
type Stats = { status: Status; last7d: number; taggedShare24h: number | null; lastArticle: string | null };
type Row = Outlet & { stats: Stats | null };
type SortKey = 'title' | 'status' | 'last7d' | 'tagged' | 'lastArticle' | 'robots' | 'rules' | 'edits' | 'lastEdit';

const STATUS: Record<Status | 'none', { label: string; color: string; path: string }> = {
  ok: { label: '正常', color: '#0ca30c', path: 'M5 10.5l3 3 7-7' },
  stale: { label: '無近期文章', color: '#b7860b', path: 'M10 5v5l3 2' },
  failing: { label: '抓取失敗', color: '#d03b3b', path: 'M6 6l8 8M14 6l-8 8' },
  disabled: { label: '未啟用', color: '#71717a', path: 'M6 10h8' },
  none: { label: '未收錄', color: '#a1a1aa', path: '' },
};
const STATUS_ORDER = ['ok', 'stale', 'failing', 'disabled', 'none'] as const;
const collator = new Intl.Collator('zh-Hant-TW-u-co-stroke');
// Short Taipei time (10/17 21:08); rendered after the fetch, so no hydration mismatch.
const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
    : '—';
const who = (email: string) => email.split('@')[0];

function StatusBadge({ status }: { status: Status | 'none' }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <circle
          cx="10"
          cy="10"
          r="9"
          fill="none"
          stroke={s.color}
          strokeWidth="2"
          strokeDasharray={status === 'none' ? '3 3' : undefined}
        />
        {s.path && <path d={s.path} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" />}
      </svg>
      {s.label}
    </span>
  );
}

// Every outlet as a table: its tags, how the crawler is doing, and who last
// changed its camp. Tags come from traffic.observe.tw and are managed there;
// only the camp (藍營／綠營) is edited here. Filters narrow by tag and crawl
// status; the name opens the editor.
export function Outlets() {
  const [data, setData] = useState<{ media: Outlet[]; categories: Definition[]; trafficSite?: string } | null>(null);
  const [stats, setStats] = useState<Map<string, Stats> | null>(null);
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<SortKey>('last7d');
  const [descending, setDescending] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    adminFetch<{ media: Outlet[]; categories: Definition[]; trafficSite?: string }>('/auth/admin/media')
      .then(setData)
      .catch((e: Error) => setError(e.message));
    fetch('/api/v1/media-stats')
      .then((r) => (r.ok ? r.json() : { media: [] }))
      .then((body: { media: Array<Stats & { media: string }> }) => setStats(new Map(body.media.map((m) => [m.media, m]))))
      .catch(() => setStats(new Map()));
  }, []);
  const labels = useMemo(() => new Map(data?.categories.map((d) => [d.key, d.label])), [data]);
  if (error) return <p className={note}>{error}</p>;
  if (!data) return <p className={note}>載入中…</p>;

  const rows: Row[] = data.media.map((o) => ({ ...o, stats: stats?.get(o.media) ?? null }));
  const statusOf = (r: Row) => r.stats?.status ?? 'none';
  // Camp keys filter as they are, traffic.observe.tw tags as `t:<tag>`.
  const keysOf = (r: Row) => [...r.categories, ...(r.tags ?? []).map((t) => `t:${t}`)];
  const tagCounts = new Map<string, number>();
  for (const t of rows.flatMap((r) => r.tags ?? [])) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tagList = [...tagCounts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'zh-Hant')).map(([t]) => t);
  const q = query.trim().toLowerCase();
  const matches = (r: Row, skip?: 'label' | 'status') =>
    (!q ||
      r.media.includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.categories.some((c) => labels.get(c)?.toLowerCase().includes(q)) ||
      r.tags?.some((t) => t.toLowerCase().includes(q))) &&
    (skip === 'label' || label === 'all' || (label === 'none' ? !keysOf(r).length : keysOf(r).includes(label))) &&
    (skip === 'status' || status === 'all' || statusOf(r) === status);
  // Each filter row counts what the other filters leave, so the numbers add up.
  const tally = (skip: 'label' | 'status', test: (r: Row) => boolean) => rows.filter((r) => matches(r, skip) && test(r)).length;
  const option = (key: string, text: string, skip: 'label' | 'status', test: (r: Row) => boolean) =>
    [key, `${text} ${tally(skip, test)}`] as const;
  const value = (r: Row): number | string => {
    if (sort === 'title') return r.title;
    if (sort === 'status') return STATUS_ORDER.indexOf(statusOf(r));
    if (sort === 'last7d') return r.stats?.last7d ?? -1;
    if (sort === 'tagged') return r.stats?.taggedShare24h ?? -1;
    if (sort === 'lastArticle') return r.stats?.lastArticle ? Date.parse(r.stats.lastArticle) : 0;
    if (sort === 'robots') return r.robots ? ROBOTS[r.robots.status].sort : -1;
    if (sort === 'rules') return r.generatedRules?.revision ?? 0;
    if (sort === 'edits') return r.edits?.count ?? 0;
    return r.edits ? Date.parse(r.edits.lastAt) : 0;
  };
  const shown = rows
    .filter((r) => matches(r))
    .sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const order = typeof x === 'string' ? collator.compare(x, y as string) : x - (y as number);
      return (descending ? -order : order) || collator.compare(a.title, b.title);
    });
  const sortBy = (key: SortKey) => {
    if (sort === key) setDescending(!descending);
    else {
      setSort(key);
      setDescending(key !== 'title' && key !== 'status' && key !== 'robots');
    }
  };
  const th = (key: SortKey, text: string, className: string, title?: string) => (
    <th
      key={key}
      aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'}
      className={`${className} !py-1.5 font-medium`}
      title={title}
    >
      <button
        type="button"
        onClick={() => sortBy(key)}
        className={`inline-flex items-center gap-0.5 whitespace-nowrap hover:text-brand-700 ${sort === key ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
      >
        {text}
        <SortIndicator active={sort === key} descending={descending} />
      </button>
    </th>
  );
  const plain = (text: string) => <th className={`${table.cell} !py-1.5 font-medium whitespace-nowrap`}>{text}</th>;
  const muted = 'text-zinc-400 dark:text-zinc-600';

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-lg font-semibold">所有媒體</h2>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜尋媒體名稱、代碼或標籤"
          className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <p className={note}>
        政治傾向（藍營、綠營）在這裡設定。其他標籤來自 traffic.observe.tw，這裡只顯示；要修改請到該媒體網域的 traffic.observe.tw
        網站頁投票或覆寫，或到{' '}
        <a href={`${data.trafficSite ?? 'https://traffic.observe.tw'}/sites/`} className="underline underline-offset-2">
          traffic.observe.tw 網站管理
        </a>
        批次修改。
      </p>
      <FilterButtons
        label="標籤"
        showLabel
        value={label}
        onChange={setLabel}
        options={[
          option('all', '全部', 'label', () => true),
          option('none', '沒有標籤', 'label', (r) => !keysOf(r).length),
          ...data.categories.map((d) => option(d.key, d.label, 'label', (r) => r.categories.includes(d.key))),
          ...tagList.map((t) => option(`t:${t}`, t, 'label', (r) => !!r.tags?.includes(t))),
        ]}
      />
      <FilterButtons
        label="收錄狀態"
        showLabel
        value={status}
        onChange={setStatus}
        options={[
          option('all', '全部', 'status', () => true),
          ...STATUS_ORDER.map((s) => option(s, STATUS[s].label, 'status', (r) => statusOf(r) === s)),
        ]}
      />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        顯示 {shown.length} / {rows.length} 家。點名稱打開這家媒體的設定。
      </p>
      <TableScroller card label="所有媒體，可左右捲動">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-600 dark:text-zinc-400">
            <tr className="bg-(--table-head-bg)">
              {th('title', '媒體', table.leadHead)}
              {plain('標籤')}
              {th('status', '收錄狀態', table.cell)}
              {th('last7d', '7 天文章', table.num)}
              {th('tagged', '標籤率', table.num, '近 24 小時有標籤的文章比例')}
              {th('lastArticle', '最新文章', table.cell)}
              {th('robots', 'robots.txt', table.cell, '主網域 robots.txt 最近一次讀到的內容；只記錄，爬蟲不遵守')}
              {th('rules', 'AI 規則', table.cell, '驗證通過、正在使用的 AI 產生爬取規則')}
              {th('edits', '修改', table.num, '本站標籤的修改次數：政治傾向，以及 2026-10-24 改用 traffic.observe.tw 之前的舊標籤')}
              {th('lastEdit', '最近修改', table.cell)}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {shown.map((r) => (
              <tr key={r.media} className={`${table.row} whitespace-nowrap`}>
                <th scope="row" className={`${table.lead} !py-1.5 text-left font-normal`} title={r.media}>
                  <Link href={`/admin/media/?media=${r.media}`} className={`${table.leadBox} flex items-center gap-2 hover:underline`}>
                    <OutletIcon outlet={r} />
                    <span className={`${table.leadText} font-medium`}>{r.title}</span>
                  </Link>
                </th>
                <td className={`${table.cell} !py-1.5`}>
                  <span className="flex gap-1">
                    {r.categories.map((c) => (
                      <LabelChip key={c} keyName={c} label={labels.get(c) ?? c} />
                    ))}
                    {r.tags?.map((t) => (
                      <LabelChip key={`t:${t}`} keyName={`t:${t}`} label={t} />
                    ))}
                    {!keysOf(r).length && <span className={`text-xs ${muted}`}>—</span>}
                  </span>
                </td>
                <td className={`${table.cell} !py-1.5`}>
                  {stats ? <StatusBadge status={statusOf(r)} /> : <span className={muted}>…</span>}
                </td>
                <td className={`${table.num} !py-1.5 ${r.stats?.last7d ? '' : muted}`}>
                  {r.stats ? r.stats.last7d.toLocaleString() : '—'}
                </td>
                <td className={`${table.num} !py-1.5 ${r.stats?.taggedShare24h == null ? muted : ''}`}>
                  {r.stats?.taggedShare24h == null ? '—' : `${Math.round(r.stats.taggedShare24h * 100)}%`}
                </td>
                <td className={`${table.cell} !py-1.5 tabular-nums ${r.stats?.lastArticle ? '' : muted}`}>
                  {when(r.stats?.lastArticle ?? null)}
                </td>
                <td
                  className={`${table.cell} !py-1.5 ${r.robots ? ROBOTS[r.robots.status].className : muted}`}
                  title={r.robots ? `${r.robots.host} · ${when(r.robots.checkedAt)} 讀取` : '尚未讀取'}
                >
                  {r.robots ? robotsLabel(r.robots) : '—'}
                </td>
                <td className={`${table.cell} !py-1.5 ${r.generatedRules ? '' : muted}`}>
                  {r.generatedRules ? `第 ${r.generatedRules.revision} 版 · ${TRIGGERS[r.generatedRules.trigger]}` : '—'}
                </td>
                <td className={`${table.num} !py-1.5 ${r.edits ? '' : muted}`}>{r.edits?.count ?? '—'}</td>
                <td className={`${table.cell} !py-1.5 tabular-nums ${r.edits ? '' : muted}`} title={r.edits?.lastBy}>
                  {r.edits ? `${when(r.edits.lastAt)} · ${who(r.edits.lastBy)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroller>
    </section>
  );
}
