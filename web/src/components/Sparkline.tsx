'use client';
import { LineChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

echarts.use([LineChart, GridComponent, CanvasRenderer]);

export default function Sparkline({ values, color = '#c2410c' }: { values: (number | null)[]; color?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chart.setOption({
      animation: false,
      grid: { left: 2, right: 2, top: 4, bottom: 2 },
      xAxis: { type: 'category', show: false, data: values.map((_, i) => i) },
      yAxis: { type: 'value', show: false, min: 0 },
      series: [
        {
          type: 'line',
          data: values,
          smooth: false,
          symbol: 'none',
          lineStyle: { width: 1.5, color },
          areaStyle: { color, opacity: 0.12 },
        },
      ],
    });
    return () => chart.dispose();
  }, [values, color]);
  return <div ref={ref} className="h-8 w-24" aria-hidden />;
}
