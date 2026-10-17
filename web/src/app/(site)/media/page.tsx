import Link from 'next/link';
import CountryFlag from '@/components/CountryFlag';
import FilterChips from '@/components/FilterChips';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import MethodLink from '@/components/MethodLink';
import SectionTabs from '@/components/SectionTabs';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import { API_ORIGIN, taipei } from '@/lib/api';
import { trafficNumber } from '@/lib/media-traffic.mts';
import { pageMetadata } from '@/lib/seo.mts';
import { table } from '@/lib/table-styles';
import { shortMonth, type TaiwanReaders } from '@/lib/traffic-comparison.mts';
import { loadTaiwanReaders } from './traffic/load';

export const revalidate = 120;
export const metadata = pageMetadata(
  '/media/',
  '媒體與文章數',
  '查看本站追蹤的新聞媒體、近期收錄篇數與更新狀態，進入各媒體頁探索報導、關鍵字及媒體關係。',
  true,
);

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
// Readership of the collected edition (app/data/media-scope.json), in the
// order the filter lists them.
const SCOPE_ORDER = ['tw', 'tw-gov', 'tw-foreign', 'intl-zh', 'hkmo', 'sgmy', 'overseas-zh', 'zh-special', 'cn', 'foreign'];
interface MediaScope {
  scope: string;
  scopeLabel: string;
  language: string;
  languageLabel: string;
  roles: Array<{ role: string; label: string }>;
  coverage: string | null;
}
const discoveryBadge =
  'shrink-0 whitespace-nowrap rounded bg-amber-50 px-1.5 py-px text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800';
const scopeBadge =
  'shrink-0 whitespace-nowrap rounded bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700';
interface MediaRow {
  media: string;
  sourceKind?: 'discovery' | 'publisher';
  title: string;
  country: string;
  countryCode: string;
  scope?: MediaScope | null;
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
  /** Joined from /media/traffic/'s load, not part of /api/v1/media-stats. */
  readers?: TaiwanReaders;
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
  // An upper bound (Taiwan outside the top five) does not rank, as on /media/traffic/.
  readers: (r: MediaRow) => (r.readers && !r.readers.below ? r.readers.visits : -1),
  perArticle: (r: MediaRow) => (r.readers?.perArticle && !r.readers.below ? r.readers.perArticle.visits : -1),
  latest: (r: MediaRow) => (r.lastArticle ? Date.parse(r.lastArticle) : 0),
  status: (r: MediaRow) => STATUS_ORDER.indexOf(r.status),
  // Unknown values sort after every known one.
  scope: (r: MediaRow) => (r.scope ? SCOPE_ORDER.indexOf(r.scope.scope) : SCOPE_ORDER.length) * 1000 + (r.countryCode.codePointAt(0) ?? 0),
  language: (r: MediaRow) => r.scope?.languageLabel ?? '\uffff',
  camp: (r: MediaRow) => CAMP_ORDER.indexOf(r.camp),
  category: (r: MediaRow) => r.categoryLabel ?? '\uffff',
  roles: (r: MediaRow) => roleLabels(r) || '\uffff',
  schedule: (r: MediaRow) => scheduleMinutes(r.schedule),
} satisfies Record<string, (r: MediaRow) => number | string>;
type SortKey = keyof typeof SORTS;
const ASC_FIRST = new Set<SortKey>(['name', 'status', 'scope', 'language', 'camp', 'category', 'roles', 'schedule']);
const CAMP_ORDER: Camp[] = ['blue', 'green', 'other'];
const roleLabels = (r: MediaRow) => r.scope?.roles.map(({ label }) => label).join('、') ?? '';
/** `off`, `hourly` or `every N min` (app/src/crawl schedules); off sorts last. */
function scheduleMinutes(schedule: string) {
  if (schedule === 'hourly') return 60;
  const every = /^every (\d+) min$/.exec(schedule);
  return every ? Number(every[1]) : Number.POSITIVE_INFINITY;
}
function scheduleLabel(schedule: string) {
  const minutes = scheduleMinutes(schedule);
  if (!Number.isFinite(minutes)) return schedule === 'off' ? '未啟用' : schedule;
  if (minutes === 60) return '每小時';
  return minutes % 60 === 0 ? `每 ${minutes / 60} 小時` : `每 ${minutes} 分鐘`;
}

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
      className={`${table.num} whitespace-nowrap ${partial ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-600 dark:text-zinc-300'}`}
      title={partial && md ? `新系統 ${md} 才開始抓這家媒體，還不滿 7 天` : undefined}
    >
      {value.toLocaleString()}
      {partial && md && <span className="ml-1 text-[11px]">（{md} 起）</span>}
    </td>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-600 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {note && <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{note}</div>}
    </div>
  );
}

