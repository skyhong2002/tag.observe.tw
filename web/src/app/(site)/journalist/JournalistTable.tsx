'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import MediaIcon from '@/components/MediaIcon';
import { type JournalistSummary, journalistHref } from '@/lib/journalists';

type SortKey = 'name' | 'media' | 'articles' | 'inSample' | 'pairs' | 'later' | 'earlier' | 'sameAuthor' | 'cited';
// Click a heading to sort, click again to flip, like the media tables.
const columns: Array<{ key: SortKey; label: string; title?: string; numeric: boolean }> = [
  { key: 'name', label: '記者', numeric: false },
  { key: 'media', label: '刊登媒體', title: '依刊登媒體數排序', numeric: false },
  { key: 'articles', label: '篇數', numeric: true },
  { key: 'inSample', label: '樣本內', title: '有可比對正文且落在相似度樣本內的篇數', numeric: true },
  { key: 'pairs', label: '內文相近', title: '至少一端是此人文章的相近配對；同一新聞稿、通訊社稿、授權轉載與引用都會相近', numeric: true },
  {
    key: 'later',
    label: '對方較早',
    title: '他站相近文章比此人文章早至少一分鐘刊登的配對；刊登時間以各站標示為準，不含同署名跨站',
    numeric: true,
  },
  { key: 'earlier', label: '本篇較早', title: '此人文章比他站相近文章早至少一分鐘刊登的配對', numeric: true },
  { key: 'sameAuthor', label: '同署名', title: '對方文章也署同一名字：同一人把稿件刊在不同媒體', numeric: true },
  { key: 'cited', label: '引用', title: '內文明示引用其他媒體的篇數', numeric: true },
];
const sortValue = (row: JournalistSummary, key: SortKey): number =>
  key === 'media'
    ? row.media.length
    : key === 'articles'
      ? row.articles
      : key === 'inSample'
        ? row.inSample
        : key === 'pairs'
          ? row.similar.pairs
          : key === 'later'
            ? row.similar.later
            : key === 'earlier'
              ? row.similar.earlier
              : key === 'sameAuthor'
                ? row.similar.sameAuthor
                : key === 'cited'
                  ? row.cited
                  : 0;
const PAGE = 150;
const number = (value: number) => value.toLocaleString('zh-TW');

export default function JournalistTable({ rows }: { rows: JournalistSummary[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('articles');
  const [descending, setDescending] = useState(true);
  const [media, setMedia] = useState('');
  const [shown, setShown] = useState(PAGE);
  const outlets = useMemo(() => {
    const names = new Map<string, { name: string; count: number }>();
    for (const row of rows)
      for (const outlet of row.media) names.set(outlet.media, { name: outlet.name, count: (names.get(outlet.media)?.count ?? 0) + 1 });
    return [...names].sort((a, b) => b[1].count - a[1].count);
  }, [rows]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows
      .filter(
        (row) => (!needle || row.name.toLowerCase().includes(needle)) && (!media || row.media.some((outlet) => outlet.media === media)),
      )
      .sort((a, b) => {
        const order = sort === 'name' ? a.name.localeCompare(b.name, 'zh-Hant') : sortValue(a, sort) - sortValue(b, sort);
        return (descending ? -order : order) || b.articles - a.articles || a.name.localeCompare(b.name, 'zh-Hant');
      });
  }, [rows, query, sort, descending, media]);
  const sortBy = (key: SortKey) => {
    if (sort === key) setDescending(!descending);
    else {
      setSort(key);
      setDescending(key !== 'name');
    }
    setShown(PAGE);
  };
  const visible = filtered.slice(0, shown);
  const cell = 'px-2 py-2 text-right tabular-nums';
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500 dark:text-zinc-400">搜尋名字</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShown(PAGE);
            }}
            placeholder="例如 周辰陽"
            className="w-44 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500 dark:text-zinc-400">媒體</span>
          <select
            value={media}
            onChange={(event) => {
              setMedia(event.target.value);
              setShown(PAGE);
            }}
            className="max-w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">全部媒體</option>
            {outlets.map(([key, outlet]) => (
              <option key={key} value={key}>
                {outlet.name}（{outlet.count} 人）
              </option>
            ))}
          </select>
        </label>
        <p className="py-2 text-zinc-500 dark:text-zinc-400">符合 {number(filtered.length)} 人</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead className="text-left text-xs text-zinc-500 dark:text-zinc-400">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sort === column.key ? (descending ? 'descending' : 'ascending') : 'none'}
                  className={`${column.numeric ? cell : 'px-2 py-2'} font-medium`}
                >
                  <button
                    type="button"
                    title={column.title}
                    onClick={() => sortBy(column.key)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-brand-700 dark:hover:text-brand-400 ${
                      column.numeric ? 'w-full justify-end' : ''
                    } ${sort === column.key ? 'text-brand-800 dark:text-brand-300' : ''}`}
                  >
                    {column.label}
                    <span aria-hidden="true">{sort === column.key ? (descending ? '↓' : '↑') : '↕'}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {visible.map((row) => (
              <tr key={row.name} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                <td className="px-2 py-2">
                  <Link
                    href={journalistHref(row.name)}
                    className="font-medium hover:text-brand-700 hover:underline dark:hover:text-brand-400"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-2 py-2">
                  <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {row.media.slice(0, 4).map((outlet) => (
                      <li key={outlet.media} className="flex items-center gap-1">
                        <MediaIcon media={outlet.media} title={outlet.name} size={14} />
                        <span>{outlet.name}</span>
                        <span className="tabular-nums text-zinc-400">{outlet.count}</span>
                      </li>
                    ))}
                    {row.media.length > 4 && <li className="text-zinc-400">+{row.media.length - 4}</li>}
                  </ul>
                </td>
                <td className={cell}>{number(row.articles)}</td>
                <td className={`${cell} text-zinc-500 dark:text-zinc-400`}>{number(row.inSample)}</td>
                <td className={cell}>
                  {row.similar.pairs ? number(row.similar.pairs) : <span className="text-zinc-300 dark:text-zinc-700">0</span>}
                </td>
                <td className={`${cell} ${row.similar.later ? '' : 'text-zinc-300 dark:text-zinc-700'}`}>{row.similar.later}</td>
                <td className={`${cell} ${row.similar.earlier ? '' : 'text-zinc-300 dark:text-zinc-700'}`}>{row.similar.earlier}</td>
                <td className={`${cell} ${row.similar.sameAuthor ? '' : 'text-zinc-300 dark:text-zinc-700'}`}>{row.similar.sameAuthor}</td>
                <td className={`${cell} ${row.cited ? '' : 'text-zinc-300 dark:text-zinc-700'}`}>{row.cited}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > shown && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setShown((value) => value + PAGE)}
            className="rounded border border-zinc-300 px-4 py-2 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            顯示更多（還有 {number(filtered.length - shown)} 人）
          </button>
        </div>
      )}
      {!filtered.length && <p className="py-8 text-center text-sm text-zinc-500">沒有符合的記者。</p>}
    </div>
  );
}
