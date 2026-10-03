'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphSelection } from '@/components/SimilarityGraph';
import { nodeArticleCounts } from '@/lib/media-graph.mts';
import type { SimilarityArticle, SimilarityData } from '@/lib/similarity';

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

export default function SimilarityExplorer({ data }: { data: SimilarityData }) {
  const [mode, setMode] = useState<'all' | 'similarity' | 'citation'>('all');
  const [selection, setSelection] = useState<GraphSelection>(null);
  const [drawer, setDrawer] = useState<'settings' | 'info' | 'media' | 'evidence' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const byId = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);
  const counts = useMemo(() => nodeArticleCounts(data), [data]);
  const edges = useMemo(() => data.edges.filter((e) => mode === 'all' || e.kind === mode), [data.edges, mode]);
  const nodes = data.nodes;
  const select = (value: GraphSelection) => {
    setSelection(value);
    if (value) setDrawer('evidence');
  };
  useEffect(() => {
    if (drawer) dialog.current?.showModal();
    else dialog.current?.close();
  }, [drawer]);
  const pairs = useMemo(
    () =>
      data.pairs.filter((pair) => {
        if (!selection) return false;
        if ('node' in selection) return pair.a.media === selection.node || pair.b.media === selection.node;
        const e = selection.edge;
        if (e.kind === 'citation') return false;
        return [pair.a.media, pair.b.media].includes(e.source) && [pair.a.media, pair.b.media].includes(e.target);
      }),
    [data.pairs, selection],
  );
  const citations = useMemo(
    () =>
      data.citations.filter((c) => {
        if (!selection) return false;
        if ('node' in selection) return c.article.media === selection.node || c.source.media === selection.node;
        return selection.edge.kind === 'citation' && c.article.media === selection.edge.source && c.source.media === selection.edge.target;
      }),
    [data.citations, selection],
  );
  const title =
    drawer === 'settings'
      ? '分析設定'
      : drawer === 'info'
        ? '資料與判讀方式'
        : drawer === 'media'
          ? '媒體列表'
          : selection && 'node' in selection
            ? byId.get(selection.node)?.name
            : selection && 'edge' in selection
              ? `${byId.get(selection.edge.source)?.name} ${selection.edge.kind === 'citation' ? '→' : '↔'} ${byId.get(selection.edge.target)?.name}`
              : '文章證據';
  const selectedCounts = selection && 'node' in selection ? counts.get(selection.node) : null;

  return (
    <div className="flex h-[calc(100svh-172px)] min-h-[420px] flex-col gap-3 sm:h-[calc(100svh-112px)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">新聞關係圖</h1>
          <p className="mt-1 text-xs text-zinc-500">
            {data.hours === 168 ? '最近 7 天' : `最近 ${data.hours} 小時`} · {nodes.length} 家媒體 · {number(data.sample.analyzed)}{' '}
            篇分析樣本
          </p>
        </div>
        <div className="flex gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <button
            type="button"
            onClick={() => setDrawer('settings')}
            className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            設定
          </button>
          <button type="button" onClick={() => setDrawer('info')} className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            資料說明
          </button>
        </div>
      </header>
      <section
        aria-label="媒體關係儀表板"
        className={`${panel} flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-zinc-50/60 to-white dark:from-zinc-900 dark:to-zinc-950`}
      >
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
                onClick={() => setMode(value)}
                className={`rounded-md px-3 py-1.5 ${mode === value ? 'bg-white font-medium text-zinc-950 shadow-sm dark:bg-zinc-600 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            onClick={() => setDrawer('media')}
            className="rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:text-brand-700"
          >
            媒體列表 ↗
          </button>
        </div>
        <div className="relative min-h-0 flex-1" data-testid="media-graph-frame">
          <SimilarityGraph nodes={nodes} edges={edges} data={data} onSelect={select} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800">
          <p>
            <span className="text-orange-600 dark:text-orange-400">━ 內文相似</span>
            <span className="ml-3 text-violet-600 dark:text-violet-400">→ 引用來源</span>
            <span className="ml-3">外圍：未偵測到連線</span>
          </p>
          <p className="hidden sm:block">線越粗，篇數／配對越多 · 移到圖示查看篇數</p>
          <p className="sm:hidden">點選媒體圖示查看引用篇數與文章</p>
        </div>
      </section>
      <p className="shrink-0 text-[11px] leading-4 text-zinc-500">
        僅呈現本期已擷取樣本{data.sample.truncated ? `中的最新 ${number(data.sample.limit)} 篇` : ''}；相似不代表引用。
        {data.sample.pairsTruncated ? `相似配對顯示前 ${number(data.sample.pairLimit ?? 200)} 組。` : ''}
      </p>

      <dialog
        ref={dialog}
        onClose={() => setDrawer(null)}
        aria-labelledby="graph-drawer-title"
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-lg border-l border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 id="graph-drawer-title" className="font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => setDrawer(null)}
            className="shrink-0 rounded-md px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="關閉側欄"
          >
            關閉 ✕
          </button>
        </div>
        <div className="space-y-5 p-4">
          {drawer === 'settings' && (
            <form action="/similarity/" method="get" className="space-y-5">
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
          {drawer === 'media' && (
            <div className="space-y-2">
              <p className="text-xs leading-6 text-zinc-500">可用鍵盤選取媒體；篇數皆依本期證據文章去重。</p>
              {data.nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => select({ node: node.id })}
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
          )}
          {drawer === 'evidence' && (
            <>
              {selection && 'node' in selection && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">{byId.get(selection.node)?.country} · 本期樣本，依文章去重計數</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {[
                      [selectedCounts?.outgoing ?? 0, '引用其他媒體'],
                      [selectedCounts?.incoming ?? 0, '被其他媒體引用'],
                      [selectedCounts?.similar ?? 0, '內文相近'],
                    ].map(([n, label]) => (
                      <div key={label} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
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
              <h3 className="text-sm font-semibold">明示引用 · {citations.length} 筆關係</h3>
              {!citations.length && <p className="text-xs text-zinc-500">本期樣本未辨識到明示引用，原始來源仍未知。</p>}
              {citations.map((c) => (
                <article
                  key={`${c.article.id}:${c.source.media}`}
                  className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <p className="text-xs text-violet-600 dark:text-violet-400">
                    {c.article.mediaTitle} → {c.source.name} · {c.source.country}
                  </p>
                  <Link href={`/article/${c.article.id}/`} className="block text-sm font-medium leading-6 hover:underline">
                    {c.article.title}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {c.article.authors.join('、') || '未取得署名'} · {taipei(c.article.publishedAt)}
                  </p>
                  <blockquote className="border-l-2 border-violet-300 pl-3 text-xs leading-6 text-zinc-500">{c.source.evidence}</blockquote>
                </article>
              ))}
              <h3 className="text-sm font-semibold">相似內文 · {pairs.length} 組</h3>
              {!pairs.length && <p className="text-xs text-zinc-500">本期樣本沒有符合門檻的內文配對。</p>}
              {pairs.map((pair) => (
                <article key={pair.id} className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-medium text-brand-700 dark:text-brand-400">
                    {pair.kind === 'identical' ? '內文相同' : '高度相似'} · {(pair.score * 100).toFixed(1)}%
                  </p>
                  <ArticleCard article={pair.a} />
                  <ArticleCard article={pair.b} />
                  <details className="text-xs">
                    <summary className="cursor-pointer py-2">查看共同段落</summary>
                    <p className="break-all leading-6 text-zinc-500">{pair.evidence}</p>
                  </details>
                </article>
              ))}
            </>
          )}
          {drawer === 'info' && (
            <div className="space-y-5 text-sm leading-7">
              <p>
                更新於 {taipei(data.generatedAt)}（台北）。期間內有 {number(data.sample.available)} 篇可用內文，本圖分析{' '}
                {number(data.sample.analyzed)} 篇，上限 {number(data.sample.limit)} 篇。相似配對最多呈現{' '}
                {number(data.sample.pairLimit ?? 200)} 組；引用篇數也僅涵蓋這批樣本。
              </p>
              <p>
                線條粗細依引用文章數或相似配對數計算，越粗代表關係越多。箭頭由刊登媒體指向文中明示引用的來源。Hover
                的引用與被引用篇數分別依文章去重，同篇引用多家不會重複加總；各來源分項可能相加大於總篇數。
              </p>
              <p>
                外圍媒體在目前顯示條件下未偵測到連線，仍可點選查看樣本與內文。相似線表示正文文字重疊，不能推論引用方向或原始作者。國別是媒體所屬地區，不是事件發生地。
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
      </dialog>
    </div>
  );
}
