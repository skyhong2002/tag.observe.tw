'use client';

import ErrorState, { type ErrorProps } from '@/components/ErrorState';

export default function SegmentError(props: ErrorProps) {
  return <ErrorState {...props} title="事件頁暫時無法載入" back={{ href: '/event/', label: '看事件表' }} />;
}
