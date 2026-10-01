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
  tags: Record<string, { score: number; rank: number | null }> | null;
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

const label = (iso: string) => {
  const d = new Date(Date.parse(iso) + 8 * 3600e3);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:00`;
};

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
}: {
  points: EventSeriesPoint[];
  tags: string[];
  /** The event's own span, shaded on both panels. */
  active: { from: string; to: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = useDark();
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const ink = dark ? '#a1a1aa' : '#71717a',
      grid = dark ? '#27272a' : '#f4f4f5';
    const labels = points.map((p) => label(p.t));
    const band = [[{ xAxis: label(active.from) }, { xAxis: label(active.to) }]];
    const markArea = { silent: true, itemStyle: { color: dark ? 'rgba(250,250,250,0.06)' : 'rgba(24,24,27,0.05)' }, data: band };
    const axis = (i: number) => ({
      type: 'category',
      gridIndex: i,
      data: labels,
      boundaryGap: true,
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
      axisLabel: { show: i === 1, color: ink, interval: Math.max(0, Math.floor(points.length / 8) - 1) },
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
    const right = tags.length <= 4 ? Math.min(110, 16 + 11 * Math.max(0, ...tags.map((t) => t.length))) : 16;
    const colors = TAG_COLORS[dark ? 'dark' : 'light'];
    chart.setOption({
      animation: false,
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      tooltip: {
        trigger: 'axis',
        formatter: (items: Array<{ seriesName: string; value: number; marker: string; dataIndex: number; seriesIndex: number }>) => {
          const p = points[items[0]?.dataIndex ?? 0];
          const lines = items.map((it) => {
            const rank = it.seriesIndex < tags.length ? p.tags?.[it.seriesName]?.rank : null;
            return `${it.marker}${it.seriesName}　${it.value}${rank ? `（第 ${rank} 名）` : ''}`;
          });
          return [label(p.t), ...lines].join('<br/>');
        },
      },
      legend: { top: 0, textStyle: { color: ink } },
      grid: [
        { left: 44, right: right, top: 36, height: '46%' },
        { left: 44, right: right, top: '66%', bottom: 28 },
      ],
      xAxis: [axis(0), axis(1)],
      yAxis: [yAxis(0, '標籤分數'), yAxis(1, '報導篇數')],
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
        ...CAMPS.map((c, i) => ({
          name: c.name,
          type: 'bar',
          stack: 'camp',
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 14,
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
      chart.dispose();
    };
  }, [points, tags, active, dark]);
  return <div ref={ref} className="h-96 w-full" role="img" aria-label="事件主要標籤分數與每小時報導篇數" />;
}
