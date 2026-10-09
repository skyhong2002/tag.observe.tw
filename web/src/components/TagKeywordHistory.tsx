'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  flowVisibleRange,
  KEYWORD_GROUP_SIZE,
  prependTagFlow,
  settledKeywordOrder,
  type TagFlow,
  tagFlowTimeline,
  visibleFlowKeywords,
} from '@/lib/tag-flow-history.mts';

const LEAD = 128;
const GUTTER = 48;

export default function TagKeywordHistory({ initial }: { initial: TagFlow }) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(KEYWORD_GROUP_SIZE);
  const [added, setAdded] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState({ left: GUTTER, width: 1108, columnWidth: initial.span === 'day' ? 70 : 28 });
  const scroller = useRef<HTMLElement>(null);
  const fetching = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const previousLeft = useRef(0);
  const anchor = useRef<{ width: number; left: number } | null>(null);
  const initialized = useRef(false);
  const geometry = useRef({ width: view.columnWidth, atEnd: true });
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealRow = useRef<number | null>(null);
  const columns = useMemo(() => {
    const timeline = tagFlowTimeline(data);
    const counts = new Map(data.points.map((point) => [point.t, point.count]));
    for (const column of timeline) {
      const count = counts.get(column.key);
      if (count && count > 0) column.tags.set(data.tag, count);
    }
    return timeline;
  }, [data]);
  const [order, setOrder] = useState(() => {
    const initialColumns = tagFlowTimeline(initial);
    return visibleFlowKeywords(initialColumns, 0, initialColumns.length, '');
  });
  const range = flowVisibleRange(view.left, view.width, view.columnWidth, columns.length);
  const terms = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return order.filter((tag) => tag !== data.tag && (!needle || tag.toLocaleLowerCase().includes(needle)));
  }, [data.tag, order, search]);
  const visibleRelatedTerms = terms.slice(0, visibleCount);
  const visibleTerms = [data.tag, ...visibleRelatedTerms];
  const renderStart = Math.max(0, range.start - 2);
  const renderEnd = Math.min(columns.length, range.end + 2);
  const rendered = columns.slice(renderStart, renderEnd);
  const peak = Math.max(1, ...columns.slice(range.start, range.end).flatMap((column) => [...column.tags.values()]));
  const first = useMemo(() => {
    const out = new Map<string, number>();
    columns.forEach((column, i) => {
      for (const tag of column.tags.keys()) if (!out.has(tag)) out.set(tag, i);
    });
    return out;
  }, [columns]);
  const updateView = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const columnWidth = initial.span === 'day' ? Math.max(56, (el.clientWidth - LEAD) / 14) : 28;
    setView({ left: el.scrollLeft, width: el.clientWidth, columnWidth });
  }, [initial.span]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || columns.length === 0) return;
    if (!initialized.current) {
      el.scrollLeft = el.scrollWidth;
      initialized.current = true;
    } else if (anchor.current) {
      el.scrollLeft = anchor.current.left + el.scrollWidth - anchor.current.width;
      anchor.current = null;
    } else if (geometry.current.width !== view.columnWidth) {
      // Keep the same date when the responsive cell width changes.
      el.scrollLeft = geometry.current.atEnd
        ? el.scrollWidth
        : GUTTER + ((el.scrollLeft - GUTTER) * view.columnWidth) / geometry.current.width;
    }
    geometry.current = { width: view.columnWidth, atEnd: el.scrollLeft >= el.scrollWidth - el.clientWidth - 1 };
    previousLeft.current = el.scrollLeft;
    updateView();
  }, [columns.length, updateView, view.columnWidth]);

  useLayoutEffect(() => {
    if (revealRow.current === null || !scroller.current || visibleCount <= revealRow.current) return;
    scroller.current.scrollTop = Math.max(0, 40 + revealRow.current * 32 - 32);
    revealRow.current = null;
  }, [visibleCount]);

  useEffect(() => {
    if (!ready || loading) return;
    settleTimer.current = setTimeout(() => {
      const stopped = flowVisibleRange(view.left, view.width, view.columnWidth, columns.length);
      const ranked = visibleFlowKeywords(columns, stopped.start, stopped.end, '').filter((tag) => tag !== data.tag);
      setOrder((previous) => settledKeywordOrder(previous, ranked, visibleCount));
    }, 1000);
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [ready, loading, columns, data.tag, view.left, view.width, view.columnWidth, visibleCount]);

  useEffect(() => {
    if (!added.length) return;
    const timer = setTimeout(() => setAdded([]), 2200);
    return () => clearTimeout(timer);
  }, [added]);

  useEffect(() => {
    setReady(true);
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(updateView);
    observer.observe(el);
    return () => {
      observer.disconnect();
      controller.current?.abort();
    };
  }, [updateView]);

  const loadEarlier = useCallback(
    async (reveal = false) => {
      if (fetching.current || !data.hasMore) return;
      fetching.current = true;
      setLoading(true);
      setError(false);
      const abort = new AbortController();
      controller.current = abort;
      const timeout = setTimeout(() => abort.abort(), 12000);
      try {
        const params = new URLSearchParams({
          hours: String(initial.span === 'day' ? 336 : initial.hours),
          until: data.from,
          span: initial.span,
        });
        const response = await fetch(`/api/v1/tags/${encodeURIComponent(data.tag)}/flow?${params}`, { signal: abort.signal });
        if (!response.ok) throw new Error(`History ${response.status}`);
        const older = (await response.json()) as TagFlow;
        const combined = prependTagFlow(data, older);
        const el = scroller.current;
        if (el) {
          const addedWidth = (tagFlowTimeline(combined).length - columns.length) * view.columnWidth;
          anchor.current = { width: el.scrollWidth, left: reveal ? Math.max(GUTTER, el.scrollLeft) - addedWidth : el.scrollLeft };
        }
        setData(combined);
      } catch {
        setError(true);
      } finally {
        clearTimeout(timeout);
        fetching.current = false;
        setLoading(false);
      }
    },
    [data, initial.hours, initial.span, columns.length, view.columnWidth],
  );

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const goingLeft = el.scrollLeft < previousLeft.current;
    if (el.scrollLeft !== previousLeft.current && settleTimer.current) clearTimeout(settleTimer.current);
    geometry.current.atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
    previousLeft.current = el.scrollLeft;
    updateView();
    if (goingLeft && el.scrollLeft < GUTTER && !error) void loadEarlier();
  };

  const cellWidth = view.columnWidth;
  const more = visibleRelatedTerms.length < terms.length;
  const startDate = columns[range.start]?.title.split(' ')[0];
  const endDate = columns[range.end - 1]?.title.split(' ')[0];
  const rangeEnd = startDate?.slice(0, 4) === endDate?.slice(0, 4) ? endDate?.slice(5) : endDate;
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white [overflow-anchor:none] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadEarlier(true)}
            disabled={!ready || loading || !data.hasMore}
            className="min-h-9 text-sm font-medium text-zinc-600 hover:text-brand-700 disabled:text-zinc-400 dark:text-zinc-300 dark:hover:text-brand-400"
          >
            {loading ? '載入中…' : error ? '重試載入' : data.hasMore ? '← 更早' : '已到最早'}
          </button>
          <span className="whitespace-nowrap text-xs tabular-nums text-zinc-500" title={`${startDate} — ${endDate}`}>
            {startDate?.replaceAll('-', '/')} — {rangeEnd?.replaceAll('-', '/')}
          </span>
        </div>
        <input
          type="search"
          aria-label="搜尋圖表關鍵字"
          placeholder="搜尋關鍵字"
          value={search}
          disabled={!ready}
          onChange={(event) => {
            setSearch(event.target.value);
            setVisibleCount(KEYWORD_GROUP_SIZE);
            setAdded([]);
            if (scroller.current) scroller.current.scrollTop = 0;
          }}
          className="h-9 w-36 rounded-md border border-zinc-200 bg-transparent px-2.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 sm:w-44"
        />
      </div>
      {error && (
        <p role="status" className="px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          歷史資料載入失敗，請點「重試載入」。
        </p>
      )}
      <section
        ref={scroller}
        onScroll={onScroll}
        aria-label={`#${data.tag} 關鍵字變化時間軸`}
        aria-busy={loading}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard access to the horizontal time axis.
        tabIndex={0}
        className="overflow-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-brand-500"
        style={{ height: Math.min(680, 40 + (1 + Math.max(KEYWORD_GROUP_SIZE, visibleRelatedTerms.length)) * 32) }}
      >
        <table className="table-fixed border-collapse text-xs" style={{ width: LEAD + GUTTER + columns.length * cellWidth }}>
          <caption className="sr-only">#{data.tag} 與相關關鍵字的變化</caption>
          <colgroup>
            <col style={{ width: LEAD }} />
            <col style={{ width: GUTTER }} />
            {renderStart > 0 && <col style={{ width: renderStart * cellWidth }} />}
            {rendered.map((column) => (
              <col key={column.key} style={{ width: cellWidth }} />
            ))}
            {renderEnd < columns.length && <col style={{ width: (columns.length - renderEnd) * cellWidth }} />}
          </colgroup>
          <thead className="sticky top-0 z-20 h-10 bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th scope="col" className="sticky left-0 z-20 bg-zinc-50 px-3 text-left font-normal dark:bg-zinc-900">
                關鍵字
              </th>
              <th scope="col" className="font-normal">
                <span aria-hidden="true">←</span>
              </th>
              {renderStart > 0 && <th />}
              {rendered.map((column) => (
                <th key={column.key} scope="col" className="whitespace-nowrap font-normal tabular-nums" title={column.title}>
                  <Link href={column.href} prefetch={false} className="hover:text-brand-700 dark:hover:text-brand-400">
                    {column.label}
                  </Link>
                </th>
              ))}
              {renderEnd < columns.length && <th />}
            </tr>
          </thead>
          <tbody>
            {visibleTerms.map((tag) => (
              <tr
                key={tag}
                data-added={added.includes(tag) || undefined}
                className={`group h-8 transition-colors duration-500 ${added.includes(tag) ? 'bg-sky-50 dark:bg-sky-950/50' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}
              >
                <th
                  scope="row"
                  className={`sticky left-0 z-10 px-3 text-left font-normal ${added.includes(tag) ? 'bg-sky-50 dark:bg-sky-950' : 'bg-white group-hover:bg-zinc-50 dark:bg-zinc-900 dark:group-hover:bg-zinc-800'}`}
                >
                  <Link
                    href={`/tag/${encodeURIComponent(tag)}/`}
                    prefetch={false}
                    title={tag}
                    className={`block truncate hover:text-brand-700 dark:hover:text-brand-400 ${tag === data.tag ? 'font-medium text-brand-700 dark:text-brand-400' : 'text-zinc-700 dark:text-zinc-300'}`}
                  >
                    {tag}
                  </Link>
                </th>
                <td />
                {renderStart > 0 && <td aria-hidden="true" />}
                {rendered.map((column, i) => {
                  const index = renderStart + i;
                  const count = column.tags.get(tag);
                  const left = index > 0 && columns[index - 1].tags.has(tag);
                  const right = index + 1 < columns.length && columns[index + 1].tags.has(tag);
                  return (
                    <td key={column.key} className="px-0" title={count ? `${tag} · ${column.title} · ${count} 篇` : undefined}>
                      {count && (
                        <span
                          className={`relative block h-3 ${left ? '' : 'ml-0.5 rounded-l-full'} ${right ? '' : 'mr-0.5 rounded-r-full'} ${tag === data.tag ? 'bg-brand-600 dark:bg-brand-500' : 'bg-sky-600 dark:bg-sky-500'}`}
                          style={{ opacity: Math.max(0.14, Math.min(1, Math.sqrt(count / peak))) }}
                        >
                          {index === first.get(tag) && index > 0 && (
                            <span className="absolute -left-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-zinc-800 ring-2 ring-white dark:bg-zinc-200 dark:ring-zinc-900" />
                          )}
                        </span>
                      )}
                    </td>
                  );
                })}
                {renderEnd < columns.length && <td aria-hidden="true" />}
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleRelatedTerms.length && (
          <div role="status" className="sticky left-0 flex h-96 items-center justify-center text-sm text-zinc-500">
            {search ? '找不到符合的相關關鍵字' : '這段期間沒有共同關鍵字'}
          </div>
        )}
      </section>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 border-t border-zinc-200 px-3 text-xs dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="tabular-nums text-zinc-500">
            相關詞 {visibleRelatedTerms.length} / {terms.length}
          </span>
          {added.length > 0 && (
            <span role="status" className="text-sky-700 dark:text-sky-400">
              新增 {added.length} 個
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {visibleCount > KEYWORD_GROUP_SIZE && (
            <button
              type="button"
              onClick={() => {
                setVisibleCount(KEYWORD_GROUP_SIZE);
                setAdded([]);
                if (scroller.current) scroller.current.scrollTop = 0;
              }}
              className="min-h-9 rounded px-3 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              收合
            </button>
          )}
          <button
            type="button"
            disabled={!ready || loading || !more}
            onClick={() => {
              const next = Math.min(visibleCount + KEYWORD_GROUP_SIZE, terms.length);
              revealRow.current = visibleTerms.length;
              setAdded(terms.slice(visibleRelatedTerms.length, next));
              setVisibleCount(next);
            }}
            className="min-h-9 rounded px-3 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {more ? `顯示更多（+${Math.min(KEYWORD_GROUP_SIZE, terms.length - visibleRelatedTerms.length)}）` : '已全部顯示'}
          </button>
        </div>
      </div>
    </div>
  );
}
