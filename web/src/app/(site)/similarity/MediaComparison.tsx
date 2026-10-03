'use client';

import { useMemo, useState } from 'react';
import MediaIcon from '@/components/MediaIcon';
import type { CitationDirection, GraphSelection, RelationshipMode } from '@/lib/graph-evidence.mts';
import { nodeArticleCounts } from '@/lib/media-graph.mts';
import type { OriginData } from '@/lib/story-origins.mts';

type SortKey = 'name' | 'articles' | 'similar' | 'outgoing' | 'incoming';
const columns: { key: SortKey; label: string }[] = [
  { key: 'name', label: '媒體' },
  { key: 'articles', label: '分析篇數' },
  { key: 'similar', label: '內文相近' },
  { key: 'outgoing', label: '引用他媒' },
  { key: 'incoming', label: '被他媒引用' },
];
const number = (value: number) => value.toLocaleString('zh-TW');

export default function MediaComparison({
  data,
  onSelect,
}: {
  data: OriginData;
  onSelect: (selection: GraphSelection, mode: RelationshipMode, direction: CitationDirection) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('articles');
  const [descending, setDescending] = useState(true);
  const rows = useMemo(() => {
    const counts = nodeArticleCounts(data);
    return data.nodes.map((node) => ({
      ...node,
      similar: counts.get(node.id)?.similar ?? 0,
      outgoing: counts.get(node.id)?.outgoing ?? 0,
      incoming: counts.get(node.id)?.incoming ?? 0,
      relationships: data.edges
        .filter((edge) => edge.source === node.id || edge.target === node.id)
        .sort(
          (a, b) =>
            b.count - a.count || a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.kind.localeCompare(b.kind),
        ),
    }));
  }, [data]);
  const names = useMemo(() => new Map(data.nodes.map((node) => [node.id, node.name])), [data.nodes]);
  const filtered = useMemo(
    () =>
      rows
        .filter((row) => `${row.name} ${row.id} ${row.country}`.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => {
          const order = sort === 'name' ? a.name.localeCompare(b.name, 'zh-TW') : a[sort] - b[sort];
          return (descending ? -order : order) || a.name.localeCompare(b.name, 'zh-TW');
        }),
    [rows, query, sort, descending],
  );
  const metrics = [
    { label: '圖上媒體', value: data.nodes.length, note: '每家媒體，放在一起看' },
    { label: '有相近報導', value: rows.filter((row) => row.similar > 0).length, note: '哪些媒體的內文有所交集' },
    { label: '被引用媒體', value: rows.filter((row) => row.incoming > 0).length, note: '哪些媒體被其他報導提及' },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
            <p className="text-xs text-zinc-500">{metric.label}</p>
            <p className="my-2 text-3xl font-semibold tabular-nums tracking-tight">
              {number(metric.value)} <span className="text-xs font-normal text-zinc-500">家</span>
            </p>
            <p className="text-xs text-zinc-500">{metric.note}</p>
          </div>
        ))}
      </div>
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
            placeholder="媒體名稱或國別"
            className="mt-1 block w-56 max-w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
      </div>
      <p role="status" className="text-xs text-zinc-500">
        符合 {filtered.length} 家 · 沿用圖上媒體篩選 · 各欄涵蓋全部關係類型
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sort === column.key ? (descending ? 'descending' : 'ascending') : 'none'}
                  className={`px-3 py-3 font-medium ${column.key === 'name' ? 'text-left' : 'text-right'}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSort(column.key);
                      setDescending(sort === column.key ? !descending : column.key !== 'name');
                    }}
                    className={`whitespace-nowrap hover:text-brand-700 ${sort === column.key ? 'text-brand-700 dark:text-brand-400' : ''}`}
                  >
                    {column.label} <span aria-hidden="true">{sort === column.key ? (descending ? '↓' : '↑') : '↕'}</span>
                  </button>
                </th>
              ))}
              <th scope="col" className="px-3 py-3 text-left font-medium">
                主要關係對象
                <span className="ml-2 font-normal">
                  <span className="text-amber-700 dark:text-amber-400">內文相近</span> ·{' '}
                  <span className="text-violet-700 dark:text-violet-400">引用</span> · 箭頭指向來源
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                <th scope="row" className="px-3 py-2.5 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onSelect({ node: row.id }, 'all', 'all')}
                    className="flex items-center gap-2.5 whitespace-nowrap text-left hover:text-brand-700 dark:hover:text-brand-400"
                  >
                    <MediaIcon media={row.id} title={row.name} size={22} />
                    <span className="font-medium">{row.name}</span>
                    <span className="text-[11px] text-zinc-500">{row.external ? '僅引用來源' : row.country}</span>
                  </button>
                </th>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {row.external ? <span title="未收錄本期內文">—</span> : number(row.articles)}
                </td>
                {(['similar', 'outgoing', 'incoming'] as const).map((key) => (
                  <td key={key} className="px-3 py-2.5 text-right tabular-nums">
                    {row[key] ? (
                      <button
                        type="button"
                        aria-label={`${row.name}：${columns.find((column) => column.key === key)?.label} ${row[key]} 篇，查看報導`}
                        onClick={() =>
                          onSelect({ node: row.id }, key === 'similar' ? 'similarity' : 'citation', key === 'similar' ? 'all' : key)
                        }
                        className={`underline decoration-dotted underline-offset-4 ${key === 'similar' ? 'text-amber-700 dark:text-amber-400' : 'text-violet-700 dark:text-violet-400'}`}
                      >
                        {number(row[key])}
                      </button>
                    ) : (
                      <span className="text-zinc-400">0</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2.5">
                  <div className="flex gap-1.5 whitespace-nowrap">
                    {row.relationships.slice(0, 3).map((edge) => {
                      const outgoing = edge.source === row.id;
                      const other = outgoing ? edge.target : edge.source;
                      const name = names.get(other) ?? other;
                      const label = edge.kind === 'citation' ? (outgoing ? '引用' : '被引用') : outgoing ? '對方同組最早' : '本媒同組最早';
                      return (
                        <button
                          key={`${edge.kind}:${edge.source}:${edge.target}`}
                          type="button"
                          title={`${name} · ${label} ${number(edge.count)} 篇`}
                          aria-label={`${row.name}與${name}：${label} ${number(edge.count)} 篇，比較兩家媒體`}
                          onClick={() => onSelect({ edge }, edge.kind, 'all')}
                          className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${edge.kind === 'citation' ? 'bg-violet-50 text-violet-800 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'}`}
                        >
                          <span aria-hidden="true">{outgoing ? '→' : '←'}</span>
                          <MediaIcon media={other} title={name} size={14} />
                          {name}
                          <span className="tabular-nums opacity-70">{number(edge.count)}</span>
                        </button>
                      );
                    })}
                    {!row.relationships.length && <span className="text-xs text-zinc-400">目前篩選無關係</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p className="py-8 text-center text-sm text-zinc-500">沒有符合的媒體，試試其他名稱或調整圖上篩選。</p>}
      <p className="text-xs leading-6 text-zinc-500">
        分析篇數為本期納入樣本的內文；內文相近、引用與被引用皆依各欄文章去重。主要關係對象依關係篇數列出前三項，箭頭指向同組最早或被引用的一方，滑過可看關係類型。同組最早僅依刊登時間判定，不代表原創；相近內文也可能來自通訊社稿或授權轉載。
      </p>
    </div>
  );
}
