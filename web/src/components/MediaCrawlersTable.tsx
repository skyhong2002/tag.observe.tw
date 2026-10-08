'use client';

import Image from 'next/image';
import { Fragment, useMemo, useState } from 'react';
import { taipei } from '@/lib/api';
import {
  type CrawlerGroup,
  type CrawlerSort,
  crawlerGroups,
  crawlerTags,
  emptyCrawlerFilters,
  type MediaCrawler,
  type MediaTopicSources,
  scheduleLabel,
  selectCrawlers,
  type TopicSourceKind,
  topicSourceKindLabels,
} from '@/lib/media-crawlers.mts';
import { localMediaIcon, mediaIconClass } from '@/lib/media-icons';
import { table } from '@/lib/table-styles';
import MediaHoverLink from './MediaHoverLink';
import SortIndicator from './SortIndicator';
import TableScroller from './TableScroller';

const columns: Array<{ key: CrawlerSort; label: string }> = [
  { key: 'title', label: '媒體' },
  { key: 'schedule', label: '執行頻率' },
  { key: 'totalCollected', label: '累計收錄' },
  { key: 'nextCrawl', label: '下次可爬取' },
  { key: 'failures', label: '近期失敗' },
  ...crawlerGroups,
  { key: 'code', label: '程式碼' },
  { key: 'topics', label: '議題／專題' },
];
const tagStyle = 'inline-flex shrink-0 items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-xs leading-4';
const tagColors: Record<CrawlerGroup, string> = {
  methods: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
  tools: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200',
  content: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
};
const sourceKindColors: Record<TopicSourceKind, string> = {
  topic: 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-200',
  feature: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  auto: 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
};
const topicStatusLabels: Record<string, string> = {
  ok: '更新正常',
  partial: '部分入口未更新',
  failed: '本次未能更新',
  pending: '等待首次檢查',
  running: '正在更新',
};
const topicProblem = (t: MediaTopicSources) => t.status === 'failed' || t.status === 'partial' || t.sources.some((s) => s.error);

