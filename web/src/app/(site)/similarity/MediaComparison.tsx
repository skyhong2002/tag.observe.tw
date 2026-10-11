'use client';

import { useMemo, useState } from 'react';
import FilterSuggestInput from '@/components/FilterSuggestInput';
import MediaIcon from '@/components/MediaIcon';
import MethodLink from '@/components/MethodLink';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import { edgeCategory, edgeHasArrow, edgeLabel } from '@/lib/graph-edge-style.mts';
import type { CitationDirection, GraphSelection, RelationshipMode } from '@/lib/graph-evidence.mts';
import { nodeArticleCounts } from '@/lib/media-graph.mts';
import { trafficNumber } from '@/lib/media-traffic.mts';
import type { SimilarityEdge, SimilarityNode } from '@/lib/similarity';
import { table } from '@/lib/table-styles';
import type { TaiwanReaders } from '@/lib/traffic-comparison.mts';

type SortKey = 'name' | 'articles' | 'readers' | 'perArticle' | 'sameByline' | 'attributed' | 'unattributed' | 'outgoing' | 'incoming';
const columns: { key: SortKey; label: string; title?: string }[] = [
  { key: 'name', label: '媒體' },
  { key: 'articles', label: '分析篇數' },
  { key: 'sameByline', label: '同署名跨站' },
  { key: 'attributed', label: '已註明來源' },
  { key: 'unattributed', label: '未辨識稿源' },
  { key: 'outgoing', label: '引用' },
  { key: 'incoming', label: '被引用' },
  { key: 'readers', label: '台灣月造訪', title: 'Similarweb 最新一期月造訪次數 × 台灣占比（估算）' },
  { key: 'perArticle', label: '每篇台灣造訪', title: '台灣月造訪 ÷ 依近 7 天發稿速度推估的當月篇數' },
];
const number = (value: number) => value.toLocaleString('zh-TW');
type RelationshipKey = Exclude<SortKey, 'name' | 'articles' | 'readers' | 'perArticle'>;
const relationshipFilters: Record<
  RelationshipKey,
  {
    label: string;
    className: string;
    matches: (edge: SimilarityEdge, id: string) => boolean;
  }
> = {
  sameByline: {
    label: '同署名跨站對象',
    className: 'text-teal-700 dark:text-teal-400',
    matches: (edge) => edgeCategory(edge) === 'same-byline',
  },
  attributed: {
    label: '已註明來源對象',
    className: 'text-violet-700 dark:text-violet-400',
    matches: (edge) => edgeCategory(edge) === 'attributed',
  },
  unattributed: {
    label: '未辨識稿源對象',
    className: 'text-amber-700 dark:text-amber-400',
    matches: (edge) => edgeCategory(edge) === 'unattributed',
  },
  outgoing: {
    label: '引用的對象',
    className: 'text-violet-700 dark:text-violet-400',
    matches: (edge, id) => edge.kind === 'citation' && edge.source === id,
  },
  incoming: {
    label: '引用本媒的對象',
    className: 'text-violet-700 dark:text-violet-400',
    matches: (edge, id) => edge.kind === 'citation' && edge.target === id,
  },
};

