'use client';
import { type ComponentProps, lazy } from 'react';
import DeferredChart from '@/components/DeferredChart';

const Chart = lazy(() => import('./DailyBarsCanvas'));
export default function DailyBars({
  label,
  className = 'h-56 w-full',
  ...props
}: ComponentProps<typeof Chart> & { label: string; className?: string }) {
  return (
    <DeferredChart className={className} label={label}>
      <Chart {...props} />
    </DeferredChart>
  );
}
