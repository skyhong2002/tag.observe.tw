'use client';
import { type ComponentProps, lazy } from 'react';
import DeferredChart from './DeferredChart';

const Chart = lazy(() => import('./EventChartCanvas'));

export type { EventSeriesPoint } from './EventChartCanvas';
export default function EventChart(props: ComponentProps<typeof Chart>) {
  return (
    <DeferredChart className="h-96 w-full" label="事件主要標籤分數與每小時報導篇數">
      <Chart {...props} />
    </DeferredChart>
  );
}
