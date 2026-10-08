import Link from 'next/link';
import DraftEvidence from '@/components/DraftEvidence';
import MediaIcons from '@/components/MediaIcons';
import MethodLink from '@/components/MethodLink';
import PendingLabel from '@/components/PendingLabel';
import RankingWordCloud from '@/components/RankingWordCloud';
import SortIndicator from '@/components/SortIndicator';
import Sparkline from '@/components/Sparkline';
import TableScroller from '@/components/TableScroller';
import TagDiscoveryBadges from '@/components/TagDiscoveryBadges';
import { fetchCategories, fetchMedia, fetchRanking, taipei, taipeiHour } from '@/lib/api';
import { rankingCategoryNote, rankingNotice } from '@/lib/ranking-notice.mts';
import { type RankingSearch, rankingHref, rankingQuery } from '@/lib/ranking-query.mts';
import { canonicalQuery, pageMetadata } from '@/lib/seo.mts';
import { table } from '@/lib/table-styles';

export const revalidate = 60;
export async function generateMetadata({ searchParams }: { searchParams: Promise<RankingSearch> }) {
  const { category, order, gate } = rankingQuery(await searchParams);
  const categories = await fetchCategories();
  const selected = categories.find((c) => c.key === category);
  const key = selected?.key ?? 'all';
  return pageMetadata(
    canonicalQuery('/ranking/', {
      category: key === 'all' ? undefined : key,
      order: order === 'growth' ? order : undefined,
      gate: gate === 'all' ? undefined : gate,
    }),
    `${key === 'all' ? '' : selected?.label + ' · '}${order === 'growth' ? '正在發酵的新聞關鍵字' : '新聞關鍵字排行榜'}`,
    '追蹤新聞熱門關鍵字、分數、爆發力與排名變動；透過文字雲與逐時趨勢，了解各媒體共同關注的話題。',
    true,
  );
}
type Search = RankingSearch;
type Col = 'tag' | 'change' | 'burst' | 'growth' | 'score' | 'count' | 'trend' | 'media';
const COLS: Col[] = ['tag', 'burst', 'growth', 'change', 'score', 'count', 'trend', 'media'];
const RELATED_SHOWN = 5;
const CLOUD_WORDS = 500;

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  // The footer's @notes/ranking makes the same request for the basis list.
  const { category, order, gate, limit } = rankingQuery(sp);
  const emerging = order === 'growth';
  // Header sort: 爆發力／分數 pick which ranking is fetched; the other columns
  // re-order the rows already shown. Numbers default to descending.
  const sort: Col = COLS.includes(sp.sort as Col) ? (sp.sort as Col) : order;
  const dir = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : sort === 'tag' ? 'asc' : 'desc';
  const [categories, media, ranking, cloud] = await Promise.all([
    fetchCategories(),
    fetchMedia(),
    fetchRanking(category, order, limit, true, true, { gate, signals: true }).catch(() => null),
    fetchRanking(category, emerging ? 'growth' : 'score', CLOUD_WORDS, false, false, { gate }).catch(() => null),
  ]);
  const current = categories.find((c) => c.key === category);
  // These summaries skip trends, related tags and evidence, and share the
  // ranking fetch cache. Navigation reflects articles without optional gates.
  const [unrestricted, categoryRankings] = await Promise.all([
    ranking?.snapshot.available && gate !== 'all'
      ? fetchRanking(category, order, 1, false, false, { gate: 'all' }).catch(() => null)
      : ranking,
    Promise.all(
      categories.map(async (c) => ({
        ...c,
        ranking: await fetchRanking(c.key, 'burst', 1, false, false, { gate: 'all' }).catch(() => null),
      })),
    ),
  ]);
  const popular =
    ranking?.snapshot.available && emerging && !ranking.entries.length && !unrestricted?.entries.length
      ? (categoryRankings.find((c) => c.key === category)?.ranking ?? null)
      : null;
  const notice = rankingNotice({ category, order, gate, limit }, ranking, unrestricted, popular);
  // Keeps the header sort across category / "more" links; sortLink clears it
  // when returning to the fetched ranking's default order.
  const keep = sp.sort ? { sort: sort, dir } : {};
  const link = (patch: Partial<Search>) => rankingHref({ category, order, gate, limit, ...keep }, patch);
  const sortLink = (col: Col) => {
    const nextDir = sort === col ? (dir === 'asc' ? 'desc' : 'asc') : col === 'tag' ? 'asc' : 'desc';
    const fetched = col === 'growth' || (!emerging && (col === 'burst' || col === 'score')) ? col : order;
    const isDefault = col === fetched && nextDir === 'desc';
    return link({ order: fetched, ...(isDefault ? { sort: undefined, dir: undefined } : { sort: col, dir: nextDir }) });
  };
  const collator = new Intl.Collator('zh-Hant-TW-u-co-stroke');
  const key: Record<Col, (e: NonNullable<typeof ranking>['entries'][number]) => number | string> = {
    tag: (e) => e.tag,
    // New entries sort as the biggest climb; unknowns go last either way.
    change: (e) => (e.new ? Infinity : e.rank24h === null ? -Infinity : e.rank24h - e.rank),
    burst: (e) => e.burst ?? -Infinity,
    growth: (e) => e.signals?.growth ?? -Infinity,
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
          <h1 className="text-2xl font-semibold tracking-tight">{emerging ? '正在發酵的新聞關鍵字' : '新聞關鍵字排行榜'}</h1>
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
      <nav aria-label="排行模式" className="flex flex-wrap gap-2">
        {(
          [
            { label: '熱門排行', value: 'burst' },
            { label: '正在發酵', value: 'growth' },
          ] as const
        ).map((mode) => (
          <Link
            key={mode.value}
            scroll={false}
            aria-current={(mode.value === 'growth') === emerging ? 'page' : undefined}
            href={link({
              order: mode.value,
              sort: undefined,
              dir: undefined,
              limit: undefined,
            })}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${(mode.value === 'growth') === emerging ? 'bg-brand-700 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`}
          >
            {mode.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="跨媒體門檻" className="flex flex-wrap items-center gap-2 text-sm">
        <span className="mr-1 text-xs text-zinc-500">跨媒體門檻</span>
        {(
          [
            { value: 'all', label: '不限媒體' },
            { value: 'early', label: '早期線索' },
            { value: 'broad', label: '多家跟進' },
          ] as const
        ).map((item) => (
          <Link
            key={item.value}
            scroll={false}
            aria-current={gate === item.value ? 'page' : undefined}
            href={link({ gate: item.value, limit: undefined })}
            className={`rounded-full border px-3 py-1 ${gate === item.value ? 'border-brand-700 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300' : 'border-zinc-300 text-zinc-600 hover:border-brand-700 dark:border-zinc-700 dark:text-zinc-400'}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 text-sm" aria-label="媒體分類">
        {categoryRankings.map((c) => {
          const note = rankingCategoryNote(c.ranking);
          return (
            <Link
              key={c.key}
              href={link({ category: c.key, limit: undefined })}
              scroll={false}
              aria-label={note ? `${c.label}，${note}` : c.label}
              aria-current={c.key === category ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1 ${c.key === category ? 'bg-brand-700 text-white' : note ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
            >
              {c.label}
              {note && <span className="ml-1.5 text-[10px]">{note}</span>}
            </Link>
          );
        })}
      </nav>
      {cloud && (
        <RankingWordCloud
          mode={emerging ? 'growth' : 'score'}
          terms={cloud.entries.map((e) => ({
            tag: e.tag,
            score: e.normalized,
            burst: e.burst,
            growth: e.signals?.growth ?? null,
            count: e.count,
            media: Object.keys(e.media).length,
            isNew: e.new,
          }))}
        />
      )}
      {ranking?.snapshot.available && (
        <p role="status" className="text-sm text-zinc-600">
          符合條件 {ranking.matchedCount ?? ranking.entries.length} 個關鍵字
          {emerging && !!ranking.unknownGrowthCount && ` · ${ranking.unknownGrowthCount} 個因歷史不足，暫不列入升溫榜`}
        </p>
      )}
      {ranking?.snapshot.available && rows.length > 0 && (
        <TableScroller
          card
          label="關鍵字排行榜表格，可左右捲動"
          footer={
            limit < 200 &&
            (ranking.matchedCount ?? ranking.entries.length) > ranking.entries.length && (
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
          <table className="w-full min-w-[80rem] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-950">
              <tr>
                {/* On phones the rank moves into the sticky keyword cell. */}
                <th className={`hidden w-10 text-right sm:table-cell ${table.cell}`}>#</th>
                <Th col="tag" label="關鍵字" className={table.leadHead} />
                <Th col={emerging ? 'growth' : 'burst'} label={emerging ? '升溫量' : '爆發力'} className="w-24 text-right" />
                <Th col="change" label="變動" className="w-16 text-right" />
                <Th col="score" label="分數" className="w-20 text-right" />
                <Th col="count" label="篇數" className="w-16 text-right" />
                <Th col="trend" label="趨勢" className="w-28" />
                <th className={`w-[17rem] whitespace-nowrap ${table.cell}`}>一起出現</th>
                <Th col="media" label="媒體" className="w-[22rem]" />
                <th className={`whitespace-nowrap ${table.cell}`}>相似稿</th>
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
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <div className={`${table.leadBox} flex items-center gap-2`}>
                          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-500 sm:hidden">{e.position}</span>
                          <Link
                            href={`/tag/${encodeURIComponent(e.tag)}`}
                            className={`${table.leadText} font-medium text-brand-700 hover:underline dark:text-brand-400`}
                          >
                            {e.tag}
                          </Link>
                        </div>
                        <TagDiscoveryBadges
                          isNew={e.new}
                          signals={e.signals}
                          firstCollection={e.firstCollection}
                          gate={gate}
                          className={table.leadExtra}
                        />
                      </div>
                    </td>
                    <td
                      className={`${table.num} ${e.burst !== null && e.burst > e.normalized ? 'font-medium text-brand-700 dark:text-brand-400' : 'text-zinc-600'}`}
                    >
                      {emerging ? `+${e.signals?.growth?.toFixed(1) ?? '—'}` : (e.burst?.toFixed(1) ?? '—')}
                    </td>
                    <td
                      className={`${table.num} text-xs`}
                      title={delta === null || e.new ? undefined : `分數名次 ${e.rank}，24 小時前第 ${e.rank24h} 名`}
                    >
                      {delta === null ? (
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
                    <td className={`whitespace-nowrap ${table.cell}`}>
                      {e.drafts?.articles ? (
                        <DraftEvidence data={e.drafts} singleLine />
                      ) : (
                        <span className="text-xs text-zinc-400">暫無比對資料</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroller>
      )}
      {notice && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
        >
          <p>{notice.message}</p>
          {notice.action && (
            <Link
              href={link({
                gate: 'all',
                ...(notice.action === 'popular' ? { order: 'burst' } : {}),
                sort: undefined,
                dir: undefined,
                limit: undefined,
              })}
              scroll={false}
              className="rounded-lg bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-800"
            >
              <PendingLabel>
                {notice.action === 'popular' ? '查看此分類熱門排行' : emerging ? '顯示此分類全部升溫關鍵字' : '顯示此分類全部關鍵字'}
              </PendingLabel>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