export default function MediaComparison({
  data,
  readers,
  onSelect,
}: {
  /** Media on screen and the relationships between them. */
  data: { nodes: SimilarityNode[]; edges: SimilarityEdge[] };
  /** Estimated Taiwan visits per media id (/media/traffic/'s 台灣月造訪 column). */
  readers: Record<string, TaiwanReaders>;
  onSelect: (selection: GraphSelection, mode: RelationshipMode, direction: CitationDirection) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('articles');
  const [descending, setDescending] = useState(true);
  const rows = useMemo(() => {
    const counts = nodeArticleCounts(data.nodes);
    return data.nodes.map((node) => ({
      ...node,
      ...counts.get(node.id),
      sameByline: node.sameByline ?? 0,
      attributed: node.attributed ?? 0,
      unattributed: node.unattributed ?? 0,
      reach: readers[node.id],
      // An upper bound (Taiwan outside the top five) does not rank, as on /media/traffic/.
      readers: readers[node.id] && !readers[node.id].below ? readers[node.id].visits : -1,
      perArticle: (!readers[node.id]?.below && readers[node.id]?.perArticle?.visits) || -1,
      relationships: data.edges
        .filter((edge) => edge.source === node.id || edge.target === node.id)
        .sort(
          (a, b) =>
            b.count - a.count || a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.kind.localeCompare(b.kind),
        ),
    }));
  }, [data, readers]);
  const focus = sort in relationshipFilters ? relationshipFilters[sort as RelationshipKey] : null;
  const names = useMemo(() => new Map(data.nodes.map((node) => [node.id, node.name])), [data.nodes]);
  const filtered = useMemo(
    () =>
      rows
        .filter((row) => `${row.name} ${row.id}`.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => {
          const order = sort === 'name' ? a.name.localeCompare(b.name, 'zh-TW') : a[sort] - b[sort];
          return (descending ? -order : order) || a.name.localeCompare(b.name, 'zh-TW');
        }),
    [rows, query, sort, descending],
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold">各家媒體，怎麼報、採用或引用誰？</h3>
          <p className="mt-1 text-xs leading-6 text-zinc-500">點欄位排序，點數字查看報導，點關係對象比較兩家媒體。</p>
        </div>
        <label htmlFor="media-comparison-q" className="text-xs text-zinc-500">
          搜尋媒體
          <FilterSuggestInput
            id="media-comparison-q"
            type="search"
            value={query}
            items={data.nodes.map((node) => ({ value: node.name, media: node.external ? undefined : node.id }))}
            onValueChange={setQuery}
            placeholder="媒體名稱"
            wrapperClassName="mt-1"
            className="block w-56 max-w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
      </div>
      <p role="status" className="text-xs text-zinc-500">
        符合 {filtered.length} 家 · 沿用圖上媒體篩選 · <MethodLink />
      </p>
      <TableScroller card label="各家媒體關係表格，可左右捲動">
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  title={column.title}
                  aria-sort={sort === column.key ? (descending ? 'descending' : 'ascending') : 'none'}
                  className={`py-3 font-medium ${column.key === 'name' ? `${table.leadHead} text-left` : table.num}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSort(column.key);
                      setDescending(sort === column.key ? !descending : column.key !== 'name');
                    }}
                    className={`whitespace-nowrap hover:text-brand-700 ${sort === column.key ? 'text-brand-700 dark:text-brand-400' : ''}`}
                  >
                    {column.label} <SortIndicator active={sort === column.key} descending={descending} />
                  </button>
                </th>
              ))}
              <th scope="col" className={`${table.cell} py-3 text-left font-medium`}>
                {focus ? (
                  <span className={focus.className}>{focus.label}</span>
                ) : (
                  <>
                    主要關係對象
                    <span className="ml-2 font-normal">
                      <span className="text-amber-700 dark:text-amber-400">未辨識稿源</span> ·{' '}
                      <span className="text-violet-700 dark:text-violet-400">引用</span> ·{' '}
                      <span className="text-teal-700 dark:text-teal-400">同署名</span>
                    </span>
                  </>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((row) => {
              const relationships = focus ? row.relationships.filter((edge) => focus.matches(edge, row.id)) : row.relationships;
              return (
                <tr key={row.id} className={table.row}>
                  <th scope="row" className={`${table.lead} py-2.5 text-left font-normal`}>
                    <button
                      type="button"
                      onClick={() => onSelect({ node: row.id }, 'all', 'all')}
                      className={`${table.leadBox} flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-left hover:text-brand-700 dark:hover:text-brand-400`}
                    >
                      <span className="flex min-w-0 max-w-full items-center gap-2.5">
                        <MediaIcon media={row.id} title={row.name} size={22} />
                        <span className={`${table.leadText} font-medium`}>{row.name}</span>
                      </span>
                      {row.external && (
                        <span className={`${table.leadExtra} whitespace-nowrap text-[11px] text-zinc-500`}>僅來源／引用對象</span>
                      )}
                    </button>
                  </th>
                  <td className={`${table.num} py-2.5`}>{row.external ? <span title="未收錄本期內文">—</span> : number(row.articles)}</td>
                  {(['sameByline', 'attributed', 'unattributed', 'outgoing', 'incoming'] as const).map((key) => {
                    const similar = key !== 'outgoing' && key !== 'incoming';
                    return (
                      <td key={key} className={`${table.num} py-2.5`}>
                        {!row[key] ? (
                          <span className="text-zinc-400">0</span>
                        ) : similar ? (
                          <span className={relationshipFilters[key].className}>{number(row[key])}</span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`${row.name}：${columns.find((column) => column.key === key)?.label} ${row[key]} 篇，查看報導`}
                            onClick={() => onSelect({ node: row.id }, 'citation', key)}
                            className={`underline decoration-dotted underline-offset-4 ${relationshipFilters[key].className}`}
                          >
                            {number(row[key])}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className={`${table.num} whitespace-nowrap py-2.5 ${row.reach?.below ? 'text-zinc-500' : ''}`}
                    title={row.reach?.title}
                  >
                    {row.reach ? `${row.reach.below ? '< ' : ''}${trafficNumber(row.reach.visits)}` : '—'}
                  </td>
                  <td
                    className={`${table.num} whitespace-nowrap py-2.5 ${row.reach?.below ? 'text-zinc-500' : ''}`}
                    title={row.reach?.perArticle?.title}
                  >
                    {row.reach?.perArticle ? `${row.reach.below ? '< ' : ''}${trafficNumber(row.reach.perArticle.visits)}` : '—'}
                  </td>
                  <td className={`${table.cell} py-2.5`}>
                    <div className="flex gap-1.5 whitespace-nowrap">
                      {relationships.slice(0, 3).map((edge) => {
                        const outgoing = edge.source === row.id;
                        const other = outgoing ? edge.target : edge.source;
                        const name = names.get(other) ?? other;
                        const label = edge.kind === 'citation' ? (outgoing ? '引用' : '被引用') : edgeLabel(edge);
                        return (
                          <button
                            key={`${edge.kind}:${edge.relation}:${edge.directed}:${edge.source}:${edge.target}`}
                            type="button"
                            title={`${name} · ${label} ${number(edge.count)} 篇`}
                            aria-label={`${row.name}與${name}：${label} ${number(edge.count)} 篇，比較兩家媒體`}
                            onClick={() => onSelect({ edge }, edge.kind, 'all')}
                            className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${edgeCategory(edge) === 'same-byline' ? 'bg-teal-50 text-teal-800 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300' : edgeCategory(edge) === 'attributed' ? 'bg-violet-50 text-violet-800 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'}`}
                          >
                            <span aria-hidden="true">{edgeHasArrow(edge) ? (outgoing ? '←' : '→') : '↔'}</span>
                            <MediaIcon media={other} title={name} size={14} />
                            {name}
                            <span className="tabular-nums opacity-70">{number(edge.count)}</span>
                          </button>
                        );
                      })}
                      {!relationships.length && (
                        <span className="text-xs text-zinc-400">{focus ? '目前篩選無此類關係' : '目前篩選無關係'}</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroller>
      {!filtered.length && <p className="py-8 text-center text-sm text-zinc-500">沒有符合的媒體，試試其他名稱或調整圖上篩選。</p>}
    </div>
  );
}
