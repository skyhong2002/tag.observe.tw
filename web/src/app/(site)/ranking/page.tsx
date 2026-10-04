import Link from 'next/link';
import MediaIcons from '@/components/MediaIcons';
import MethodLink from '@/components/MethodLink';
import PendingLabel from '@/components/PendingLabel';
import RankingWordCloud from '@/components/RankingWordCloud';
import SortIndicator from '@/components/SortIndicator';
import Sparkline from '@/components/Sparkline';
import TableScroller from '@/components/TableScroller';
import { fetchCategories, fetchMedia, fetchRanking, taipei, taipeiHour } from '@/lib/api';
import { type RankingSearch, rankingQuery } from '@/lib/ranking-query';
import { canonicalQuery, pageMetadata } from '@/lib/seo';
import { table } from '@/lib/table-styles';

export const revalidate = 60;
export async function generateMetadata({ searchParams }: { searchParams: Promise<RankingSearch> }) {
  const { category } = rankingQuery(await searchParams);
  const categories = await fetchCategories();
  const selected = categories.find((c) => c.key === category);
  const key = selected?.key ?? 'all';
  return pageMetadata(
    canonicalQuery('/ranking/', { category: key === 'all' ? undefined : key }),
    `${key === 'all' ? '' : selected?.label + ' · '}新聞關鍵字排行榜`,
    '追蹤新聞熱門關鍵字、分數、爆發力與排名變動；透過文字雲與逐時趨勢，了解各媒體共同關注的話題。',
  );
}
type Search = RankingSearch;
type Col = 'tag' | 'change' | 'burst' | 'score' | 'count' | 'trend' | 'media';
const COLS: Col[] = ['tag', 'burst', 'change', 'score', 'count', 'trend', 'media'];
const RELATED_SHOWN = 5;
const CLOUD_WORDS = 500;

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  // The footer's @notes/ranking makes the same request for the basis list.
  const { category, order, limit } = rankingQuery(sp);
  // Header sort: 爆發力／分數 pick which ranking is fetched; the other columns
  // re-order the rows already shown. Numbers default to descending.
  const sort: Col = COLS.includes(sp.sort as Col) ? (sp.sort as Col) : order;
  const dir = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : sort === 'tag' ? 'asc' : 'desc';
  const [categories, media, ranking, cloud] = await Promise.all([
    fetchCategories(),
    fetchMedia(),
    fetchRanking(category, order, limit, true, true).catch(() => null),
    // The word cloud takes more keywords than the table shows, always by score.
    fetchRanking(category, 'score', CLOUD_WORDS).catch(() => null),
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
    // New entries sort as the biggest climb; unknowns go last either way.
    change: (e) => (e.new ? Infinity : e.rank24h === null ? -Infinity : e.rank24h - e.rank),
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
        if (x === Infinity || y === Infinity)
          return x === y ? a.position - b.position : (x === Infinity ? -1 : 1) * (dir === 'asc' ? -1 : 1);
        const c = typeof x === 'string' ? collator.compare(x, y as string) : x - (y as number);
        return (dir === 'asc' ? c : -c) || a.position - b.position;
      })
    : [];
  // Column definitions are in the footer's 資料來源與計算方式 (RankingMethod).
  const Th = ({ col, label, className = '' }: { col: Col; label: string; className?: string }) => (
    <th
      className={`whitespace-nowrap ${table.cell} ${className}`}
      aria-sort={sort === col ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <Link
        href={sortLink(col)}
        scroll={false}
        className={`inline-flex items-center gap-0.5 hover:text-brand-700 ${sort === col ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
      >
        {label}
        <SortIndicator active={sort === col} descending={dir === 'desc'} />
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
        <MethodLink className="text-sm" />
      </div>
      {cloud && (
        <RankingWordCloud
          terms={cloud.entries.map((e) => ({
            tag: e.tag,
            score: e.normalized,
            burst: e.burst,
            count: e.count,
            media: Object.keys(e.media).length,
            isNew: e.new,
          }))}
        />
      )}
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
      {ranking && !ranking.snapshot.available && <p className="text-sm text-zinc-600">這個時段的基準媒體收錄資料不足，暫不提供排行。</p>}
      {!ranking ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600">這個分類目前沒有資料。</p>
      ) : (
        <TableScroller
          card
          label="關鍵字排行榜表格，可左右捲動"
          footer={
            ranking.entries.length >= limit && (
              <div className="border-t border-zinc-300 p-3 text-center text-sm dark:border-zinc-800">
                <Link
                  href={link({ limit: String(limit + 50) })}
                  scroll={false}
                  className="text-brand-700 hover:underline dark:text-brand-400"
                >
                  <PendingLabel>顯示更多</PendingLabel>
                </Link>
              </div>
            )
          }
        >
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-950">
              <tr>
                {/* On phones the rank moves into the sticky keyword cell. */}
                <th className={`hidden w-10 text-right sm:table-cell ${table.cell}`}>#</th>
                <Th col="tag" label="關鍵字" className={table.leadHead} />
                <Th col="burst" label="爆發力" className="w-24 text-right" />
                <Th col="change" label="變動" className="w-16 text-right" />
                <Th col="score" label="分數" className="w-20 text-right" />
                <Th col="count" label="篇數" className="w-16 text-right" />
                <Th col="trend" label="趨勢" className="w-28" />
                <th className={`w-[17rem] whitespace-nowrap ${table.cell}`}>一起出現</th>
                <Th col="media" label="媒體" className="w-[30%]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((e) => {
                const trend = e.trend ?? [];
                const delta = e.rank24h === null ? null : e.rank24h - e.rank;
                const related = (e.related ?? []).slice(0, RELATED_SHOWN);
                return (
                  <tr key={e.tag} className={table.row}>
                    <td className={`hidden text-zinc-500 sm:table-cell ${table.num}`}>{e.position}</td>
                    <td className={table.lead}>
                      <div className={`${table.leadBox} flex items-center gap-2`}>
                        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-500 sm:hidden">{e.position}</span>
                        <Link
                          href={`/tag/${encodeURIComponent(e.tag)}`}
                          className={`${table.leadText} font-medium text-brand-700 hover:underline dark:text-brand-400`}
                        >
                          {e.tag}
                        </Link>
                      </div>
                    </td>
                    <td
                      className={`${table.num} ${e.burst !== null && e.burst > e.normalized ? 'font-medium text-brand-700 dark:text-brand-400' : 'text-zinc-600'}`}
                    >
                      {e.burst?.toFixed(1) ?? '—'}
                    </td>
                    <td
                      className={`${table.num} text-xs`}
                      title={delta === null || e.new ? undefined : `分數名次 ${e.rank}，24 小時前第 ${e.rank24h} 名`}
                    >
                      {e.new ? (
                        <span className="rounded bg-brand-100 px-1.5 py-0.5 font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                          新
                        </span>
                      ) : delta === null ? (
                        <span className="text-zinc-400">—</span>
                      ) : delta > 0 ? (
                        <span className="text-rose-600">▲{delta}</span>
                      ) : delta < 0 ? (
                        <span className="text-sky-600">▼{-delta}</span>
                      ) : (
                        <span className="text-zinc-400">＝</span>
                      )}
                    </td>
                    <td className={table.num}>{e.normalized.toFixed(1)}</td>
                    <td className={`${table.num} text-zinc-600`}>{e.count}</td>
                    <td className="px-2 py-1 sm:px-3">
                      <Sparkline values={trend.map((p) => p.average24h)} />
                    </td>
                    <td
                      className={`max-w-0 truncate whitespace-nowrap text-xs ${table.cell}`}
                      title={
                        related.length
                          ? related.map((r) => `${r.tag} ${r.count} 篇（${Math.round(r.share * 100)}%）`).join('\n')
                          : undefined
                      }
                    >
                      {related.length ? (
                        related.map((r, i) => (
                          <span key={r.tag}>
                            {i > 0 && <span className="text-zinc-400">、</span>}
                            <Link
                              href={`/tag/${encodeURIComponent(r.tag)}`}
                              className="text-zinc-700 hover:text-brand-700 hover:underline dark:text-zinc-300 dark:hover:text-brand-400"
                            >
                              {r.tag}
                            </Link>
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className={`max-w-0 ${table.cell}`}>
                      <MediaIcons media={e.media} info={media} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroller>
      )}
    </div>
  );
}
