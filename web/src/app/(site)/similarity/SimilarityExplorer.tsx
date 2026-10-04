'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import MediaGraphLoading from '@/components/MediaGraphLoading';
import MediaHoverLink from '@/components/MediaHoverLink';
import { type CitationDirection, type GraphSelection, highlightedRelationship } from '@/lib/graph-evidence.mts';
import { availableGraphTags, filterGraphMedia, type GraphFilters, graphEvidenceScope, type MediaTag } from '@/lib/graph-filters.mts';
import { type MediaCamps, mainGraphEdges, nodeArticleCounts } from '@/lib/media-graph.mts';
import {
  type EvidenceQuery,
  fetchEvidence,
  MAX_RANGE_DAYS,
  PERIOD_HOURS,
  periodQuery,
  type SimilarityArticle,
  type SimilarityData,
  type SimilarityEvidence,
  type SimilarityPeriod,
} from '@/lib/similarity';
import { evidenceItems, type StoryOrigin } from '@/lib/story-origins.mts';
import { hoursLabel, number, periodLabel, taipei } from './format';
import MediaComparison from './MediaComparison';
import SimilarityTabs from './SimilarityTabs';

const views = [
  ['media', '媒體總覽'],
  ['evidence', '新聞對照'],
] as const;
type View = (typeof views)[number][0];

const SimilarityGraph = dynamic(() => import('@/components/SimilarityGraph'), {
  ssr: false,
  loading: () => <MediaGraphLoading />,
});
const panel = 'rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const control = 'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950';
const inlineControl = 'rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950';
const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';
const taipeiDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 10);
const campOptions = [
  ['all', '全部'],
  ['blue', '只看藍'],
  ['green', '只看綠'],
  ['other', '未列藍綠'],
] as const;
const rangeDays = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400e3) + 1;

/** One article on one line: outlet, headline, time and byline. */
function ArticleLine({ article, badge, dim = false }: { article: SimilarityArticle; badge?: string; dim?: boolean }) {
  const when = Number.isFinite(Date.parse(article.publishedAt)) ? taipei(article.publishedAt) : '刊登時間未取得';
  return (
    <div className={`flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 ${dim ? 'text-zinc-600 dark:text-zinc-400' : ''}`}>
      <span className="flex shrink-0 items-baseline gap-1.5 text-xs">
        {badge && <span className="rounded bg-zinc-200 px-1 py-px text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{badge}</span>}
        <MediaHoverLink media={article.media} className={`${linkStyle} font-medium`}>
          {article.mediaTitle}
        </MediaHoverLink>
        {article.countryCode !== 'TW' && <span className="text-zinc-500">{article.country}</span>}
      </span>
      <Link
        href={`/article/${article.id}/`}
        className="min-w-0 flex-1 basis-64 text-sm font-medium leading-6 hover:text-brand-700 dark:hover:text-brand-400"
      >
        {article.title}
      </Link>
      <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
        <time dateTime={article.publishedAt}>{when}</time>
        {article.authors.length > 0 && ` · ${article.authors.join('、')}`}{' '}
        <a href={article.url} target="_blank" rel="noopener noreferrer" className={linkStyle} title="媒體原文">
          ↗<span className="sr-only">{article.mediaTitle} 原文</span>
        </a>
      </span>
    </div>
  );
}

/** A quoted passage clamped to two lines, with a toggle only when it actually overflows. */
function Passage({ lead, text }: { lead: ReactNode; text: string }) {
  const [full, setFull] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !full) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [full]);
  return (
    <div className="flex items-start gap-3 text-xs leading-5 text-zinc-500">
      <p ref={ref} className={`min-w-0 flex-1 break-words ${full ? '' : 'line-clamp-2'}`}>
        {lead} {text}
      </p>
      {(overflows || full) && (
        <button type="button" onClick={() => setFull((value) => !value)} aria-expanded={full} className={`${linkStyle} shrink-0`}>
          {full ? '收合' : '展開'}
        </button>
      )}
    </div>
  );
}

function CitationEvidence({ article, source }: { article: SimilarityArticle; source: SimilarityArticle['attributions'][number] }) {
  return (
    <article className="min-w-0 space-y-1 py-3">
      <ArticleLine article={article} />
      <Passage
        lead={
          <span className="font-medium text-violet-700 dark:text-violet-400">
            明示引用 {source.name}（{source.country}）
          </span>
        }
        text={source.evidence}
      />
    </article>
  );
}

