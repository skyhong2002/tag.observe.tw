'use client';
import { LineChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

echarts.use([LineChart, GridComponent, CanvasRenderer]);

export default function Sparkline({
  values,
  color = '#c2410c',
  rank = false,
  className = 'h-8 w-24',
}: {
  values: (number | null)[];
  color?: string;
  /** Plot as a rank: 1 at the top, gaps where the value is null. */
  rank?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chart.setOption({
      animation: false,
      grid: { left: 2, right: 2, top: 4, bottom: 2 },
      xAxis: { type: 'category', show: false, data: values.map((_, i) => i) },
      yAxis: rank
        ? { type: 'value', show: false, inverse: true, min: 1, max: Math.max(10, ...values.filter((v): v is number => v !== null)) }
        : { type: 'value', show: false, min: 0 },
      series: [
        {
          type: 'line',
          data: values,
          smooth: false,
          symbol: rank ? 'circle' : 'none',
          symbolSize: 4,
          showSymbol: rank,
          connectNulls: false,
          lineStyle: { width: rank ? 2 : 1.5, color },
          itemStyle: { color },
          ...(rank ? {} : { areaStyle: { color, opacity: 0.12 } }),
        },
      ],
    });
    return () => chart.dispose();
  }, [values, color, rank]);
  return <div ref={ref} className={className} aria-hidden />;
}
