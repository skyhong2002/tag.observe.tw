import Link from 'next/link';
import MediaIcons from '@/components/MediaIcons';
import PendingLabel from '@/components/PendingLabel';
import RankingBasisNote from '@/components/RankingBasisNote';
import Sparkline from '@/components/Sparkline';
import { fetchCategories, fetchMedia, fetchRanking, taipei, taipeiHour } from '@/lib/api';

export const revalidate = 60;
export const metadata = { title: '新聞關鍵字排行榜' };
type Search = { category?: string; order?: string; limit?: string; sort?: string; dir?: string };
type Col = 'tag' | 'burst' | 'score' | 'count' | 'trend' | 'media';
const COLS: Col[] = ['tag', 'burst', 'score', 'count', 'trend', 'media'];

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const category = sp.category ?? 'all';
  const order = sp.order === 'score' ? 'score' : 'burst';
  const limit = Math.min(200, Math.max(10, Number(sp.limit) || 50));
  // Header sort: 爆發力／分數 pick which ranking is fetched; the other columns
  // re-order the rows already shown. Numbers default to descending.
  const sort: Col = COLS.includes(sp.sort as Col) ? (sp.sort as Col) : order;
  const dir = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : sort === 'tag' ? 'asc' : 'desc';
  const [categories, media, ranking] = await Promise.all([
    fetchCategories(),
    fetchMedia(),
    fetchRanking(category, order, limit, true).catch(() => null),
  ]);
  const current = categories.find((c) => c.key === category);
  // Keeps the header sort across category / "more" links; sortLink clears it
  // when returning to the fetched ranking's default order.
  const keep = sp.sort ? { sort: sort, dir } : {};
  const link = (patch: Partial<Search>) => {
    const params = { category, order, ...(limit !== 50 ? { limit: String(limit) } : {}), ...keep, ...patch };
    const q = new URLSearchParams(Object.entries(params).filter((kv): kv is [string, string] => kv[1] !== undefined));
    return `/ranking/?${q}`;
  };
  const sortLink = (col: Col) => {
    const nextDir = sort === col ? (dir === 'asc' ? 'desc' : 'asc') : col === 'tag' ? 'asc' : 'desc';
    const fetched = col === 'burst' || col === 'score' ? col : order;
    const isDefault = col === fetched && nextDir === 'desc';
    return link({ order: fetched, ...(isDefault ? { sort: undefined, dir: undefined } : { sort: col, dir: nextDir }) });
  };
  const collator = new Intl.Collator('zh-Hant-TW-u-co-stroke');
  const key: Record<Col, (e: NonNullable<typeof ranking>['entries'][number]) => number | string> = {
    tag: (e) => e.tag,
    burst: (e) => e.burst ?? -Infinity,
    score: (e) => e.normalized,
    count: (e) => e.count,
    trend: (e) =>
      e.trend?.at(-1)?.average24h != null && e.trend[0]?.average24h != null
        ? e.trend.at(-1)!.average24h! - e.trend[0].average24h
        : -Infinity,
    media: (e) => Object.keys(e.media).length,
  };
  const rows = ranking
    ? [...ranking.entries].sort((a, b) => {
        const x = key[sort](a),
          y = key[sort](b);
        if (x === -Infinity || y === -Infinity) return x === y ? a.position - b.position : x === -Infinity ? 1 : -1;
        const c = typeof x === 'string' ? collator.compare(x, y as string) : x - (y as number);
        return (dir === 'asc' ? c : -c) || a.position - b.position;
      })
    : [];
  const Th = ({ col, label, className = '', title }: { col: Col; label: string; className?: string; title?: string }) => (
    <th
      className={`px-3 py-2 ${className}`}
      title={title}
      aria-sort={sort === col ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <Link
        href={sortLink(col)}
        scroll={false}
        className={`inline-flex items-center gap-0.5 hover:text-brand-700 ${sort === col ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
      >
        {label}
        <span aria-hidden className={sort === col ? '' : 'invisible'}>
          {dir === 'asc' ? '▲' : '▼'}
        </span>
      </Link>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">新聞關鍵字排行榜</h1>
          {ranking && (
            <p className="mt-1 text-sm text-zinc-600">
              {taipeiHour(ranking.snapshot.hourStart)} 時段 · {current?.label}{' '}
              {ranking.snapshot.mediaCount ? `${ranking.snapshot.mediaCount} 家媒體 · ` : ''}
              {ranking.snapshot.articleCount !== null ? `${ranking.snapshot.articleCount.toLocaleString()} 篇 · ` : ''}更新於{' '}
              {taipei(ranking.snapshot.computedAt)}
            </p>
          )}
        </div>
        <a href="#method" className="text-sm text-brand-700 hover:underline dark:text-brand-400">
          分數與爆發力怎麼算 ⓘ
        </a>
      </div>
      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 text-sm">
        {categories.map((c) => (
          <Link
            key={c.key}
            href={link({ category: c.key })}
            scroll={false}
            className={`whitespace-nowrap rounded-full px-3 py-1 ${c.key === category ? 'bg-brand-700 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
          >
            {c.label}
          </Link>
        ))}
      </nav>
      {ranking && <RankingBasisNote basis={ranking.snapshot.basis} media={media} />}
      {ranking && !ranking.snapshot.available && <p className="text-sm text-zinc-600">這個時段的基準媒體收錄資料不足，暫不提供排行。</p>}
      <p className="text-xs text-zinc-600">趨勢：每小時新聞篇數的 24 小時移動平均，顯示最近 48 小時的變化；點關鍵字可查看完整時間圖。</p>
      {!ranking ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600">這個分類目前沒有資料。</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-950">
                <tr>
                  <th className="w-10 px-3 py-2 text-right">#</th>
                  <Th col="tag" label="關鍵字" className="sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-950" />
                  <Th col="burst" label="爆發力" className="w-24 text-right" title="相對 3／6／12／24／48 小時前的變化" />
                  <Th col="score" label="分數" className="w-20 text-right" title="媒體加權分數" />
                  <Th col="count" label="篇數" className="w-16 text-right" />
                  <Th col="trend" label="趨勢" className="w-28" title="24 小時平均篇數與 48 小時前的差值（篇／小時）" />
                  <Th col="media" label="媒體" className="" title="報導的媒體家數" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map((e) => {
                  const trend = e.trend ?? [];
                  return (
                    <tr key={e.tag} className="group hover:bg-brand-50/60 dark:hover:bg-zinc-800/60">
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{e.position}</td>
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 group-hover:bg-brand-50 dark:bg-zinc-900 dark:group-hover:bg-zinc-800">
                        <Link
                          href={`/tag/${encodeURIComponent(e.tag)}`}
                          className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                        >
                          {e.tag}
                        </Link>
                      </td>
                      <td
                        title={e.burst === null ? '缺少相同基準的歷史資料，暫不計算爆發力' : undefined}
                        className={`px-3 py-2 text-right tabular-nums ${e.burst !== null && e.burst > e.normalized ? 'text-rose-600' : 'text-zinc-600'}`}
                      >
                        {e.burst?.toFixed(1) ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.normalized.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-600">{e.count}</td>
                      <td className="px-3 py-1">
                        <Sparkline values={trend.map((p) => p.average24h)} />
                      </td>
                      <td className="px-3 py-2">
                        <MediaIcons media={e.media} info={media} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {ranking.entries.length >= limit && (
            <div className="border-t border-zinc-300 p-3 text-center text-sm dark:border-zinc-800">
              <Link
                href={link({ limit: String(limit + 50) })}
                scroll={false}
                className="text-brand-700 hover:underline dark:text-brand-400"
              >
                <PendingLabel>顯示更多</PendingLabel>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
