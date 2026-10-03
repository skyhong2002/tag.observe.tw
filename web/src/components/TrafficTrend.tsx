'use client';

import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef, useState } from 'react';
import { type ComparisonOutlet, collectionPoint, shortMonth } from '@/lib/traffic-comparison.mts';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);
export const TREND_COLORS = ['#ea783b', '#608bf1', '#ae83eb', '#28a99a'];

export default function TrafficTrend({ months, outlets }: { months: string[]; outlets: ComparisonOutlet[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.dataset.theme === 'dark');
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const ink = dark ? '#a1a1aa' : '#71717a';
    const line = dark ? '#27272a' : '#e4e4e7';
    const series = outlets.flatMap((outlet, index) => [
      {
        name: `${outlet.name} · 流量`,
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        connectNulls: false,
        symbolSize: 6,
        itemStyle: { color: TREND_COLORS[index] },
        lineStyle: { width: 2 },
        data: months.map((month) => outlet.traffic.find((p) => p.month === month)?.traffic ?? null),
      },
      {
        name: `${outlet.name} · 收錄篇數`,
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        connectNulls: false,
        symbolSize: 6,
        itemStyle: { color: TREND_COLORS[index] },
        lineStyle: { width: 2 },
        data: months.map((month) => collectionPoint(outlet, month).articles),
      },
    ]);
    chart.setOption({
      animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      tooltip: {
        trigger: 'axis',
        confine: true,
        renderMode: 'richText',
        backgroundColor: dark ? '#27272a' : '#fff',
        textStyle: { color: dark ? '#f4f4f5' : '#27272a', fontSize: 12 },
        valueFormatter: (value: unknown) =>
          value == null ? '無資料' : Number(value).toLocaleString('zh-TW', { maximumFractionDigits: 7 }),
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: [
        { left: 54, right: 18, top: 32, height: 140 },
        { left: 54, right: 18, top: 246, height: 140 },
      ],
      xAxis: [0, 1].map((gridIndex) => ({
        gridIndex,
        type: 'category',
        data: months.map(shortMonth),
        boundaryGap: false,
        axisLabel: { color: ink, fontSize: 10, hideOverlap: true },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: line } },
      })),
      yAxis: [0, 1].map((gridIndex) => ({
        gridIndex,
        type: 'value',
        min: 0,
        minInterval: gridIndex === 1 ? 1 : undefined,
        name: gridIndex === 0 ? '流量（原表值）' : '本站收錄（篇）',
        nameTextStyle: { color: ink, align: 'left', padding: [0, 0, 0, 18] },
        axisLabel: { color: ink, fontSize: 10 },
        splitLine: { lineStyle: { color: line, type: 'dashed' } },
      })),
      series,
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [months, outlets, dark]);
  return (
    <div
      ref={ref}
      className="h-[420px] w-full"
      role="img"
      aria-label="共用月份軸的 Similarweb 流量與本站收錄趨勢；缺值保留空白，逐月數字可於下方展開"
    />
  );
}
