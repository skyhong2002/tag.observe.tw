'use client';
import { BarChart, LineChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useCallback, useEffect, useRef, useState } from 'react';
import { prependTagSeries, type TagSeries, trendRange } from '@/lib/tag-series-history.mts';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer]);

export default function TagChart({ initial }: { initial: TagSeries }) {
  const [data, setData] = useState(initial);
  const [range, setRange] = useState(() => trendRange(0, initial.hours, initial.points.length));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const current = useRef(initial);
  const view = useRef(range);
  const fetching = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const loadEarlier = useCallback(
    async (reveal = false) => {
      const existing = current.current;
      if (fetching.current || !existing.hasMore) return;
      fetching.current = true;
      setLoading(true);
      setError(false);
      const abort = new AbortController();
      controller.current = abort;
      const timeout = setTimeout(() => abort.abort(), 12000);
      try {
        const params = new URLSearchParams({ category: existing.category, hours: String(initial.hours), until: existing.from });
        const response = await fetch(`/api/v1/tags/${encodeURIComponent(existing.tag)}/series?${params}`, { signal: abort.signal });
        if (!response.ok) throw new Error(`Trend history ${response.status}`);
        const older = (await response.json()) as TagSeries;
        const combined = prependTagSeries(existing, older);
        if (abort.signal.aborted) return;
        const start = view.current.start + older.points.length - (reveal ? initial.hours : 0);
        view.current = trendRange(start, initial.hours, combined.points.length);
        current.current = combined;
        setRange(view.current);
        setData(combined);
      } catch {
        if (!abort.signal.aborted || controller.current === abort) setError(true);
      } finally {
        clearTimeout(timeout);
        fetching.current = false;
        setLoading(false);
      }
    },
    [initial.hours],
  );

  const pan = useCallback(
    (start: number) => {
      const next = trendRange(start, initial.hours, current.current.points.length);
      chartRef.current?.dispatchAction({ type: 'dataZoom', startValue: next.start, endValue: next.end });
    },
    [initial.hours],
  );

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    chart.on('datazoom', () => {
      const zoom = (chart.getOption().dataZoom as Array<{ startValue: number; endValue: number }>)[0];
      if (!zoom) return;
      view.current = trendRange(zoom.startValue, initial.hours, current.current.points.length);
      setRange(view.current);
      if (view.current.start <= 2) void loadEarlier();
    });
    const onWheel = (event: WheelEvent) => {
      if (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const delta = event.deltaX || event.deltaY;
      const step = (delta / Math.max(1, chart.getWidth() - 80)) * initial.hours;
      pan(view.current.start + Math.sign(step) * Math.max(1, Math.abs(step)));
    };
    const el = ref.current;
    el.addEventListener('wheel', onWheel, { passive: false });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    setReady(true);
    // A spare window makes the first drag work without narrowing the selected period.
    void loadEarlier();
    return () => {
      controller.current?.abort();
      controller.current = null;
      observer.disconnect();
      el.removeEventListener('wheel', onWheel);
      chart.dispose();
      chartRef.current = null;
    };
  }, [initial.hours, loadEarlier, pan]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const points = data.points;
    const hasRank = points.some((p) => p.rank !== null);
    const selected = (chart.getOption()?.legend as Array<{ selected: Record<string, boolean> }> | undefined)?.[0]?.selected ?? {
      '24 小時加權分數': false,
      名次: hasRank,
    };
    const labels = points.map((p) => {
      const d = new Date(Date.parse(p.t) + 8 * 3600e3);
      return `${d.getUTCMonth() + 1}/${d.getUTCDate()}\n${String(d.getUTCHours()).padStart(2, '0')}:00`;
    });
    chart.setOption({
      animation: false,
      tooltip: { trigger: 'axis' },
      legend: {
        type: 'scroll',
        left: 0,
        right: 0,
        data: ['每小時篇數', '24 小時移動平均', '名次', '24 小時加權分數'],
        selected,
        top: 0,
      },
      grid: { left: 40, right: hasRank ? 44 : 36, top: 55, bottom: 78 },
      xAxis: { type: 'category', data: labels, axisLabel: { hideOverlap: true } },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          startValue: view.current.start,
          endValue: view.current.end,
          rangeMode: ['value', 'value'],
          zoomLock: true,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: false,
          zoomOnMouseMove: false,
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          startValue: view.current.start,
          endValue: view.current.end,
          rangeMode: ['value', 'value'],
          zoomLock: true,
          brushSelect: false,
          showDataShadow: false,
          showDetail: false,
          height: 8,
          bottom: 8,
          borderColor: 'transparent',
          borderRadius: 4,
          backgroundColor: 'rgba(113,113,122,0.08)',
          fillerColor: 'rgba(113,113,122,0.24)',
          left: 40,
          right: 44,
          handleSize: 0,
          moveHandleSize: 0,
        },
      ],
      yAxis: [
        { type: 'value', name: '篇／小時', min: 0 },
        { type: 'value', min: 0, show: false },
        // Rank reads top-down: #1 sits at the top of the chart.
        {
          type: 'value',
          name: hasRank ? '名次' : undefined,
          nameLocation: 'start',
          inverse: true,
          min: 1,
          minInterval: 1,
          show: hasRank,
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '24 小時移動平均',
          type: 'line',
          smooth: false,
          symbol: 'none',
          data: points.map((p) => (p.average24h === null ? null : Number(p.average24h.toFixed(2)))),
          lineStyle: { width: 2, color: '#c2410c' },
          itemStyle: { color: '#c2410c' },
          areaStyle: { color: '#c2410c', opacity: 0.1 },
        },
        { name: '每小時篇數', type: 'bar', data: points.map((p) => p.hourlyCount), itemStyle: { color: '#a1a1aa', opacity: 0.6 } },
        {
          name: '名次',
          type: 'line',
          yAxisIndex: 2,
          symbol: 'circle',
          symbolSize: 4,
          connectNulls: false,
          data: points.map((p) => p.rank),
          lineStyle: { color: '#0369a1', width: 1.5 },
          itemStyle: { color: '#0369a1' },
          tooltip: { valueFormatter: (v: unknown) => (v == null ? '未入榜' : `#${v}`) },
        },
        {
          name: '24 小時加權分數',
          type: 'line',
          yAxisIndex: 1,
          symbol: 'none',
          data: points.map((p) => (p.score === null ? null : Number(p.score.toFixed(2)))),
          lineStyle: { color: '#7c3aed', width: 1 },
        },
      ],
    });
  }, [data]);

  const label = (index: number) => {
    const point = data.points[index];
    if (!point) return '';
    const date = new Date(Date.parse(point.t) + 8 * 3600e3);
    return `${date.getUTCMonth() + 1}/${date.getUTCDate()} ${String(date.getUTCHours()).padStart(2, '0')}:00`;
  };
  const atLatest = range.end === data.points.length - 1;
  return (
    <section
      aria-label={`#${data.tag} 報導趨勢時間軸`}
      aria-busy={loading}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Arrow keys pan the chart's time axis.
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const offset = {
          ArrowLeft: -Math.max(1, Math.floor(initial.hours / 4)),
          ArrowRight: Math.max(1, Math.floor(initial.hours / 4)),
          PageUp: -initial.hours,
          PageDown: initial.hours,
        }[event.key];
        if (offset !== undefined) {
          event.preventDefault();
          pan(view.current.start + offset);
        }
      }}
      className="focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 text-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!ready || loading || (!data.hasMore && range.start === 0)}
            onClick={() => (range.start > 0 ? pan(range.start - initial.hours) : void loadEarlier(true))}
            className="min-h-9 font-medium text-zinc-600 hover:text-brand-700 disabled:text-zinc-400 dark:text-zinc-300 dark:hover:text-brand-400"
          >
            {loading ? '載入中…' : error ? '重試載入' : data.hasMore || range.start > 0 ? '← 更早' : '已到資料起點'}
          </button>
          <span className="whitespace-nowrap tabular-nums text-zinc-500">
            {label(range.start)} — {label(range.end)}
          </span>
        </div>
        <button
          type="button"
          disabled={!ready || atLatest}
          onClick={() => pan(data.points.length - initial.hours)}
          className="min-h-9 text-zinc-600 hover:text-brand-700 disabled:text-zinc-400 dark:text-zinc-300 dark:hover:text-brand-400"
        >
          回到最新
        </button>
      </div>
      {error && (
        <p role="status" className="py-1 text-xs text-amber-700 dark:text-amber-400">
          歷史資料載入失敗，請點「重試載入」。
        </p>
      )}
      <div ref={ref} className="h-80 w-full" role="img" aria-label="每小時新聞篇數與 24 小時移動平均" />
    </section>
  );
}