export default function MediaCrawlersTable({ media, initialQuery, asOf }: { media: MediaCrawler[]; initialQuery: string; asOf: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState(emptyCrawlerFilters);
  const [sort, setSort] = useState<CrawlerSort>('totalCollected');
  const [descending, setDescending] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);
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
        <p className="text-xs text-zinc-500">
          可多選；同組符合任一標籤，不同組交叉篩選。點欄名可切換升冪／降冪。執行頻率按媒體個別設定；下次可爬取是最早允許巡查的時間（台北），實際開始仍受佇列影響。近期失敗包含近24小時巡查與內文抓取的部分失敗；累計收錄是本站爬蟲儲存的歷史紀錄（含專題頁，不含歷史匯入），探索平台計發現紀錄。
        </p>
      </section>
      <TableScroller card label="爬蟲資訊表格，可左右捲動">
        <table className="w-full whitespace-nowrap text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
            <tr>
              {columns.map(({ key, label }) => (
                <th
                  key={key}
                  scope="col"
                  aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'}
                  className={key === 'title' ? table.leadHead : table.cell}
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
                    <SortIndicator active={sort === key} descending={descending} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((row) => {
              const icon = localMediaIcon(row.media);
              const tags = crawlerTags(row);
              return (
                <Fragment key={row.media}>
                  <tr className={table.row}>
                    <td className={`${table.lead} py-1.5`}>
                      <div className={`${table.leadBox} flex flex-wrap items-center gap-x-2 gap-y-0.5`}>
                        <MediaHoverLink
                          media={row.media}
                          title={row.title}
                          {...{ icon: false }}
                          className="flex min-w-0 max-w-full items-center gap-2 font-medium hover:underline"
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
                          <span className={`${table.leadText} sm:max-w-40`} title={`${row.title} · ${row.country}`}>
                            {row.title}
                          </span>
                        </MediaHoverLink>
                      </div>
                    </td>
                    <td
                      className={`${table.cell} py-1.5`}
                      title={row.crawlSchedule?.reason ?? '設定的排程間隔；實際執行時間可能受佇列等待影響'}
                    >
                      {scheduleLabel(row)}
                    </td>
                    <td
                      className={`${table.cell} py-1.5 tabular-nums`}
                      title={
                        row.sourceKind === 'discovery'
                          ? '探索平台累計發現紀錄'
                          : '本站爬蟲累計儲存的紀錄，含專題頁與日期待確認紀錄，不含歷史匯入'
                      }
                    >
                      {row.totalCollected === undefined ? '—' : `${row.totalCollected.toLocaleString('zh-TW')} 筆`}
                    </td>
                    <td
                      className={`${table.cell} py-1.5`}
                      title="最早可開始巡查的時間（台北）；實際派工依佇列而定，時間以本頁載入的統計為準"
                    >
                      {row.schedule === 'off'
                        ? '未啟用'
                        : row.crawlSchedule?.running
                          ? '執行中'
                          : !row.crawlSchedule?.nextEligibleAt
                            ? '待首次巡查'
                            : Date.parse(row.crawlSchedule.nextEligibleAt) <= Date.parse(asOf)
                              ? '已到期，待執行'
                              : taipei(row.crawlSchedule.nextEligibleAt)}
                    </td>
                    <td
                      className={`${table.cell} py-1.5`}
                      title={
                        row.crawlHealth?.lastFailureAt
                          ? `近24小時巡查與內文抓取；最後有錯誤：${taipei(row.crawlHealth.lastFailureAt)}`
                          : '近24小時巡查與內文抓取紀錄；包含部分抓取失敗'
                      }
                    >
                      {!row.crawlHealth?.runs24h ? (
                        '尚無執行紀錄'
                      ) : row.crawlHealth.failures24h ? (
                        <span className="text-amber-700 dark:text-amber-400">
                          {row.crawlHealth.failures24h} / {row.crawlHealth.runs24h} 次有錯誤
                        </span>
                      ) : (
                        '近24小時無失敗'
                      )}
                    </td>
                    {crawlerGroups.map(({ key, label }) => (
                      <td key={key} className={`${table.cell} py-1.5`}>
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
                    <td className={`${table.cell} py-1.5`}>
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
                    <td className={`${table.cell} py-1.5`}>
                      {row.topics ? (
                        <button
                          type="button"
                          aria-expanded={expanded.includes(row.media)}
                          aria-controls={`topic-sources-${row.media}`}
                          aria-label={`${row.title}：議題 ${row.topics.counts.topic}、專題 ${row.topics.counts.feature}，${row.topics.sources.length} 個來源，${expanded.includes(row.media) ? '收合' : '展開'}來源`}
                          title={`${topicStatusLabels[row.topics.status] ?? row.topics.status}${row.topics.checkedAt ? `；${taipei(row.topics.checkedAt)} 檢查` : ''}`}
                          onClick={() =>
                            setExpanded((previous) =>
                              previous.includes(row.media) ? previous.filter((value) => value !== row.media) : [...previous, row.media],
                            )
                          }
                          className="inline-flex items-center gap-1.5 hover:text-brand-700 dark:hover:text-brand-400"
                        >
                          <span
                            aria-hidden="true"
                            className={`size-1.5 shrink-0 rounded-full ${topicProblem(row.topics) ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          />
                          議題 {row.topics.counts.topic}・專題 {row.topics.counts.feature}
                          <span aria-hidden="true" className="text-zinc-400">
                            {expanded.includes(row.media) ? '▾' : '▸'}
                          </span>
                        </button>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                  {row.topics && expanded.includes(row.media) && (
                    <tr id={`topic-sources-${row.media}`} className="bg-zinc-50/60 dark:bg-zinc-900/40">
                      <td colSpan={columns.length} className={`${table.cell} whitespace-normal`}>
                        <TopicSources title={row.title} topics={row.topics} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length} className="px-2 py-8 text-center text-zinc-500 sm:px-3">
                  沒有符合條件的媒體，請調整或清除篩選。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroller>
    </div>
  );
}

/** One outlet's 議題／專題 entry points: what each listing is declared as and how it last went. */
function TopicSources({ title, topics }: { title: string; topics: MediaTopicSources }) {
  return (
    // Sticky so it stays in view when the table is scrolled to this far-right column.
    <div className="sticky left-3 w-fit max-w-[calc(100vw-4rem)] space-y-1.5 lg:max-w-5xl">
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-500">
        <span className={topicProblem(topics) ? 'text-amber-700 dark:text-amber-400' : undefined}>
          {topicStatusLabels[topics.status] ?? topics.status}
        </span>
        {topics.checkedAt && <span>{taipei(topics.checkedAt)} 檢查</span>}
        {topics.lastSuccessAt && topics.lastSuccessAt !== topics.checkedAt && <span>最後成功 {taipei(topics.lastSuccessAt)}</span>}
        <span>
          累計議題 {topics.counts.topic}・專題 {topics.counts.feature}
        </span>
        {topics.rulesUrl && (
          <a
            href={topics.rulesUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${title}：議題／專題判定規則（另開視窗）`}
            className="text-brand-700 underline underline-offset-2 dark:text-brand-400"
          >
            判定規則 ↗
          </a>
        )}
      </p>
      {topics.sources.length ? (
        <ul className="space-y-1">
          {topics.sources.map((source) => (
            <li key={source.url} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={`${tagStyle} ${sourceKindColors[source.kind] ?? sourceKindColors.auto}`}>
                {topicSourceKindLabels[source.kind] ?? source.kind}
              </span>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 max-w-full truncate underline-offset-2 hover:underline sm:max-w-md"
              >
                {source.url.replace(/^https?:\/\//, '')}
              </a>
              <span className="text-zinc-500">{source.items} 筆</span>
              {source.error && (
                <span className="min-w-0 max-w-full truncate text-amber-700 dark:text-amber-400 sm:max-w-sm" title={source.error}>
                  {source.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-zinc-500">尚未設定議題／專題入口。</p>
      )}
    </div>
  );
}
