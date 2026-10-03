'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import SimilarityTrace from '@/components/SimilarityTrace';
import { type CitationDirection, type GraphSelection, graphEvidence, highlightedRelationship } from '@/lib/graph-evidence.mts';
import { filterGraphMedia, type GraphFilters, graphEvidenceScope, type MediaTag } from '@/lib/graph-filters.mts';
import { type MediaCamps, mainGraphEdges, nodeArticleCounts } from '@/lib/media-graph.mts';
import type { SimilarityArticle, SimilarityData, SimilarityPair } from '@/lib/similarity';
import { buildSimilarityTraceIndex, chronologySummary, pairChronology } from '@/lib/similarity-trace.mts';

const SimilarityGraph = dynamic(() => import('@/components/SimilarityGraph'), {
  ssr: false,
  loading: () => <p className="p-12 text-center text-sm text-zinc-500">正在載入媒體關係圖…</p>,
});
const panel = 'rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const control = 'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950';
const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';
const number = (value: number) => value.toLocaleString('zh-TW');
const taipei = (iso: string) => {
  const date = new Date(Date.parse(iso) + 8 * 3600_000);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}/${two(date.getUTCMonth() + 1)}/${two(date.getUTCDate())} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
};

function ArticleCard({ article, earlier }: { article: SimilarityArticle; earlier?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-950/60">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <Link href={`/media/${encodeURIComponent(article.media)}/`} className={`${linkStyle} font-medium`}>
          {article.mediaTitle}
        </Link>
        <span className="text-zinc-500">
          {article.country} · {article.countryCode}
        </span>
        {earlier && (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">較早刊登</span>
        )}
      </div>
      <h3 className="text-sm font-medium leading-6">
        <Link href={`/article/${article.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
          {article.title}
        </Link>
      </h3>
      <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
        署名：{article.authors.length ? article.authors.join('、') : '未取得'}
        <br />
        <time dateTime={article.publishedAt}>{taipei(article.publishedAt)}</time>（台北） · 正規化 {number(article.bodyLength)} 字元
      </p>
      {article.attributions.length > 0 && (
        <p className="mt-2 text-xs leading-5 text-violet-700 dark:text-violet-400">
          明示引用：{article.attributions.map((source) => `${source.name}（${source.countryCode}）`).join('、')}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <Link href={`/article/${article.id}/`} className={linkStyle}>
          站內閱讀
        </Link>
        <a href={article.url} target="_blank" rel="noopener noreferrer" className={linkStyle}>
          媒體原文 ↗
        </a>
      </div>
    </div>
  );
}

function SimilarityEvidence({ pair, index }: { pair: SimilarityPair; index: ReturnType<typeof buildSimilarityTraceIndex> }) {
  const order = pairChronology(pair);
  const [tracing, setTracing] = useState(false);
  return (
    <article className="min-w-0 space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs font-medium text-brand-700 dark:text-brand-400">
        {pair.kind === 'identical' ? '內文相同' : '高度相似'} · {(pair.score * 100).toFixed(1)}%
      </p>
      <p className="text-xs leading-6 text-zinc-500">{chronologySummary(pair)}</p>
      <ArticleCard article={order.status === 'ordered' ? order.earlier : pair.a} earlier={order.status === 'ordered'} />
      <ArticleCard article={order.status === 'ordered' ? order.later : pair.b} />
      <details className="text-xs">
        <summary className="cursor-pointer py-2">查看共同段落</summary>
        <p className="break-all leading-6 text-zinc-500">{pair.evidence}</p>
      </details>
      <button
        type="button"
        aria-expanded={tracing}
        onClick={() => setTracing(!tracing)}
        className="rounded-lg border border-orange-300 px-3 py-2 text-xs text-brand-700 dark:text-brand-400"
      >
        {tracing ? '收起來源追查' : '追查較早的相似報導'}
      </button>
      {tracing && <SimilarityTrace pair={pair} index={index} />}
    </article>
  );
}

export default function SimilarityExplorer({ data, camps, tags }: { data: SimilarityData; camps: MediaCamps; tags: MediaTag[] }) {
  const traceIndex = useMemo(() => buildSimilarityTraceIndex(data.pairs), [data.pairs]);
  const [filters, setFilters] = useState<GraphFilters>({ limit: 30, camp: 'all', tag: '' });
  const [mode, setMode] = useState<'all' | 'similarity' | 'citation'>('all');
  const [showAll, setShowAll] = useState(false);
  const dashboard = useRef<HTMLDivElement>(null);
  const fullscreenButton = useRef<HTMLElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === dashboard.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeFullscreen = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        setFullscreen(false);
        fullscreenButton.current?.focus();
      }
    };
    document.addEventListener('keydown', closeFullscreen);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', closeFullscreen);
    };
  }, [fullscreen]);
  const toggleFullscreen = async () => {
    if (fullscreen) {
      if (document.fullscreenElement === dashboard.current) await document.exitFullscreen();
      else setFullscreen(false);
      fullscreenButton.current?.focus();
    } else {
      fullscreenButton.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // iPhone and embedded browsers may not support native element fullscreen.
      try {
        await dashboard.current?.requestFullscreen();
      } catch {
        /* Use the full-window view below. */
      }
      setFullscreen(true);
    }
  };
  const [selection, setSelection] = useState<GraphSelection>(null);
  const [view, setView] = useState<'settings' | 'info' | 'media' | 'evidence'>('evidence');
  const [query, setQuery] = useState('');
  const [mediaQuery, setMediaQuery] = useState('');
  const [direction, setDirection] = useState<CitationDirection>('all');
  const [page, setPage] = useState(0);
  const browser = useRef<HTMLElement>(null);
  const byId = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);
  const graph = useMemo(
    () => filterGraphMedia(data.nodes, data.edges, camps, tags, filters),
    [data.nodes, data.edges, camps, tags, filters],
  );
  const scopedData = useMemo(() => graphEvidenceScope(data, graph.nodes), [data, graph.nodes]);
  const counts = useMemo(() => nodeArticleCounts(scopedData), [scopedData]);
  const updateFilters = (next: Partial<GraphFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
    setSelection(null);
    setPage(0);
  };
  const nodes = graph.nodes;
  const edges = useMemo(() => graph.edges.filter((e) => mode === 'all' || e.kind === mode), [graph.edges, mode]);
  const overview = useMemo(() => mainGraphEdges(edges), [edges]);
  const select = (value: GraphSelection) => {
    setSelection(value);
    setPage(0);
    setView('evidence');
  };
  const evidence = useMemo(
    () => graphEvidence(scopedData, selection, mode, query, direction),
    [scopedData, selection, mode, query, direction],
  );
  const pageCount = Math.max(1, Math.ceil(evidence.length / 20));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleEvidence = evidence.slice(currentPage * 20, (currentPage + 1) * 20);
  const media = useMemo(
    () =>
      [...graph.nodes]
        .filter((node) => `${node.name} ${node.id} ${node.country}`.toLocaleLowerCase().includes(mediaQuery.trim().toLocaleLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW')),
    [graph.nodes, mediaQuery],
  );
  const selectedTitle =
    selection && 'node' in selection
      ? byId.get(selection.node)?.name
      : selection && 'edge' in selection
        ? `${byId.get(selection.edge.source)?.name} ${selection.edge.kind === 'citation' ? '→' : '↔'} ${byId.get(selection.edge.target)?.name}`
        : '圖上全部媒體';
  const highlightedCount = selection ? edges.filter((edge) => highlightedRelationship(edge, selection)).length : 0;
  const openBrowser = () => browser.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  const selectedCounts = selection && 'node' in selection ? counts.get(selection.node) : null;

  return (
    <div
      ref={dashboard}
      data-similarity-dashboard
      data-fullscreen={fullscreen}
      className={
        fullscreen ? 'fixed inset-0 z-50 h-dvh w-full space-y-6 overflow-y-auto bg-white p-3 dark:bg-zinc-950 sm:p-4' : 'space-y-6'
      }
    >
      <div className={`flex min-h-[420px] flex-col gap-3 ${fullscreen ? 'h-[calc(100dvh-2rem)]' : 'h-[calc(100svh-112px)]'}`}>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">新聞關係圖</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {data.hours === 168 ? '最近 7 天' : `最近 ${data.hours} 小時`} · {nodes.length}／{graph.available} 家媒體 ·{' '}
              {number(data.sample.analyzed)} 篇分析樣本
            </p>
          </div>
        </header>
        <section
          aria-label="媒體關係儀表板"
          className={`${panel} flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-zinc-50/60 to-white dark:from-zinc-900 dark:to-zinc-950`}
        >
          <fieldset
            aria-label="圖上媒體篩選"
            className="grid shrink-0 grid-cols-3 gap-2 border-b border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800 sm:flex sm:items-end sm:gap-3"
          >
            <label className="min-w-0 sm:w-32">
              顯示媒體數
              <select value={filters.limit} onChange={(event) => updateFilters({ limit: Number(event.target.value) })} className={control}>
                {[10, 20, 30, 50, 100, 0].map((limit) => (
                  <option key={limit} value={limit}>
                    {limit ? `前 ${limit} 家` : '全部媒體'}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 sm:w-32">
              藍綠分類
              <select
                value={filters.camp}
                onChange={(event) => updateFilters({ camp: event.target.value as GraphFilters['camp'] })}
                className={control}
              >
                <option value="all">全部</option>
                <option value="blue">只看藍</option>
                <option value="green">只看綠</option>
                <option value="other">未列藍綠</option>
              </select>
            </label>
            <label className="min-w-0 sm:w-44">
              媒體 tag
              <select value={filters.tag} onChange={(event) => updateFilters({ tag: event.target.value })} className={control}>
                <option value="">全部 tag</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="col-span-3 text-[11px] text-zinc-500 sm:pb-2">依本期納入分析篇數排序 · 分類沿用本站標註</p>
          </fieldset>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <fieldset className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-xs dark:bg-zinc-800" aria-label="關係顯示">
              {(
                [
                  ['all', '全部關係'],
                  ['similarity', '內文相似'],
                  ['citation', '明示引用'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => {
                    setMode(value);
                    setPage(0);
                  }}
                  className={`rounded-md px-3 py-1.5 ${mode === value ? 'bg-white font-medium text-zinc-950 shadow-sm dark:bg-zinc-600 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}
                >
                  {label}
                </button>
              ))}
            </fieldset>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={showAll}
                onClick={() => setShowAll((value) => !value)}
                className="rounded-md border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700"
              >
                {showAll ? '回到主要連線' : '顯示全部連線'}
              </button>
              <button type="button" onClick={openBrowser} className="rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:text-brand-700">
                篩選與瀏覽 ↓
              </button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1" data-testid="media-graph-frame">
            <SimilarityGraph
              nodes={nodes}
              edges={edges}
              layoutEdges={graph.edges}
              camps={camps}
              data={data}
              showAll={showAll}
              onSelect={select}
              selection={selection}
              fullscreen={fullscreen}
              onToggleFullscreen={toggleFullscreen}
            />
          </div>
          <div className="flex h-16 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800 sm:h-12">
            <p>
              <span className="text-orange-600 dark:text-orange-400">━ 內文相似</span>
              <span className="ml-3 text-violet-600 dark:text-violet-400">→ 引用來源</span>
              <span className="ml-3">
                {selection
                  ? `已固定 ${selectedTitle} · 高亮 ${highlightedCount} 條`
                  : `總覽 ${showAll ? edges.length : overview.length}／${edges.length} 條`}
              </span>
            </p>
            <div className="flex items-center gap-3">
              {selection && (
                <button type="button" onClick={() => select(null)} className="underline">
                  清除選取
                </button>
              )}
              <span>移入預覽 · 點選固定 · 下方瀏覽文章</span>
            </div>
          </div>
        </section>
        <p className="shrink-0 text-[11px] leading-4 text-zinc-500">
          僅呈現本期已擷取樣本{data.sample.truncated ? `中的最新 ${number(data.sample.limit)} 篇` : ''}；相似不代表引用。
          {data.sample.pairsTruncated ? `相似配對顯示前 ${number(data.sample.pairLimit ?? 200)} 組。` : ''}
        </p>
      </div>
      <section
        ref={browser}
        id="graph-browser"
        aria-labelledby="graph-browser-title"
        className={`${panel} ${fullscreen ? 'scroll-mt-4' : 'scroll-mt-20'}`}
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <h2 id="graph-browser-title" className="text-lg font-semibold">
              篩選與瀏覽
            </h2>
            <p className="mt-1 text-xs text-zinc-500">選取圖示可固定相關連線；文章與分析資料都在這裡查看。</p>
          </div>
          <fieldset
            aria-label="瀏覽內容"
            className="grid w-full grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800 sm:flex sm:w-auto"
          >
            {(
              [
                ['evidence', '文章證據'],
                ['media', '媒體列表'],
                ['settings', '分析設定'],
                ['info', '資料說明'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`rounded-md px-3 py-2 ${view === value ? 'bg-white font-medium shadow-sm dark:bg-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}
              >
                {label}
              </button>
            ))}
          </fieldset>
        </header>
        <div className="space-y-5 p-4 sm:p-6">
          {view === 'settings' && (
            <form action="/similarity/" method="get" className="grid max-w-3xl items-end gap-5 sm:grid-cols-3">
              <label className="block text-sm">
                比較期間
                <select name="hours" defaultValue={data.hours} className={control}>
                  {[24, 48, 72, 168].map((hours) => (
                    <option key={hours} value={hours}>
                      最近 {hours === 168 ? '7 天' : `${hours} 小時`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                內文相似度門檻
                <input
                  name="threshold"
                  type="number"
                  min="0.5"
                  max="1"
                  step="0.01"
                  defaultValue={data.threshold}
                  required
                  className={control}
                />
              </label>
              <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 text-sm text-white">
                更新關係圖
              </button>
            </form>
          )}
          {view === 'media' && (
            <div className="space-y-2">
              <label className="block max-w-md text-sm">
                搜尋媒體
                <input
                  type="search"
                  value={mediaQuery}
                  onChange={(event) => setMediaQuery(event.target.value)}
                  className={control}
                  placeholder="媒體名稱或國別"
                />
              </label>
              <p className="text-xs leading-6 text-zinc-500">
                {media.length} 家圖上媒體 · 選取媒體可固定圖上連線，並瀏覽文章；篇數依本期證據文章去重。
              </p>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {media.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => select({ node: node.id })}
                    aria-pressed={!!selection && 'node' in selection && selection.node === node.id}
                    className="flex w-full items-center justify-between gap-3 rounded-lg bg-zinc-50 p-3 text-left hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    <span className="text-sm">
                      {node.name}
                      <span className="ml-2 text-xs text-zinc-500">{node.country}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs leading-5 text-zinc-500">
                      引用 {counts.get(node.id)?.outgoing ?? 0} 篇<br />
                      被引用 {counts.get(node.id)?.incoming ?? 0} 篇
                    </span>
                  </button>
                ))}
              </div>
              {!media.length && <p className="text-sm text-zinc-500">沒有符合搜尋的媒體。</p>}
            </div>
          )}
          {view === 'evidence' && (
            <>
              <div className="grid grid-cols-2 items-end gap-4 xl:grid-cols-4">
                <label className="block text-sm">
                  媒體
                  <select
                    value={selection && 'node' in selection ? selection.node : selection ? '__edge__' : ''}
                    onChange={(event) => select(event.target.value ? { node: event.target.value } : null)}
                    className={control}
                  >
                    <option value="">圖上全部媒體</option>
                    {selection && 'edge' in selection && <option value="__edge__">{selectedTitle}</option>}
                    {graph.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  關係類型
                  <select
                    value={mode}
                    onChange={(event) => {
                      setMode(event.target.value as typeof mode);
                      setPage(0);
                    }}
                    className={control}
                  >
                    <option value="all">全部關係</option>
                    <option value="similarity">內文相似</option>
                    <option value="citation">明示引用</option>
                  </select>
                </label>
                <label className="block text-sm">
                  搜尋文章
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(0);
                    }}
                    className={control}
                    placeholder="標題、媒體、作者或共同段落"
                  />
                </label>
                <label className="block text-sm">
                  引用方向
                  <select
                    value={direction}
                    disabled={!selection || !('node' in selection) || mode === 'similarity'}
                    onChange={(event) => {
                      setDirection(event.target.value as CitationDirection);
                      setPage(0);
                    }}
                    className={`${control} disabled:opacity-40`}
                  >
                    <option value="all">所有引用方向</option>
                    <option value="outgoing">引用其他媒體</option>
                    <option value="incoming">被其他媒體引用</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">{selectedTitle}</h3>
                <button
                  type="button"
                  onClick={() => {
                    select(null);
                    setMode('all');
                    setQuery('');
                    setDirection('all');
                  }}
                  className="text-sm text-brand-700 underline dark:text-brand-400"
                >
                  清除篩選
                </button>
              </div>
              {selection && 'node' in selection && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    {byId.get(selection.node)?.country} · 目前圖上媒體之間的關係，依文章去重計數 ·{' '}
                    {byId.get(selection.node)?.external
                      ? '僅作為引用來源，未收錄本期內文'
                      : `納入分析 ${number(byId.get(selection.node)?.articles ?? 0)} 篇（圖示大小依據）`}
                  </p>
                  <div className="grid max-w-3xl grid-cols-3 gap-2 text-center text-xs">
                    {[
                      [selectedCounts?.outgoing ?? 0, '引用其他媒體'],
                      [selectedCounts?.incoming ?? 0, '被其他媒體引用'],
                      [selectedCounts?.similar ?? 0, '內文相近'],
                    ].map(([n, label]) => (
                      <div key={label} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950">
                        <p className="mb-1 text-xl font-semibold">{n}</p>
                        {label}
                      </div>
                    ))}
                  </div>
                  {!byId.get(selection.node)?.external && (
                    <Link href={`/media/${encodeURIComponent(selection.node)}/`} className={`${linkStyle} inline-block text-xs`}>
                      查看這家媒體的已保存內文 →
                    </Link>
                  )}
                </div>
              )}
              <p role="status" className="text-sm text-zinc-500">
                {number(evidence.length)} 筆關係證據 · 最新在前
                {evidence.length ? ` · 顯示 ${currentPage * 20 + 1}–${Math.min(evidence.length, (currentPage + 1) * 20)}` : ''}
              </p>
              {!evidence.length && (
                <p className="rounded-lg bg-zinc-50 p-6 text-sm text-zinc-500 dark:bg-zinc-950">
                  目前篩選沒有符合的文章，可調整圖上媒體數、分類或文章篩選。這不代表媒體沒有其他新聞。
                </p>
              )}
              <div className="grid items-start gap-4 lg:grid-cols-2" data-testid="graph-evidence-results">
                {visibleEvidence.map((item) =>
                  item.kind === 'citation' ? (
                    <article key={item.key} className="min-w-0 space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                      <p className="text-xs text-violet-600 dark:text-violet-400">
                        明示引用 · {item.citation.article.mediaTitle} → {item.citation.source.name} · {item.citation.source.country}
                      </p>
                      <ArticleCard article={item.citation.article} />
                      <blockquote className="break-words border-l-2 border-violet-300 pl-3 text-xs leading-6 text-zinc-500">
                        {item.citation.source.evidence}
                      </blockquote>
                    </article>
                  ) : (
                    <SimilarityEvidence key={item.key} pair={item.pair} index={traceIndex} />
                  ),
                )}
              </div>
              {pageCount > 1 && (
                <nav aria-label="文章證據分頁" className="flex items-center justify-center gap-4 text-sm">
                  <button
                    type="button"
                    disabled={currentPage === 0}
                    onClick={() => {
                      setPage(currentPage - 1);
                      openBrowser();
                    }}
                    className="rounded-lg border border-zinc-200 px-4 py-2 disabled:opacity-40 dark:border-zinc-700"
                  >
                    上一頁
                  </button>
                  <span>
                    {currentPage + 1}／{pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === pageCount - 1}
                    onClick={() => {
                      setPage(currentPage + 1);
                      openBrowser();
                    }}
                    className="rounded-lg border border-zinc-200 px-4 py-2 disabled:opacity-40 dark:border-zinc-700"
                  >
                    下一頁
                  </button>
                </nav>
              )}
            </>
          )}
          {view === 'info' && (
            <div className="space-y-5 text-sm leading-7">
              <p>
                更新於 {taipei(data.generatedAt)}（台北）。期間內有 {number(data.sample.available)} 篇可用內文，本圖分析{' '}
                {number(data.sample.analyzed)} 篇，上限 {number(data.sample.limit)} 篇。相似配對最多呈現{' '}
                {number(data.sample.pairLimit ?? 200)} 組；引用篇數也僅涵蓋這批樣本。
              </p>
              <p>
                圖示大小依各媒體本期納入分析的新聞篇數調整，並非網站流量或總發稿量；僅被引用而未收錄內文的媒體採固定大小。線條粗細依引用文章數或相似配對數計算，越粗代表關係越多。箭頭由刊登媒體指向文中明示引用的來源，端點停在
                Logo
                外圍。縮小後沒有足夠空間的短連線暫時隱藏，放大即可查看。下方的引用與被引用篇數分別依文章去重，同篇引用多家不會重複加總；各來源分項可能相加大於總篇數。
              </p>
              <p>
                預設顯示本期納入分析篇數最多的 30 家媒體，可選前 10／20／50／100 家或全部，再搭配藍綠與媒體 tag
                篩選。先套用分類，再依篇數取前幾家；下方文章僅列出圖上媒體之間的關係。篩選後沒有彼此連線的媒體仍保留圖示，不代表沒有其他新聞。圖表顯示符合篩選的媒體，初始排版依畫面比例與圖示大小保留間距；可放大、縮小或拖曳查看細節，重設視野可回到總覽。本期完全沒有關係的媒體不放入圖中。三種關係模式共用同一批媒體與位置，只切換連線並保留視野。畫面較密時會隱藏重疊名稱，放大或選取圖示即可查看。總覽由每家媒體挑選最強的兩條連線合併而成；媒體也可能被其他家選中，因此顯示的連線可超過兩條。點選圖示可固定高亮目前模式內該媒體的全部相關連線；再次點選或按「清除選取」即可解除。固定後仍可移入其他媒體，暫時預覽它的相關媒體、連線與摘要；移入線條則高亮該連線與兩端媒體，移開後回到固定的選取。預覽不會變更下方文章篩選；平移或縮放也不會解除固定。文章、媒體列表與設定皆在圖下方瀏覽，全螢幕時也可向下捲動；「顯示全部連線」可還原目前媒體之間的全部關係。統計以本期分析樣本為限，圖上與下方只呈現目前篩選的媒體關係。媒體按連線強度自動分群排列，分群不代表媒體立場、所有權或原創來源。相似線表示正文文字重疊，不加上引用箭頭；下方可依發布時間追查較早報導，每一步保留配對相似度與共同段落。時間順序不是引用方向，最早的已收錄報導也不一定是原始作者，不能據此認定抄襲。國別是媒體所屬地區，不是事件發生地。
              </p>
              <p>
                <span className="text-blue-700 dark:text-blue-400">藍字</span>／
                <span className="text-green-700 dark:text-green-400">綠字</span>沿用網站媒體資料的既有藍／綠標註，未標註者使用一般字色。
              </p>
              <details>
                <summary className="cursor-pointer font-medium">相似度如何計算</summary>
                <p className="mt-2">
                  內文做 NFKC 正規化並移除標點、空白，以五字片段計算 Dice 相似度。至少 200 個字元、100
                  個共同片段及連續相同文字才列為候選。正規化全文相等才標為內文相同；不以標題或刊登先後推論來源。
                </p>
              </details>
              <h3 className="font-semibold">各媒體擷取狀態</h3>
              <p className="text-xs text-zinc-500">短文、擷取失敗及未處理文章會影響結果；蕃新聞的聯播內容不納入統計。</p>
              {data.coverage.map((row) => (
                <div
                  key={row.media}
                  className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-2 text-xs dark:border-zinc-800"
                >
                  <Link href={`/media/${encodeURIComponent(row.media)}/`} className={linkStyle}>
                    {row.name}
                    {row.excludedFromStatistics ? '（排除統計）' : ''}
                  </Link>
                  <span className="text-right text-zinc-500">
                    可比較 {number(row.usable)}／{number(row.total)} 篇<br />
                    缺漏 {number(row.missing)} · 待抓 {number(row.pending)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
