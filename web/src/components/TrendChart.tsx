'use client';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef, useState } from 'react';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
const number = (value: number) => value.toLocaleString('zh-TW');
const shortDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.dataset.theme === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

type Line = { name: string; color: string; dashed: boolean; values: number[] };
export type TrendScale = 'share' | 'count';

/** Lines on top, compared articles as bars below; `share` draws each line as a percent of that day's compared articles. */
export default function TrendChart({
  days,
  lines,
  bars,
  label,
  unit,
  scale,
  barLabel = '比對篇數',
  onSelect,
}: {
  days: string[];
  lines: Line[];
  bars: Array<number | null>;
  label: string;
  /** Name of the lines' axis in counts. */
  unit: string;
  scale: TrendScale;
  /** With no lines, render the same chart as a single count panel. */
  barLabel?: string;
  onSelect?: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = useDark();
  const barOnly = lines.length === 0;
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    // On phones the legend wraps to three lines; leave room so it does not cover the axis title.
    const narrow = ref.current.clientWidth < 520;
    const ink = dark ? '#a1a1aa' : '#71717a',
      grid = dark ? '#27272a' : '#f4f4f5',
      surface = dark ? '#18181b' : '#ffffff';
    const axis = (i: number) => ({
      type: 'category',
      gridIndex: i,
      data: days.map(shortDay),
      boundaryGap: true,
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
      axisLabel: { show: barOnly || i === 1, color: ink, hideOverlap: true },
    });
    const yAxis = (i: number, name: string) => ({
      type: 'value',
      gridIndex: i,
      min: 0,
      ...(i === 0 && scale === 'share' ? {} : { minInterval: 1 }),
      // The lower panel is short: two intervals keep its labels apart.
      splitNumber: i === 1 ? 2 : narrow ? 3 : 5,
      name,
      nameTextStyle: { color: ink, align: 'left' },
      axisLabel: { color: ink, ...(i === 0 && scale === 'share' ? { formatter: '{value}%' } : {}) },
      splitLine: { lineStyle: { color: grid } },
    });
    chart.setOption({
      animation: false,
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: surface,
        borderColor: grid,
        textStyle: { color: dark ? '#e4e4e7' : '#27272a' },
        formatter: (items: Array<{ seriesName: string; seriesIndex: number; marker: string; dataIndex: number }>) => {
          if (!items.length) return '';
          const day = items[0].dataIndex;
          return [
            days[day],
            ...items.map((it) => {
              const line = lines[it.seriesIndex];
              if (!line) return `${it.marker}${it.seriesName}　${bars[day] === null ? '尚未回看' : number(bars[day] ?? 0)}`;
              const count = line.values[day] ?? 0;
              return `${it.marker}${it.seriesName}　${bars[day] ? `${Math.round((count / (bars[day] ?? 1)) * 100)}%（${number(count)}）` : number(count)}`;
            }),
          ].join('<br/>');
        },
      },
      legend: { top: 0, left: 0, textStyle: { color: ink }, inactiveColor: ink, data: [...lines.map((s) => s.name), barLabel] },
      grid: barOnly
        ? [{ left: 48, right: 24, top: 56, bottom: 30 }]
        : [
            { left: 48, right: 24, top: narrow ? 104 : 64, height: narrow ? '40%' : '46%' },
            { left: 48, right: 24, top: narrow ? '78%' : '72%', bottom: 26 },
          ],
      xAxis: barOnly ? [axis(0)] : [axis(0), axis(1)],
      yAxis: barOnly ? [yAxis(0, unit)] : [yAxis(0, scale === 'share' ? '÷ 比對篇數' : unit), yAxis(1, barLabel)],
      series: [
        ...lines.map((s) => ({
          name: s.name,
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbol: 'none',
          color: s.color,
          lineStyle: { width: 2, type: s.dashed ? 'dashed' : 'solid' },
          emphasis: { focus: 'series' },
          // A day without compared articles has no share; leave a gap rather than a false zero.
          data: scale === 'share' ? s.values.map((n, i) => (bars[i] ? Math.round((n / (bars[i] ?? 1)) * 1000) / 10 : null)) : s.values,
        })),
        {
          name: barLabel,
          type: 'bar',
          xAxisIndex: barOnly ? 0 : 1,
          yAxisIndex: barOnly ? 0 : 1,
          barMaxWidth: 14,
          color: dark ? '#71717a' : '#a1a1aa',
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          data: bars,
        },
      ],
    });
    if (onSelect)
      chart.on('click', (params) => {
        if (Number.isInteger(params.dataIndex) && bars[params.dataIndex] !== null) onSelect(params.dataIndex);
      });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [days, lines, bars, unit, scale, dark, barOnly, barLabel, onSelect]);
  return <div ref={ref} className="h-96 w-full" role="img" aria-label={label} />;
}
