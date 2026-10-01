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
    const labels = points.map((p) =>
      new Date(p.t).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit' }),
    );
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['分數', '篇數'], top: 0 },
      grid: { left: 40, right: 40, top: 30, bottom: 30 },
      xAxis: { type: 'category', data: labels, axisLabel: { interval: Math.max(0, Math.floor(points.length / 8) - 1) } },
      yAxis: [
        { type: 'value', name: '分數', min: 0 },
        { type: 'value', name: '篇數', min: 0 },
      ],
      series: [
        {
          name: '分數',
          type: 'line',
          smooth: true,
          symbol: 'none',
          data: points.map((p) => Number(p.score.toFixed(2))),
          lineStyle: { width: 2, color: '#c2410c' },
          areaStyle: { color: '#c2410c', opacity: 0.1 },
        },
        { name: '篇數', type: 'bar', yAxisIndex: 1, data: points.map((p) => p.count), itemStyle: { color: '#a1a1aa', opacity: 0.6 } },
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [points]);
  return <div ref={ref} className="h-72 w-full" role="img" aria-label="標籤分數與篇數趨勢" />;
}
