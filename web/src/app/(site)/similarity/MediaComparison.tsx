'use client';

import { useMemo, useState } from 'react';
import MediaIcon from '@/components/MediaIcon';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import type { CitationDirection, GraphSelection, RelationshipMode } from '@/lib/graph-evidence.mts';
import { nodeArticleCounts } from '@/lib/media-graph.mts';
import type { SimilarityEdge, SimilarityNode } from '@/lib/similarity';
import { table } from '@/lib/table-styles';

type SortKey = 'name' | 'articles' | 'earliest' | 'later' | 'outgoing' | 'incoming';
const columns: { key: SortKey; label: string }[] = [
  { key: 'name', label: '媒體' },
  { key: 'articles', label: '分析篇數' },
  { key: 'earliest', label: '同組最早' },
  { key: 'later', label: '同組較晚' },
  { key: 'outgoing', label: '引用他媒' },
  { key: 'incoming', label: '被他媒引用' },
];
const number = (value: number) => value.toLocaleString('zh-TW');
type RelationshipKey = 'earliest' | 'later' | 'outgoing' | 'incoming';
// Similarity edges point from a later outlet to its group's earliest one;
// citation edges point from the citing outlet to the cited one.
const relationshipFilters: Record<RelationshipKey, { label: string; matches: (edge: SimilarityEdge, id: string) => boolean }> = {
  earliest: { label: '同組較晚的對象', matches: (edge, id) => edge.kind !== 'citation' && edge.target === id },
  later: { label: '同組最早的對象', matches: (edge, id) => edge.kind !== 'citation' && edge.source === id },
  outgoing: { label: '引用的對象', matches: (edge, id) => edge.kind === 'citation' && edge.source === id },
  incoming: { label: '引用本媒的對象', matches: (edge, id) => edge.kind === 'citation' && edge.target === id },
};

export default function MediaComparison({
  data,
  onSelect,
}: {
  /** Media on screen and the relationships between them. */
  data: { nodes: SimilarityNode[]; edges: SimilarityEdge[] };
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
      relationships: data.edges
        .filter((edge) => edge.source === node.id || edge.target === node.id)
        .sort(
          (a, b) =>
            b.count - a.count || a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.kind.localeCompare(b.kind),
        ),
    }));
  }, [data]);
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
          <h3 className="font-semibold">各家媒體，怎麼報、引用誰？</h3>
          <p className="mt-1 text-xs leading-6 text-zinc-500">點欄位排序，點數字查看報導，點關係對象比較兩家媒體。</p>
        </div>
        <label className="text-xs text-zinc-500">
          搜尋媒體
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="媒體名稱"
            className="mt-1 block w-56 max-w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
      </div>
      <p role="status" className="text-xs text-zinc-500">
        符合 {filtered.length} 家 · 沿用圖上媒體篩選 · 篇數涵蓋本期全部關係
      </p>
      <TableScroller label="各家媒體關係表格，可左右捲動">
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
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
                主要關係對象
                <span className="ml-2 font-normal">
                  {focus && <span className="text-zinc-700 dark:text-zinc-300">{focus.label} · </span>}
                  <span className="text-amber-700 dark:text-amber-400">內文相近</span> ·{' '}
                  <span className="text-violet-700 dark:text-violet-400">引用</span> · 箭頭由來源指向較晚或引用的一方
                </span>
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
                      {row.external && <span className={`${table.leadExtra} whitespace-nowrap text-[11px] text-zinc-500`}>僅引用來源</span>}
                    </button>
                  </th>
                  <td className={`${table.num} py-2.5`}>{row.external ? <span title="未收錄本期內文">—</span> : number(row.articles)}</td>
                  {(['earliest', 'later', 'outgoing', 'incoming'] as const).map((key) => {
                    const similar = key === 'earliest' || key === 'later';
                    return (
                      <td key={key} className={`${table.num} py-2.5`}>
                        {row[key] ? (
                          <button
                            type="button"
                            aria-label={`${row.name}：${columns.find((column) => column.key === key)?.label} ${row[key]} 篇，查看報導`}
                            onClick={() =>
                              onSelect(
                                { node: row.id },
                                similar ? 'similarity' : 'citation',
                                key === 'earliest' ? 'incoming' : key === 'later' ? 'outgoing' : key,
                              )
                            }
                            className={`underline decoration-dotted underline-offset-4 ${similar ? 'text-amber-700 dark:text-amber-400' : 'text-violet-700 dark:text-violet-400'}`}
                          >
                            {number(row[key])}
                          </button>
                        ) : (
                          <span className="text-zinc-400">0</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={`${table.cell} py-2.5`}>
                    <div className="flex gap-1.5 whitespace-nowrap">
                      {relationships.slice(0, 3).map((edge) => {
                        const outgoing = edge.source === row.id;
                        const other = outgoing ? edge.target : edge.source;
                        const name = names.get(other) ?? other;
                        const label =
                          edge.kind === 'citation' ? (outgoing ? '引用' : '被引用') : outgoing ? '對方同組最早' : '本媒同組最早';
                        return (
                          <button
                            key={`${edge.kind}:${edge.source}:${edge.target}`}
                            type="button"
                            title={`${name} · ${label} ${number(edge.count)} 篇`}
                            aria-label={`${row.name}與${name}：${label} ${number(edge.count)} 篇，比較兩家媒體`}
                            onClick={() => onSelect({ edge }, edge.kind, 'all')}
                            className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${edge.kind === 'citation' ? 'bg-violet-50 text-violet-800 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'}`}
                          >
                            <span aria-hidden="true">{outgoing ? '←' : '→'}</span>
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
      <p className="text-xs leading-6 text-zinc-500">
        分析篇數為本期已完成比對的內文；同組最早、同組較晚、引用與被引用皆依各欄文章去重，涵蓋本期與所有媒體的關係，不隨圖上篩選改變；主要關係對象只列圖上媒體。同組指內文相近的同一組報導：同組最早是該組最早刊出的那篇，同組較晚是同組已有更早刊出的報導。主要關係對象依關係篇數列出前三項；依同組最早、同組較晚、引用他媒或被他媒引用排序時，只列該類關係的對象。箭頭由同組最早或被引用的一方指向較晚或引用的一方，滑過可看關係類型。同組最早僅依刊登時間判定，不代表原創；相近內文也可能來自通訊社稿或授權轉載。
      </p>
    </div>
  );
}