function OriginEvidence({ origin }: { origin: StoryOrigin }) {
  const { article, source, group, directPair } = origin;
  const [showGroup, setShowGroup] = useState(false);
  const [showPairs, setShowPairs] = useState(false);
  const toggle = `${linkStyle} underline-offset-2`;
  return (
    <article className="min-w-0 space-y-1 py-3" data-testid="story-origin" data-source-id={source.id} data-article-id={article.id}>
      <ArticleLine article={article} />
      <ArticleLine article={source} badge="來源" dim />
      {directPair ? (
        <Passage
          lead={<span className="font-medium text-brand-700 dark:text-brand-400">與來源相似 {(directPair.score * 100).toFixed(1)}%</span>}
          text={directPair.evidence}
        />
      ) : (
        <p className="text-xs leading-5 text-zinc-500">由相似配對歸入同組，直接連回共同來源；這兩篇沒有直接比對分數。</p>
      )}
      <p className="flex flex-wrap gap-x-3 text-xs leading-5 text-zinc-500">
        <span>
          同組 {group.articles.length} 篇{group.tiedFirst > 1 && `（${group.tiedFirst} 篇同時最早刊登，依固定規則選定來源）`}
        </span>
        <button type="button" onClick={() => setShowGroup((value) => !value)} aria-expanded={showGroup} className={toggle}>
          {showGroup ? '收合同組' : '同組全部新聞'}
        </button>
        <button type="button" onClick={() => setShowPairs((value) => !value)} aria-expanded={showPairs} className={toggle}>
          {showPairs ? '收合配對' : `分組依據 · ${number(group.pairCount)} 組相似配對`}
        </button>
      </p>
      {showGroup && (
        <div className="space-y-2 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950">
          <p className="text-zinc-500">完整分組包含未顯示在圖上的媒體；其他報導的箭頭都指向 {source.mediaTitle}。</p>
          <ol className="max-h-80 space-y-1 overflow-y-auto">
            {group.articles.map((member) => (
              <li key={member.id}>
                <ArticleLine article={member} badge={member.id === source.id ? '來源' : undefined} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {showPairs && (
        <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950">
          {group.pairCount > group.pairs.length && (
            <p className="text-zinc-500">
              共 {number(group.pairCount)} 組，顯示分數最高的 {number(group.pairs.length)} 組。
            </p>
          )}
          {group.pairs.map((pair) => (
            <div key={pair.id} className="space-y-0.5">
              <p>
                <Link href={`/article/${pair.a.id}/`} className={linkStyle}>
                  {pair.a.mediaTitle}
                </Link>{' '}
                ↔{' '}
                <Link href={`/article/${pair.b.id}/`} className={linkStyle}>
                  {pair.b.mediaTitle}
                </Link>{' '}
                · {(pair.score * 100).toFixed(1)}%
              </p>
              <p className="break-words leading-5 text-zinc-500">{pair.evidence}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

/** Period picker for the filter bar. */
function PeriodControls({ data }: { data: SimilarityData }) {
  const router = useRouter();
  const [period, setPeriod] = useState(data.days ? 'range' : String(data.hours ?? 48));
  const [from, setFrom] = useState(data.days?.from ?? taipeiDay(data.from));
  const [to, setTo] = useState(data.days?.to ?? taipeiDay(data.to));
  const range = period === 'range';
  const rangeError = !range
    ? ''
    : !from || !to
      ? '請選擇開始與結束日期。'
      : from > to
        ? '開始日期不能晚於結束日期。'
        : rangeDays(from, to) > MAX_RANGE_DAYS
          ? `日期範圍最多 ${MAX_RANGE_DAYS} 天。`
          : '';
  const go = (selected: SimilarityPeriod, value: number) => router.push(`/similarity/?${periodQuery(selected, value)}`);
  const submitRange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rangeError) go({ from, to }, data.threshold);
  };
  return (
    <>
      <label className="flex items-center gap-2">
        <span className="shrink-0">期間</span>
        <select
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value);
            if (event.target.value !== 'range') go({ hours: Number(event.target.value) }, data.threshold);
          }}
          className={`${inlineControl} w-36`}
        >
          {PERIOD_HOURS.map((hours) => (
            <option key={hours} value={hours}>
              最近 {hoursLabel(hours)}
            </option>
          ))}
          <option value="range">自訂日期範圍</option>
        </select>
      </label>
      {range && (
        <form onSubmit={submitRange} className="flex flex-wrap items-center gap-2" aria-label="自訂日期範圍（台北時間）">
          <input
            type="date"
            aria-label="開始日期"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
            required
            className={inlineControl}
          />
          <span aria-hidden="true">–</span>
          <input
            type="date"
            aria-label="結束日期"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
            required
            className={inlineControl}
          />
          <button type="submit" disabled={!!rangeError} className="rounded-lg bg-brand-700 px-3 py-1.5 text-white disabled:opacity-40">
            套用
          </button>
          <span className={rangeError ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'} role={rangeError ? 'alert' : undefined}>
            {rangeError || `台北時間整日，共 ${rangeDays(from, to)} 天`}
          </span>
        </form>
      )}
    </>
  );
}

/** A small dropdown panel under a filter-bar button; closes on an outside click or Escape. */
function Popover({ label, active = false, children }: { label: string; active?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      const details = ref.current;
      if (!details?.open) return;
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);
  return (
    <details ref={ref} className="relative">
      <summary
        className={`${inlineControl} flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden ${active ? 'border-brand-600 text-brand-800 dark:border-brand-500 dark:text-brand-300' : ''}`}
      >
        {label} <span aria-hidden="true">▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-72 space-y-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        {children}
      </div>
    </details>
  );
}

/** The similarity threshold, tucked under 進階. */
function ThresholdControl({ data }: { data: SimilarityData }) {
  const router = useRouter();
  const [threshold, setThreshold] = useState(String(data.threshold));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(`/similarity/?${periodQuery(data.days ?? { hours: data.hours ?? 48 }, Number(threshold))}`);
  };
  return (
    <Popover label="進階" active={data.threshold !== 0.65}>
      <form onSubmit={submit} className="space-y-2">
        <label className="block">
          內文相似度門檻
          <input
            type="number"
            min="0.5"
            max="1"
            step="0.01"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            required
            className={control}
          />
        </label>
        <p className="text-[11px] leading-5 text-zinc-500">0.5–1，預設 0.65；門檻越高，只留下內文越接近的報導。</p>
        <button type="submit" className="rounded-lg bg-brand-700 px-3 py-1.5 text-white">
          套用
        </button>
      </form>
    </Popover>
  );
}

type EvidenceState = { key: string; data: SimilarityEvidence | null; error: boolean };
const emptyEvidence: SimilarityEvidence = { total: 0, page: 0, pageSize: 20, hiddenSources: 0, items: [], articles: {}, groups: {} };

export default function SimilarityExplorer({ data, camps, tags }: { data: SimilarityData; camps: MediaCamps; tags: MediaTag[] }) {
  // Keep the tab in the URL so the browser's back button steps between tabs.
  const searchParams = useSearchParams();
  // Media pages link here with `node` to open one outlet's relationships.
  const linkedNode = searchParams.get('node');
  const [filters, setFilters] = useState<GraphFilters>(() => {
    const initial: GraphFilters = { limit: 30, camp: 'all', tag: '' };
    // A linked outlet outside the 30 largest needs the full graph to stay in scope.
    return linkedNode && !filterGraphMedia(data.nodes, data.edges, camps, tags, initial).nodes.some((node) => node.id === linkedNode)
      ? { ...initial, limit: 0 }
      : initial;
  });
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
  const [selection, setSelection] = useState<GraphSelection>(() =>
    linkedNode && data.nodes.some((node) => node.id === linkedNode) ? { node: linkedNode } : null,
  );
  const view: View = views.find(([value]) => value === searchParams.get('view'))?.[0] ?? 'media';
  const setView = (next: View) => {
    if (next === view) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'media') params.delete('view');
    else params.set('view', next);
    const search = params.toString();
    window.history.pushState(null, '', search ? `?${search}` : window.location.pathname);
  };
  const [query, setQuery] = useState('');
  const [searchText, setSearchText] = useState('');
  const applied = useRef('');
  // Search after typing pauses; the page resets together with the applied text.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (applied.current === query) return;
      applied.current = query;
      setSearchText(query);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  const [direction, setDirection] = useState<CitationDirection>('all');
  const [page, setPage] = useState(0);
  const browser = useRef<HTMLElement>(null);
  const byId = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);
  const availableTags = useMemo(
    () => availableGraphTags(data.nodes, data.edges, camps, tags, filters, mode),
    [data.nodes, data.edges, camps, tags, filters, mode],
  );
  const graph = useMemo(
    () => filterGraphMedia(data.nodes, data.edges, camps, tags, filters),
    [data.nodes, data.edges, camps, tags, filters],
  );
  const scopedData = useMemo(() => graphEvidenceScope(data, graph.nodes, graph.focus), [data, graph.nodes, graph.focus]);
  const counts = useMemo(() => nodeArticleCounts(data.nodes), [data.nodes]);
  const updateFilters = (next: Partial<GraphFilters>, nextMode = mode) => {
    setFilters((current) => {
      const updated = { ...current, ...next };
      if (
        updated.tag &&
        !availableGraphTags(data.nodes, data.edges, camps, tags, updated, nextMode).some((tag) => tag.id === updated.tag)
      ) {
        updated.tag = '';
      }
      return updated;
    });
    setSelection(null);
    setPage(0);
  };
  const updateMode = (next: typeof mode) => {
    if (filters.tag && !availableGraphTags(data.nodes, data.edges, camps, tags, filters, next).some((tag) => tag.id === filters.tag)) {
      updateFilters({}, next);
    }
    setMode(next);
    setPage(0);
  };
  const nodes = graph.nodes;
  const filterLabel =
    [
      filters.camp !== 'all' ? campOptions.find(([value]) => value === filters.camp)?.[1] : '',
      availableTags.find((tag) => tag.id === filters.tag)?.label,
    ]
      .filter(Boolean)
      .join(' · ') || '篩選';
  const edges = useMemo(() => graph.edges.filter((e) => mode === 'all' || e.kind === mode), [graph.edges, mode]);
  const overview = useMemo(() => mainGraphEdges(edges), [edges]);
  const select = (value: GraphSelection) => {
    setSelection(value);
    setPage(0);
    setView('evidence');
  };
  // One page of evidence from the full index for the media on screen; refetched when any filter changes.
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify({
    period: periodQuery(data.days ? data.days : { hours: data.hours ?? 48 }, data.threshold).toString(),
    query: {
      mode,
      node: selection && 'node' in selection ? selection.node : undefined,
      edge:
        selection && 'edge' in selection
          ? { kind: selection.edge.kind, source: selection.edge.source, target: selection.edge.target }
          : undefined,
      direction: selection && 'node' in selection ? direction : 'all',
      scope: graph.nodes.map((node) => node.id),
      focus: graph.focus ? [...graph.focus] : undefined,
      q: searchText.trim(),
      page,
    } satisfies EvidenceQuery,
    retry,
  });
  const [evidenceState, setEvidenceState] = useState<EvidenceState>({ key: '', data: null, error: false });
  useEffect(() => {
    if (view !== 'evidence') return;
    const { period, query } = JSON.parse(requestKey) as { period: string; query: EvidenceQuery };
    // An empty graph has nothing to compare; an empty scope would mean "no limit" to the API.
    if (!query.scope?.length) {
      setEvidenceState({ key: requestKey, data: { ...emptyEvidence }, error: false });
      return;
    }
    const params = new URLSearchParams(period);
    const evidencePeriod: SimilarityPeriod = params.has('hours')
      ? { hours: Number(params.get('hours')) }
      : { from: params.get('from') ?? '', to: params.get('to') ?? '' };
    const controller = new AbortController();
    fetchEvidence(evidencePeriod, Number(params.get('threshold')), query, controller.signal).then(
      (result) => setEvidenceState({ key: requestKey, data: result, error: false }),
      () => {
        if (!controller.signal.aborted) setEvidenceState((current) => ({ key: requestKey, data: current.data, error: true }));
      },
    );
    return () => controller.abort();
  }, [view, requestKey]);
  const evidence = evidenceState.data;
  const evidenceLoading = evidenceState.key !== requestKey;
  const evidenceError = !evidenceLoading && evidenceState.error;
  const evidenceList = useMemo(() => (evidence ? evidenceItems(evidence) : []), [evidence]);
  const total = evidence?.total ?? 0;
  const pageSize = evidence?.pageSize ?? 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = evidence?.page ?? 0;
  const hiddenSources = evidence?.hiddenSources ?? 0;
  const selectedTitle =
    selection && 'node' in selection
      ? byId.get(selection.node)?.name
      : selection && 'edge' in selection
        ? `${byId.get(selection.edge.source)?.name} → ${byId.get(selection.edge.target)?.name}`
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
        <header className="shrink-0 space-y-3">
          <SimilarityTabs current="graph" query={periodQuery(data.days ?? { hours: data.hours ?? 48 }, data.threshold).toString()} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">新聞關係圖</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {periodLabel(data)} · {nodes.length}／{graph.available} 家媒體 · {number(data.index.analyzed)} 篇全部比對
            </p>
          </div>
        </header>
        <section
          aria-label="媒體關係儀表板"
          className={`${panel} flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-zinc-50/60 to-white dark:from-zinc-900 dark:to-zinc-950`}
        >
          <fieldset
            aria-label="圖表篩選"
            className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
          >
            <PeriodControls data={data} />
            <label className="flex items-center gap-2">
              <span className="shrink-0">{filters.tag ? '分類媒體數' : '顯示媒體數'}</span>
              <select
                value={filters.limit}
                onChange={(event) => updateFilters({ limit: Number(event.target.value) })}
                className={`${inlineControl} w-28`}
              >
                {[10, 20, 30, 50, 100, 0].map((limit) => (
                  <option key={limit} value={limit}>
                    {limit ? `前 ${limit} 家` : '全部媒體'}
                  </option>
                ))}
              </select>
            </label>
            <Popover label={filterLabel} active={filters.camp !== 'all' || !!filters.tag}>
              <label className="block">
                藍綠分類
                <select
                  value={filters.camp}
                  onChange={(event) => updateFilters({ camp: event.target.value as GraphFilters['camp'] })}
                  className={control}
                >
                  {campOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                媒體 tag
                <select value={filters.tag} onChange={(event) => updateFilters({ tag: event.target.value })} className={control}>
                  <option value="">全部 tag</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] leading-5 text-zinc-500">
                {filters.tag
                  ? '依本期納入分析篇數排序 · 包含所選分類的直接關係對象，對象不計入分類媒體數'
                  : '依本期納入分析篇數排序 · 只列出目前有關係資料的 tag'}
              </p>
              {(filters.camp !== 'all' || filters.tag) && (
                <button
                  type="button"
                  onClick={() => updateFilters({ camp: 'all', tag: '' })}
                  className="text-brand-700 underline dark:text-brand-400"
                >
                  清除篩選
                </button>
              )}
            </Popover>
            <ThresholdControl data={data} />
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
                  onClick={() => updateMode(value)}
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
                媒體比較 ↓
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
              <span className="text-orange-600 dark:text-orange-400">→ 同組來源</span>
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
          涵蓋期間內全部已比對文章：{number(data.index.pairs)} 組相似配對、{number(data.index.citations)} 則明示引用
          {data.index.pending > 0 ? `（另有 ${number(data.index.pending)} 篇尚待比對）` : ''}；橘色箭頭統一指向同組最早刊登的來源。
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
              媒體比較
            </h2>
            <p className="mt-1 text-xs text-zinc-500">從各家媒體出發，比較相近報導、引用往來與實際新聞。</p>
          </div>
          <fieldset
            aria-label="瀏覽內容"
            className="grid w-full grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800 sm:flex sm:w-auto"
          >
            {views.map(([value, label]) => (
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
          {view === 'media' && (
            <MediaComparison
              data={scopedData}
              onSelect={(value, nextMode, nextDirection) => {
                updateMode(nextMode);
                setQuery('');
                setDirection(nextDirection);
                select(value);
              }}
            />
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
                  <select value={mode} onChange={(event) => updateMode(event.target.value as typeof mode)} className={control}>
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
                    onChange={(event) => setQuery(event.target.value)}
                    className={control}
                    placeholder="標題、媒體、作者或共同段落"
                  />
                </label>
                <label className="block text-sm">
                  {mode === 'similarity' ? '刊出先後' : '引用方向'}
                  <select
                    value={direction}
                    disabled={!selection || !('node' in selection)}
                    onChange={(event) => {
                      setDirection(event.target.value as CitationDirection);
                      setPage(0);
                    }}
                    className={`${control} disabled:opacity-40`}
                  >
                    <option value="all">{mode === 'similarity' ? '不分先後' : '所有引用方向'}</option>
                    <option value="outgoing">{mode === 'similarity' ? '同組較晚' : '引用其他媒體'}</option>
                    <option value="incoming">{mode === 'similarity' ? '同組最早' : '被其他媒體引用'}</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">{selectedTitle}</h3>
                <button
                  type="button"
                  onClick={() => {
                    select(null);
                    updateMode('all');
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
                    {byId.get(selection.node)?.country} · 本期與所有媒體的關係，依文章去重計數 ·{' '}
                    {byId.get(selection.node)?.external
                      ? '僅作為引用來源，未收錄本期內文'
                      : `已比對 ${number(byId.get(selection.node)?.articles ?? 0)} 篇（圖示大小依據）`}
                  </p>
                  <div className="grid max-w-3xl grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                    {[
                      [selectedCounts?.outgoing ?? 0, '引用其他媒體'],
                      [selectedCounts?.incoming ?? 0, '被其他媒體引用'],
                      [selectedCounts?.earliest ?? 0, '同組最早'],
                      [selectedCounts?.later ?? 0, '同組較晚'],
                    ].map(([n, label]) => (
                      <div key={label} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950">
                        <p className="mb-1 text-xl font-semibold">{number(Number(n))}</p>
                        {label}
                      </div>
                    ))}
                  </div>
                  {!byId.get(selection.node)?.external && (
                    <MediaHoverLink media={selection.node} className={`${linkStyle} inline-block text-xs`}>
                      查看這家媒體的站內報導 →
                    </MediaHoverLink>
                  )}
                </div>
              )}
              <p className="text-xs leading-6 text-zinc-500">
                相似新聞依配對分組，每組以最早刊登的一篇作為來源；其他報導全部直接指向它。來源依本期全部相似配對與刊登時間指定；下方只列圖上媒體之間的關係。
              </p>
              {hiddenSources > 0 && (
                <p className="text-xs leading-6 text-zinc-500">
                  有 {hiddenSources} 篇報導的來源媒體未顯示，來源仍保持不變。
                  <button
                    type="button"
                    onClick={() => updateFilters({ limit: 0, camp: 'all', tag: '' })}
                    className={`${linkStyle} ml-2 underline`}
                  >
                    顯示全部媒體與來源
                  </button>
                </p>
              )}
              <p role="status" aria-live="polite" className={`text-sm text-zinc-500 ${evidenceError ? 'sr-only' : ''}`}>
                {evidenceError
                  ? '新聞對照資料載入失敗'
                  : evidenceLoading && !evidence
                    ? '載入關係證據中…'
                    : `${number(total)} 筆關係證據 · 最新在前${total ? ` · 顯示 ${number(currentPage * pageSize + 1)}–${number(Math.min(total, (currentPage + 1) * pageSize))}` : ''}${evidenceLoading ? ' · 更新中…' : ''}`}
              </p>
              {evidenceError && (
                <p role="alert" className="rounded-lg bg-zinc-50 p-6 text-sm text-zinc-500 dark:bg-zinc-950">
                  暫時無法取得新聞對照資料，請稍後再試。這不代表沒有相關文章。
                  <button type="button" onClick={() => setRetry((n) => n + 1)} className={`${linkStyle} ml-2 underline`}>
                    重新載入
                  </button>
                </p>
              )}
              {!evidenceLoading && !evidenceError && evidence && !total && (
                <p className="rounded-lg bg-zinc-50 p-6 text-sm text-zinc-500 dark:bg-zinc-950">
                  目前篩選沒有符合的文章，可調整圖上媒體數、分類或文章篩選。這不代表媒體沒有其他新聞。
                </p>
              )}
              <div
                className={`divide-y divide-zinc-200 dark:divide-zinc-800 ${evidenceLoading || evidenceError ? 'opacity-50' : ''}`}
                aria-busy={evidenceLoading}
                data-testid="graph-evidence-results"
              >
                {evidenceList.map((item) =>
                  item.kind === 'citation' ? (
                    <CitationEvidence key={item.key} article={item.citation.article} source={item.citation.source} />
                  ) : (
                    <OriginEvidence key={item.key} origin={item.origin} />
                  ),
                )}
              </div>
              {pageCount > 1 && (
                <nav aria-label="文章證據分頁" className="flex items-center justify-center gap-4 text-sm">
                  <button
                    type="button"
                    disabled={currentPage === 0 || evidenceLoading}
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
                    disabled={currentPage >= pageCount - 1 || evidenceLoading}
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
        </div>
      </section>
    </div>
  );
}