export default async function MediaStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; status?: string; category?: string; camp?: string; scope?: string }>;
}) {
  const sp = await searchParams;
  const [res, readers] = await Promise.all([
    fetch(`${API_ORIGIN}/api/v1/media-stats`, { next: { revalidate } }).catch(() => null),
    loadTaiwanReaders().catch(() => ({}) as Record<string, TaiwanReaders>),
  ]);
  if (!res?.ok)
    return (
      <>
        <SectionTabs here="/media/" />
        <p className="text-zinc-600 dark:text-zinc-400">媒體統計目前無法取得。</p>
      </>
    );
  const data = (await res.json()) as Stats;
  const sort: SortKey = (sp.sort && sp.sort in SORTS ? sp.sort : 'last24h') as SortKey;
  const dir = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : ASC_FIRST.has(sort) ? 'asc' : 'desc';
  const status = sp.status && sp.status in STATUS ? (sp.status as Status) : null;
  const category = sp.category ?? null;
  const camp = sp.camp && sp.camp in CAMPS ? (sp.camp as keyof typeof CAMPS) : null;
  const scopes = [...new Map(data.media.flatMap((m) => (m.scope ? [[m.scope.scope, m.scope.scopeLabel] as const] : []))).entries()].sort(
    ([a], [b]) => SCOPE_ORDER.indexOf(a) - SCOPE_ORDER.indexOf(b),
  );
  const scope = scopes.some(([key]) => key === sp.scope) ? (sp.scope as string) : null;
  const categories = [
    ...new Map(data.media.filter((m) => m.category).map((m) => [m.category as string, m.categoryLabel ?? m.category])).entries(),
  ];
  let rows = data.media
    .map((m) => ({ ...m, readers: readers[m.media] }))
    .filter(
      (m) =>
        (!status || m.status === status) &&
        (!category || m.category === category) &&
        (!camp || m.camp === camp) &&
        (!scope || m.scope?.scope === scope),
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
    const next = { sort, dir, status, category, camp, scope, ...patch };
    const isDefault = next.sort === 'last24h' && next.dir === 'desc';
    for (const [k, v] of Object.entries(next)) if (v && !(isDefault && (k === 'sort' || k === 'dir'))) q.set(k, v);
    const s = q.toString();
    return s ? `/media/?${s}` : '/media/';
  };
  const t = data.totals;
  const readersMonth = Object.values(readers)[0]?.month;
  const weekAgo = new Date(data.generatedAt).getTime() - 7 * 86400e3;
  const partialWeek = (r: MediaRow) => r.collectingSince != null && new Date(r.collectingSince).getTime() > weekAgo;
  const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`);
  const sortLink = (col: SortKey) =>
    link({ sort: col, dir: sort === col ? (dir === 'asc' ? 'desc' : 'asc') : ASC_FIRST.has(col) ? 'asc' : 'desc' });
  const Th = ({ col, label, className = '', title }: { col: SortKey; label: string; className?: string; title?: string }) => (
    <th
      className={`${table.cell} ${className}`}
      title={title}
      aria-sort={sort === col ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <Link
        href={sortLink(col)}
        scroll={false}
        className={`inline-flex items-center gap-0.5 whitespace-nowrap hover:text-brand-700 ${sort === col ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
      >
        {label}
        <SortIndicator active={sort === col} descending={dir === 'desc'} />
      </Link>
    </th>
  );

  return (
    <div className="space-y-5">
      <SectionTabs here="/media/" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">媒體與文章數</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          更新於 {taipei(data.generatedAt)} · <MethodLink />
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
      <div className="space-y-2">
        <FilterChips
          label="收錄狀態"
          items={[
            { href: link({ status: null }), label: '全部狀態', current: !status },
            ...(Object.keys(STATUS) as Status[]).map((s) => ({
              href: link({ status: s }),
              label: `${STATUS[s].label} ${t.statusCounts[s] ?? 0}`,
              current: status === s,
            })),
          ]}
        />
        <FilterChips
          label="媒體分類"
          items={[
            { href: link({ category: null }), label: '全部分類', current: !category },
            ...categories.map(([key, label]) => ({ href: link({ category: key }), label: label ?? key, current: category === key })),
          ]}
        />
        <FilterChips
          label="媒體傾向"
          items={[
            { href: link({ camp: null }), label: '全部傾向', current: !camp },
            ...(Object.keys(CAMPS) as Array<keyof typeof CAMPS>).map((c) => ({
              href: link({ camp: c }),
              label: `${CAMPS[c].label} ${data.media.filter((m) => m.camp === c).length}`,
              current: camp === c,
            })),
          ]}
        />
        <FilterChips
          label="報導範圍"
          items={[
            { href: link({ scope: null }), label: '全部範圍', current: !scope },
            ...scopes.map(([key, label]) => ({
              href: link({ scope: key }),
              label: `${label} ${data.media.filter((m) => m.scope?.scope === key).length}`,
              current: scope === key,
            })),
          ]}
        />
      </div>
      <TableScroller card label="媒體與文章數表格，可左右捲動">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
            <tr>
              <Th col="name" label="媒體" className={table.leadHead} />
              <Th col="scope" label="範圍" />
              <Th col="camp" label="傾向" />
              <Th col="today" label="今日" className="text-right" />
              <Th col="last24h" label="24 小時" className="min-w-36" />
              <Th col="last7d" label="7 天" className="text-right" />
              <Th
                col="readers"
                label="台灣月造訪"
                className="text-right"
                title={`Similarweb ${readersMonth ? shortMonth(readersMonth) : '最新一期'} 月造訪次數 × 台灣占比（估算）`}
              />
              <Th
                col="perArticle"
                label="每篇分攤造訪"
                className="text-right"
                title="台灣月造訪 ÷ 當月發稿量（news sitemap 與本站收錄取大者）；含首頁與舊文，是指數不是讀者數"
              />
              <Th col="category" label="分類" />
              <Th col="language" label="語言" />
              <Th col="roles" label="性質" />
              <Th col="tagged" label="標籤率" className="text-right" />
              <Th col="latest" label="最新文章" />
              <Th col="schedule" label="抓取" />
              <Th col="status" label="狀態" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((r) => (
              <tr key={r.media} className={table.row}>
                <td className={table.lead}>
                  <div className={table.leadBox}>
                    <MediaHoverLink
                      media={r.media}
                      icon={false}
                      title={r.title}
                      className="flex min-w-0 items-center gap-2 whitespace-nowrap font-medium hover:underline"
                    >
                      <MediaIcon media={r.media} size={16} />
                      <span className={table.leadText}>{r.title}</span>
                    </MediaHoverLink>
                  </div>
                </td>
                <td className={`${table.cell} whitespace-nowrap`} title={r.scope?.coverage ?? r.country}>
                  <span className="inline-flex items-center gap-1.5">
                    <CountryFlag code={r.countryCode} country={r.country} />
                    {r.scope?.scopeLabel ?? r.country}
                  </span>
                </td>
                <td className={`${table.cell} whitespace-nowrap`}>
                  {campBadge(r) ? (
                    <span
                      className={`whitespace-nowrap rounded px-1.5 py-px text-[11px] font-medium ring-1 ring-inset ${campBadge(r)?.badge}`}
                    >
                      {campBadge(r)?.short}
                    </span>
                  ) : (
                    <span className="text-zinc-500 dark:text-zinc-400">—</span>
                  )}
                </td>
                <td className={table.num}>{r.today.toLocaleString()}</td>
                <td
                  className={table.cell}
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
                <td
                  className={`${table.num} whitespace-nowrap ${r.readers?.below ? 'text-zinc-500 dark:text-zinc-400' : ''}`}
                  title={r.readers?.title}
                >
                  {r.readers ? `${r.readers.below ? '< ' : ''}${trafficNumber(r.readers.visits)}` : '—'}
                </td>
                <td
                  className={`${table.num} whitespace-nowrap ${r.readers?.below ? 'text-zinc-500 dark:text-zinc-400' : ''}`}
                  title={r.readers?.perArticle?.title ?? r.readers?.perArticleNote}
                >
                  {r.readers?.perArticle ? `${r.readers.below ? '< ' : ''}${trafficNumber(r.readers.perArticle.visits)}` : '—'}
                </td>
                <td className={`${table.cell} whitespace-nowrap`}>{r.categoryLabel ?? '—'}</td>
                <td className={`${table.cell} whitespace-nowrap`}>{r.scope?.languageLabel ?? '—'}</td>
                <td className={`${table.cell} whitespace-nowrap`}>
                  {r.scope?.roles.length ? (
                    <span className="flex gap-1">
                      {r.scope.roles.map(({ role, label }) => (
                        <span key={role} className={role === 'discovery' ? discoveryBadge : scopeBadge}>
                          {label}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-zinc-500 dark:text-zinc-400">—</span>
                  )}
                </td>
                <td className={`${table.num} text-zinc-600 dark:text-zinc-400`}>{pct(r.taggedShare24h)}</td>
                <td className={`${table.cell} whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400`}>
                  {r.lastArticle ? taipei(r.lastArticle) : '—'}
                </td>
                <td className={`${table.cell} whitespace-nowrap text-zinc-600 dark:text-zinc-400`}>{scheduleLabel(r.schedule)}</td>
                <td className={table.cell}>
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroller>
    </div>
  );
}
