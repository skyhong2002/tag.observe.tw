'use client';
import { type ComponentProps, lazy } from 'react';
import DeferredChart from './DeferredChart';

const Chart = lazy(() => import('./TagChartCanvas'));
export default function TagChart(props: ComponentProps<typeof Chart>) {
  return (
    <DeferredChart className="h-72 w-full" label="每小時新聞篇數與 24 小時移動平均">
      <Chart {...props} />
    </DeferredChart>
  );
}
