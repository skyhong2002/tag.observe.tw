import Link from 'next/link';
import MediaTabs from '@/components/MediaTabs';
import SafeImage from '@/components/SafeImage';
import { API_ORIGIN, taipei } from '@/lib/api';

export const revalidate = 120;
export const metadata = { title: '媒體與文章數' };

type Status = 'ok' | 'stale' | 'failing' | 'disabled';
type Camp = 'blue' | 'green' | 'other';
const CAMPS: Record<Exclude<Camp, 'other'>, { label: string; short: string; badge: string }> = {
  blue: {
    label: '藍營傾向',
    short: '偏藍',
    badge: 'bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800',
  },
  green: {
    label: '綠營傾向',
    short: '偏綠',
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800',
  },
};
interface MediaRow {
  media: string;
  title: string;
  icon: string | null;
  category: string | null;
  categoryLabel: string | null;
  camp: Camp;
  schedule: string;
  today: number;
  last24h: number;
  last7d: number;
  collectingSince: string | null;
  pendingDate: number;
  taggedShare24h: number | null;
  lastArticle: string | null;
  lastCrawlOk: string | null;
  status: Status;
}
interface Stats {
  generatedAt: string;
  todayStart: string;
  totals: {
    today: number;
    last24h: number;
    publishingMedia24h: number;
    activeSources: number;
    disabledSources: number;
    pendingDate: number;
    taggedShare24h: number | null;
    statusCounts: Record<Status, number>;
  };
  media: MediaRow[];
}

// Status palette is reserved for state; every status also has an icon and a label.
const STATUS: Record<Status, { label: string; color: string; path: string }> = {
  ok: { label: '正常', color: '#0ca30c', path: 'M5 10.5l3 3 7-7' },
  stale: { label: '無近期文章', color: '#b7860b', path: 'M10 5v5l3 2' },
  failing: { label: '抓取失敗', color: '#d03b3b', path: 'M6 6l8 8M14 6l-8 8' },
  disabled: { label: '未啟用', color: '#71717a', path: 'M6 10h8' },
};
const STATUS_ORDER: Status[] = ['ok', 'stale', 'failing', 'disabled'];
// Every column header sorts; numbers start descending, text ascending.
const collator = new Intl.Collator('zh-Hant-TW-u-co-stroke');
const SORTS = {
  name: (r: MediaRow) => r.title,
  today: (r: MediaRow) => r.today,
  last24h: (r: MediaRow) => r.last24h,
  last7d: (r: MediaRow) => r.last7d,
  tagged: (r: MediaRow) => r.taggedShare24h ?? -1,
  latest: (r: MediaRow) => (r.lastArticle ? Date.parse(r.lastArticle) : 0),
  status: (r: MediaRow) => STATUS_ORDER.indexOf(r.status),
} satisfies Record<string, (r: MediaRow) => number | string>;
type SortKey = keyof typeof SORTS;
const ASC_FIRST = new Set<SortKey>(['name', 'status']);

// Tolerates a cached response from before the API returned `camp`.
const campBadge = (r: MediaRow) => (r.camp === 'blue' || r.camp === 'green' ? CAMPS[r.camp] : null);

function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-zinc-700 dark:text-zinc-300">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="none" stroke={s.color} strokeWidth="2" />
        <path d={s.path} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
      </svg>
      {s.label}
    </span>
  );
}

// Until our crawler has run for a week, 7-day totals are the days since it
// started plus whatever backlog the first listing still carried.
function SevenDayCell({ value, since, partial }: { value: number; since: string | null; partial: boolean }) {
  const md = since
    ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' }).format(new Date(since))
    : null;
  return (
    <td
      className={`px-3 py-2 text-right tabular-nums ${partial ? 'text-zinc-500 dark:text-zinc-500' : 'text-zinc-600'}`}
      title={partial && md ? `新系統 ${md} 才開始抓這家媒體，還不滿 7 天` : undefined}
    >
      {value.toLocaleString()}
      {partial && md && <div className="text-[11px] leading-tight">{md} 起抓取</div>}
    </td>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {note && <div className="mt-1 text-xs text-zinc-600">{note}</div>}
    </div>
  );
}

