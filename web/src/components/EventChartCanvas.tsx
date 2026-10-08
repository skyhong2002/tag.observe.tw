'use client';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkAreaComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef, useState } from 'react';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent, CanvasRenderer]);

export interface EventSeriesPoint {
  t: string;
  blue: number;
  green: number;
  other: number;
  tags: Record<string, { score: number | null; rank: number | null }> | null;
}
// Tag lines skip the blue/green hues, which belong to the camps in the bars.
const TAG_COLORS = {
  light: ['#eb6834', '#4a3aa7', '#e87ba4', '#eda100', '#1baf7a', '#e34948'],
  dark: ['#d95926', '#9085e9', '#d55181', '#c98500', '#199e70', '#e66767'],
};
const CAMPS = [
  { key: 'blue', name: '藍營傾向', light: '#2563eb', dark: '#3b82f6' },
  { key: 'green', name: '綠營傾向', light: '#059669', dark: '#10b981' },
  { key: 'other', name: '其他媒體', light: '#a1a1aa', dark: '#71717a' },
] as const;

const label = (iso: string, span: 'day' | 'hour' = 'hour') => {
  const d = new Date(Date.parse(iso) + 8 * 3600e3);
  return span === 'day'
    ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${'日一二三四五六'[d.getUTCDay()]}）`
    : `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:00`;
};
/** Start of the Taipei day holding `ms`. */
const dayStart = (ms: number) => Math.floor((ms + 8 * 3600e3) / 864e5) * 864e5 - 8 * 3600e3;

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.dataset.theme === 'dark');
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export default function EventChart({
  points,
  tags,
  active,
  ranks,
  span = 'hour',
}: {
  points: EventSeriesPoint[];
  /** One point per hour, or per Taipei day (points already summed by day). */
  span?: 'day' | 'hour';
  tags: string[];
  /** The event's own span, shaded on both panels. */
  active: { from: string; to: string };
  /** Event-table rank per point (same order as `points`); null off the table. */
  ranks?: Array<number | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = useDark();
  useEffect(() => {
    const element = ref.current;
    return () => {
      if (element) echarts.getInstanceByDom(element)?.dispose();
    };
  }, []);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.getInstanceByDom(ref.current) ?? echarts.init(ref.current);
    // On a phone the legend would wrap over the axis names; keep it one
    // scrolling row, and show only as many hour labels as fit.
    const width = ref.current.clientWidth;
    const ink = dark ? '#a1a1aa' : '#71717a',
      grid = dark ? '#27272a' : '#f4f4f5';
    const fmt = (iso: string) => label(iso, span);
    const labels = points.map((p) => fmt(p.t));
    const rankData = ranks ?? points.map(() => null);
    const hasRank = rankData.some((r) => r !== null);
    const rankColor = dark ? '#38bdf8' : '#0369a1';
    // The axis stops at the last complete hour, so a thread still on the table
    // ends past it; ECharts misplaces an area whose edge is not a category.
    // Clamp both edges onto the axis, and drop the band if it falls outside.
    const first = Date.parse(points[0]?.t ?? ''),
      last = Date.parse(points.at(-1)?.t ?? '');
    // By day, the band covers the days the event touched.
    const edge = (ms: number) => (span === 'day' ? dayStart(ms) : ms);
    const from = Math.max(edge(Date.parse(active.from)), first),
      to = Math.min(edge(Date.parse(active.to)), last);
    const band = from <= to ? [[{ xAxis: fmt(new Date(from).toISOString()) }, { xAxis: fmt(new Date(to).toISOString()) }]] : [];
    const markArea = { silent: true, itemStyle: { color: dark ? 'rgba(250,250,250,0.06)' : 'rgba(24,24,27,0.05)' }, data: band };
    const axis = (i: number) => ({
      type: 'category',
      gridIndex: i,
      data: labels,
      boundaryGap: true,
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
      axisLabel: {
        show: i === 1,
        color: ink,
        hideOverlap: true,
        interval: Math.max(0, Math.ceil(points.length / Math.max(2, Math.min(8, Math.floor(width / 80)))) - 1),
      },
    });
    const yAxis = (i: number, name: string) => ({
      type: 'value',
      gridIndex: i,
      min: 0,
      name,
      nameTextStyle: { color: ink, align: 'left' },
      axisLabel: { color: ink },
      splitLine: { lineStyle: { color: grid } },
      minInterval: i === 1 ? 1 : undefined,
    });
    // Room for the direct labels at the end of each tag line.
    const right = (tags.length <= 4 ? Math.min(110, 16 + 11 * Math.max(0, ...tags.map((t) => t.length))) : 16) + (hasRank ? 40 : 0);
    const colors = TAG_COLORS[dark ? 'dark' : 'light'];
    chart.setOption({
      animation: false,
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      tooltip: {
        trigger: 'axis',
        formatter: (items: Array<{ seriesName: string; value: number; marker: string; dataIndex: number; seriesIndex: number }>) => {
          const p = points[items[0]?.dataIndex ?? 0];
          const lines = items.map((it) => {
            if (it.seriesName === '事件表名次')
              return `${it.marker}事件表${span === 'day' ? '當天最高' : ''}名次　${it.value == null ? '未上榜' : `第 ${it.value} 名`}`;
            const rank = it.seriesIndex < tags.length ? p.tags?.[it.seriesName]?.rank : null;
            return `${it.marker}${it.seriesName}　${it.value}${rank ? `（第 ${rank} 名）` : ''}`;
          });
          return [fmt(p.t), ...lines].join('<br/>');
        },
      },
      legend: { type: 'scroll', top: 0, textStyle: { color: ink }, pageTextStyle: { color: ink } },
      grid: [
        { left: 44, right: right, top: 52, height: '42%' },
        { left: 44, right: right, top: '66%', bottom: 28 },
      ],
      xAxis: [axis(0), axis(1)],
      yAxis: [
        yAxis(0, '標籤分數'),
        yAxis(1, '報導篇數'),
        // Event-table rank on the top panel, #1 at the top; hidden when the
        // thread never charted in this window.
        {
          type: 'value',
          gridIndex: 0,
          position: 'right',
          inverse: true,
          min: 1,
          max: Math.max(10, ...rankData.filter((r): r is number => r !== null)),
          minInterval: 1,
          show: hasRank,
          name: hasRank ? '名次' : undefined,
          nameLocation: 'start',
          nameTextStyle: { color: rankColor, align: 'right' },
          axisLabel: { color: rankColor },
          axisLine: { show: false },
          splitLine: { show: false },
        },
      ],
      series: [
        ...tags.map((tag, i) => ({
          name: tag,
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbol: 'none',
          lineStyle: { width: 2 },
          color: colors[i % colors.length],
          data: points.map((p) => p.tags?.[tag]?.score ?? null),
          endLabel: { show: tags.length <= 4, formatter: tag, color: ink, fontSize: 11 },
          markArea: i === 0 ? markArea : undefined,
        })),
        ...(hasRank
          ? [
              {
                name: '事件表名次',
                type: 'line',
                xAxisIndex: 0,
                yAxisIndex: 2,
                symbol: 'circle',
                symbolSize: 4,
                connectNulls: false,
                lineStyle: { width: 1.5, color: rankColor, type: 'dashed' },
                itemStyle: { color: rankColor },
                color: rankColor,
                data: rankData,
              },
            ]
          : []),
        ...CAMPS.map((c, i) => ({
          name: c.name,
          type: 'bar',
          stack: 'camp',
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: span === 'day' ? 40 : 14,
          color: dark ? c.dark : c.light,
          itemStyle: { borderColor: dark ? '#18181b' : '#ffffff', borderWidth: 1 },
          data: points.map((p) => p[c.key]),
          markArea: i === 0 ? markArea : undefined,
        })),
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [points, tags, active, dark, ranks, span]);
  return (
    <div ref={ref} className="h-96 w-full" role="img" aria-label={`事件主要標籤分數與${span === 'day' ? '每日' : '每小時'}報導篇數`} />
  );
}
