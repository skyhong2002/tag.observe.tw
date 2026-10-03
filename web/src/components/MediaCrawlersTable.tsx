'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import {
  type CrawlerGroup,
  type CrawlerSort,
  crawlerGroups,
  crawlerTags,
  emptyCrawlerFilters,
  type MediaCrawler,
  selectCrawlers,
} from '@/lib/media-crawlers.mts';
import { localMediaIcon, mediaIconClass } from '@/lib/media-icons';
import MediaHoverLink from './MediaHoverLink';

const columns: Array<{ key: CrawlerSort; label: string }> = [
  { key: 'title', label: '媒體' },
  ...crawlerGroups,
  { key: 'code', label: '程式碼' },
];
const tagStyle = 'inline-flex shrink-0 items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-xs leading-4';
const tagColors: Record<CrawlerGroup, string> = {
  methods: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
  tools: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200',
  content: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
};

export default function MediaCrawlersTable({ media, initialQuery }: { media: MediaCrawler[]; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState(emptyCrawlerFilters);
  const [sort, setSort] = useState<CrawlerSort>('title');
  const [descending, setDescending] = useState(false);
  const options = useMemo(
    () =>
      crawlerGroups.map((group) => ({
        ...group,
        tags: [...new Set(media.flatMap((row) => crawlerTags(row)[group.key]))].sort((a, b) => a.localeCompare(b, 'zh-Hant')),
      })),
    [media],
  );
  const rows = useMemo(() => selectCrawlers(media, query, filters, sort, descending), [media, query, filters, sort, descending]);
  const filtered = !!query || crawlerGroups.some(({ key }) => filters[key].length);
  const toggle = (group: CrawlerGroup, tag: string) =>
    setFilters((previous) => ({
      ...previous,
      [group]: previous[group].includes(tag) ? previous[group].filter((value) => value !== tag) : [...previous[group], tag],
    }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="搜尋媒體或爬蟲資訊"
          placeholder="搜尋媒體、國家、抓取方式或工具"
          className="w-full max-w-sm rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <span role="status" className="text-xs text-zinc-500">
          {rows.length} / {media.length} 個來源
        </span>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilters(emptyCrawlerFilters());
            }}
            className="text-xs underline"
          >
            清除篩選
          </button>
        )}
      </div>
      <section className="space-y-2" aria-label="爬蟲標籤篩選">
        {options.map(({ key, label, tags }) => (
          <fieldset key={key} className="flex min-w-0 flex-wrap items-center gap-1.5">
            <legend className="sr-only">{label}</legend>
            <span aria-hidden="true" className="w-16 shrink-0 text-xs text-zinc-500">
              {label}
            </span>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={filters[key].includes(tag)}
                onClick={() => toggle(key, tag)}
                className={`${tagStyle} ${filters[key].includes(tag) ? `${tagColors[key]} ring-1 ring-current` : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
              >
                {filters[key].includes(tag) && (
                  <span aria-hidden="true" className="mr-1">
                    ✓
                  </span>
                )}
                {tag}
              </button>
            ))}
          </fieldset>
        ))}
        <p className="text-xs text-zinc-500">可多選；同組符合任一標籤，不同組交叉篩選。點欄名可切換升冪／降冪。</p>
      </section>
      {/* Keyboard users can focus the overflow container to scroll horizontally. */}
      <section
        aria-label="爬蟲資訊表格，可左右捲動"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable table region needs keyboard access.
        tabIndex={0}
        className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-800"
      >
        <table className="w-full whitespace-nowrap text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
            <tr>
              {columns.map(({ key, label }) => (
                <th
                  key={key}
                  scope="col"
                  aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'}
                  className="px-3 py-2"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 text-left hover:text-brand-700 dark:hover:text-brand-400"
                    onClick={() => {
                      setSort(key);
                      setDescending(sort === key ? !descending : false);
                    }}
                  >
                    {label}
                    <span aria-hidden="true">{sort === key ? (descending ? '↓' : '↑') : '↕'}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((row) => {
              const icon = localMediaIcon(row.media);
              const tags = crawlerTags(row);
              const schedule = row.schedule === 'off' ? '未啟用' : row.schedule === 'hourly' ? '每小時' : '每 9 分鐘';
              return (
                <tr key={row.media} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <MediaHoverLink
                        media={row.media}
                        title={row.title}
                        {...{ icon: false }}
                        className="inline-flex items-center gap-2 font-medium hover:underline"
                      >
                        {icon ? (
                          <Image
                            src={icon}
                            alt=""
                            width={16}
                            height={16}
                            unoptimized
                            className={`size-4 shrink-0 object-contain ${mediaIconClass(row.media)}`}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="inline-flex size-4 items-center justify-center rounded bg-zinc-200 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
                          >
                            {row.title.slice(0, 1)}
                          </span>
                        )}
                        <span className="max-w-40 truncate" title={`${row.title} · ${row.country}`}>
                          {row.title}
                        </span>
                      </MediaHoverLink>
                      <span className="text-[10px] text-zinc-500">{schedule}</span>
                    </div>
                  </td>
                  {crawlerGroups.map(({ key, label }) => (
                    <td key={key} className="px-3 py-1.5">
                      <div
                        className="flex items-center gap-1"
                        title={
                          key === 'methods'
                            ? `${row.crawler?.methods.join('、') ?? '尚無資料'}${row.crawler?.lastVerifiedMethod ? `；最近驗證：${row.crawler.lastVerifiedMethod}` : ''}`
                            : key === 'tools'
                              ? (row.crawler?.transport ?? undefined)
                              : row.crawler?.body
                        }
                      >
                        {tags[key].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            aria-label={`${label}：${tag}，切換篩選`}
                            aria-pressed={filters[key].includes(tag)}
                            onClick={() => toggle(key, tag)}
                            className={`${tagStyle} ${tagColors[key]} ${filters[key].includes(tag) ? 'ring-1 ring-current' : ''}`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-3">
                      {row.crawler?.links.length ? (
                        row.crawler.links.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${row.title}：${link.label}（另開視窗）`}
                            className="text-brand-700 underline underline-offset-2 dark:text-brand-400"
                          >
                            {link.label} ↗
                          </a>
                        ))
                      ) : (
                        <span className="text-zinc-500">未設定爬蟲</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                  沒有符合條件的媒體，請調整或清除篩選。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