export default async function MediaStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; status?: string; category?: string; camp?: string }>;
}) {
  const sp = await searchParams;
  const res = await fetch(`${API_ORIGIN}/api/v1/media-stats`, { next: { revalidate } }).catch(() => null);
  if (!res?.ok)
    return (
      <>
        <MediaTabs current="media" />
        <p className="text-zinc-600">媒體統計目前無法取得。</p>
      </>
    );
  const data = (await res.json()) as Stats;
  const sort: SortKey = (sp.sort && sp.sort in SORTS ? sp.sort : 'last24h') as SortKey;
  const dir = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : ASC_FIRST.has(sort) ? 'asc' : 'desc';
  const status = sp.status && sp.status in STATUS ? (sp.status as Status) : null;
  const category = sp.category ?? null;
  const camp = sp.camp && sp.camp in CAMPS ? (sp.camp as keyof typeof CAMPS) : null;
  const categories = [
    ...new Map(data.media.filter((m) => m.category).map((m) => [m.category as string, m.categoryLabel ?? m.category])).entries(),
  ];
  let rows = data.media.filter(
    (m) => (!status || m.status === status) && (!category || m.category === category) && (!camp || m.camp === camp),
  );
  rows = [...rows].sort((a, b) => {
    const x = SORTS[sort](a),
      y = SORTS[sort](b);
    const c = typeof x === 'string' ? collator.compare(x, y as string) : x - (y as number);
    return (dir === 'asc' ? c : -c) || b.last24h - a.last24h || a.media.localeCompare(b.media);
  });
  const max = Math.max(1, ...rows.map((r) => r.last24h));
  const link = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const next = { sort, dir, status, category, camp, ...patch };
    const isDefault = next.sort === 'last24h' && next.dir === 'desc';
    for (const [k, v] of Object.entries(next)) if (v && !(isDefault && (k === 'sort' || k === 'dir'))) q.set(k, v);
    const s = q.toString();
    return s ? `/media/?${s}` : '/media/';
  };
  const t = data.totals;
  const weekAgo = new Date(data.generatedAt).getTime() - 7 * 86400e3;
  const partialWeek = (r: MediaRow) => r.collectingSince != null && new Date(r.collectingSince).getTime() > weekAgo;
  const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`);
  const sortLink = (col: SortKey) =>
    link({ sort: col, dir: sort === col ? (dir === 'asc' ? 'desc' : 'asc') : ASC_FIRST.has(col) ? 'asc' : 'desc' });
  const Th = ({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) => (
    <th className={`px-3 py-2 ${className}`} aria-sort={sort === col ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <Link
        href={sortLink(col)}
        scroll={false}
        className={`inline-flex items-center gap-0.5 whitespace-nowrap hover:text-brand-700 ${sort === col ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
      >
        {label}
        <span aria-hidden className={sort === col ? '' : 'invisible'}>
          {dir === 'asc' ? '▲' : '▼'}
        </span>
      </Link>
    </th>
  );
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1 ${active ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`;

  return (
    <div className="space-y-5">
      <MediaTabs current="media" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">媒體與文章數</h1>
        <p className="mt-1 text-sm text-zinc-600">
          列出所有已登錄媒體，包含尚未啟用抓取與僅作為引用來源的媒體。「今日」從台北時間 00:00 起算。更新於 {taipei(data.generatedAt)}。
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="今日文章" value={t.today.toLocaleString()} />
        <Tile
          label="24 小時文章"
          value={t.last24h.toLocaleString()}
          note={t.pendingDate ? `另 ${t.pendingDate.toLocaleString()} 篇發布時間待確認` : undefined}
        />
        <Tile
          label="24 小時有發稿的媒體"
          value={`${t.publishingMedia24h}`}
          note={`追蹤中 ${t.activeSources} 家，未啟用 ${t.disabledSources} 家`}
        />
        <Tile label="有標籤的文章" value={pct(t.taggedShare24h)} note="24 小時內" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link href={link({ status: null })} scroll={false} className={chip(!status)}>
          全部狀態
        </Link>
        {(Object.keys(STATUS) as Status[]).map((s) => (
          <Link key={s} href={link({ status: s })} scroll={false} className={chip(status === s)}>
            {STATUS[s].label} {t.statusCounts[s] ?? 0}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
        <Link href={link({ category: null })} scroll={false} className={chip(!category)}>
          全部分類
        </Link>
        {categories.map(([key, label]) => (
          <Link key={key} href={link({ category: key })} scroll={false} className={chip(category === key)}>
            {label}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
        <Link href={link({ camp: null })} scroll={false} className={chip(!camp)}>
          全部傾向
        </Link>
        {(Object.keys(CAMPS) as Array<keyof typeof CAMPS>).map((c) => (
          <Link key={c} href={link({ camp: c })} scroll={false} className={chip(camp === c)}>
            {CAMPS[c].label} {data.media.filter((m) => m.camp === c).length}
          </Link>
        ))}
      </div>
      <p className="text-xs text-zinc-600">
        藍綠標示沿用本站媒體分類，依媒體集團與一般認知歸類，用於首頁新聞量與事件頁的藍綠對照；未標示不代表中立。
      </p>
      <div className="overflow-x-auto rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-600 dark:bg-zinc-950">
            <tr>
              <Th col="name" label="媒體" className="sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-950" />
              <Th col="today" label="今日" className="text-right" />
              <Th col="last24h" label="24 小時" className="w-[32%] min-w-40" />
              <Th col="last7d" label="7 天" className="text-right" />
              <Th col="tagged" label="標籤率" className="text-right" />
              <Th col="latest" label="最新文章" />
              <Th col="status" label="狀態" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((r) => (
              <tr key={r.media} className="group hover:bg-brand-50/60 dark:hover:bg-zinc-800/60">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 group-hover:bg-brand-50 dark:bg-zinc-900 dark:group-hover:bg-zinc-800">
                  <Link href={`/media/${r.media}/`} className="flex items-center gap-2 font-medium hover:underline">
                    <SafeImage src={r.icon} alt="" width={16} height={16} className="rounded-sm" />
                    <span className="whitespace-nowrap">{r.title}</span>
                    {campBadge(r) && (
                      <span
                        className={`shrink-0 whitespace-nowrap rounded px-1.5 py-px text-[11px] font-medium ring-1 ring-inset ${campBadge(r)?.badge}`}
                      >
                        {campBadge(r)?.short}
                      </span>
                    )}
                  </Link>
                  <div className="text-xs text-zinc-600">
                    {r.categoryLabel ?? '—'} · {r.schedule === 'hourly' ? '每小時' : '每 9 分鐘'}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.today.toLocaleString()}</td>
                <td
                  className="px-3 py-2"
                  title={`${r.title}：24 小時 ${r.last24h.toLocaleString()} 篇${r.pendingDate ? `，另 ${r.pendingDate} 篇發布時間待確認` : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1" aria-hidden>
                      {r.last24h > 0 && (
                        <div
                          className="h-2 rounded-r bg-brand-700 dark:bg-brand-600"
                          style={{ width: `${Math.max(1.5, (r.last24h / max) * 100)}%` }}
                        />
                      )}
                    </div>
                    <span className="w-14 text-right tabular-nums">{r.last24h.toLocaleString()}</span>
                  </div>
                </td>
                <SevenDayCell value={r.last7d} since={r.collectingSince} partial={partialWeek(r)} />
                <td className="px-3 py-2 text-right tabular-nums text-zinc-600">{pct(r.taggedShare24h)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-600">{r.lastArticle ? taipei(r.lastArticle) : '—'}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-600">
        狀態：正常＝最近有新文章；無近期文章＝新聞類 6 小時、其他 24 小時內沒有新文章（來源可能暫停發稿）；抓取失敗＝近 3
        小時的抓取全部失敗；未啟用＝尚未啟用定期抓取、已停用或僅作為引用來源。文章數以發布時間計；列表沒有提供發布時間的文章，會在抓取內文後才計入。7
        天欄標「只有 N 天」的媒體，是新系統開始抓它還不滿一週，數字只涵蓋那幾天，不能和其他媒體直接比較。
      </p>
    </div>
  );
}
