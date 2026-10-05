'use client';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef, useState } from 'react';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

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

/** One measure per day; null = before tracking began (no bar). The last day can be partial. */
export default function DailyBarsCanvas({
  days,
  values,
  name,
  partialLast = false,
}: {
  days: string[];
  values: (number | null)[];
  name: string;
  partialLast?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = useDark();
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const ink = dark ? '#a1a1aa' : '#71717a',
      grid = dark ? '#27272a' : '#f4f4f5',
      bar = dark ? '#fb923c' : '#c2410c';
    const last = days.length - 1;
    chart.setOption({
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ dataIndex: number; value: number | null }>) => {
          const p = params[0];
          const label = `${days[p.dataIndex]}${partialLast && p.dataIndex === last ? '（今天，累計中）' : ''}`;
          return p.value == null ? `${label}<br>尚未開始追蹤` : `${label}<br>${name} <b>${p.value.toLocaleString('zh-TW')}</b>`;
        },
      },
      grid: { left: 8, right: 8, top: 16, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        data: days.map(shortDay),
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
        axisLabel: { color: ink, hideOverlap: true },
      },
      yAxis: { type: 'value', min: 0, minInterval: 1, axisLabel: { color: ink }, splitLine: { lineStyle: { color: grid } } },
      series: [
        {
          name,
          type: 'bar',
          barMaxWidth: 18,
          data: values.map((value, i) => ({
            value,
            itemStyle: { color: bar, opacity: partialLast && i === last ? 0.45 : 1, borderRadius: [4, 4, 0, 0] },
          })),
        },
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [days, values, name, partialLast, dark]);
  return <div ref={ref} className="h-full w-full" />;
}
