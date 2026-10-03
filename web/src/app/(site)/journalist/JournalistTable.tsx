'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import MediaIcon from '@/components/MediaIcon';
import { type JournalistSummary, journalistHref } from '@/lib/journalists';

type SortKey = 'articles' | 'later' | 'pairs' | 'media' | 'cited';
const sorts: Array<{ key: SortKey; label: string }> = [
  { key: 'articles', label: '篇數' },
  { key: 'later', label: '相似且較晚刊登' },
  { key: 'pairs', label: '相似配對' },
  { key: 'media', label: '跨媒體數' },
  { key: 'cited', label: '明示引用' },
];
const sortValue = (row: JournalistSummary, key: SortKey) =>
  key === 'articles'
    ? row.articles
    : key === 'later'
      ? row.similar.later
      : key === 'pairs'
        ? row.similar.pairs
        : key === 'media'
          ? row.media.length
          : row.cited;
const PAGE = 150;
const number = (value: number) => value.toLocaleString('zh-TW');

export default function JournalistTable({ rows }: { rows: JournalistSummary[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('articles');
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
      .sort((a, b) => sortValue(b, sort) - sortValue(a, sort) || b.articles - a.articles || a.name.localeCompare(b.name, 'zh-Hant'));
  }, [rows, query, sort, media]);
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
          <span className="text-zinc-500 dark:text-zinc-400">排序</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {sorts.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
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
              <th className="px-2 py-2 font-medium">記者</th>
              <th className="px-2 py-2 font-medium">刊登媒體</th>
              <th className={`${cell} font-medium`}>篇數</th>
              <th className={`${cell} font-medium`} title="有可比對正文且落在相似度樣本內的篇數">
                樣本內
              </th>
              <th className={`${cell} font-medium`} title="至少一端是此人文章的相似配對">
                相似配對
              </th>
              <th className={`${cell} font-medium`} title="自家文章比他站相似文章晚至少一分鐘刊登的配對；不含同署名跨站">
                較晚
              </th>
              <th className={`${cell} font-medium`} title="自家文章比他站相似文章早至少一分鐘刊登的配對">
                較早
              </th>
              <th className={`${cell} font-medium`} title="對方文章也署同一名字：同一人把稿件刊在不同媒體">
                同署名
              </th>
              <th className={`${cell} font-medium`} title="內文明示引用其他媒體的篇數">
                引用
              </th>
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
                        {row.media.length > 1 && <span className="tabular-nums text-zinc-400">{outlet.count}</span>}
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
                <td
                  className={`${cell} ${row.similar.later ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-zinc-300 dark:text-zinc-700'}`}
                >
                  {row.similar.later}
                </td>
                <td
                  className={`${cell} ${row.similar.earlier ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-700'}`}
                >
                  {row.similar.earlier}
                </td>
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
