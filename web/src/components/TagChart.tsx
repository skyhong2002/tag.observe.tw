'use client';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { SeriesPoint } from '@/lib/api';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export default function TagChart({ points }: { points: SeriesPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const labels = points.map((p) => {
      const d = new Date(Date.parse(p.t) + 8 * 3600e3);
      return `${d.getUTCMonth() + 1}/${d.getUTCDate()}\n${String(d.getUTCHours()).padStart(2, '0')}:00`;
    });
    const interval = () => Math.max(0, Math.ceil(points.length / Math.max(2, Math.floor((ref.current?.clientWidth ?? 300) / 110))) - 1);
    chart.setOption({
      animation: false,
      tooltip: { trigger: 'axis' },
      legend: {
        type: 'scroll',
        left: 0,
        right: 0,
        data: ['每小時篇數', '24 小時移動平均', '24 小時加權分數'],
        selected: { '24 小時加權分數': false },
        top: 0,
      },
      grid: { left: 40, right: 36, top: 55, bottom: 40 },
      xAxis: { type: 'category', data: labels, axisLabel: { interval: interval(), hideOverlap: true } },
      yAxis: [
        { type: 'value', name: '篇／小時', min: 0 },
        { type: 'value', min: 0 },
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
          name: '24 小時加權分數',
          type: 'line',
          yAxisIndex: 1,
          symbol: 'none',
          data: points.map((p) => (p.score === null ? null : Number(p.score.toFixed(2)))),
          lineStyle: { color: '#7c3aed', width: 1 },
        },
      ],
    });
    const onResize = () => {
      chart.resize();
      chart.setOption({ xAxis: { axisLabel: { interval: interval() } } });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [points]);
  return <div ref={ref} className="h-72 w-full" role="img" aria-label="每小時新聞篇數與 24 小時移動平均" />;
}
