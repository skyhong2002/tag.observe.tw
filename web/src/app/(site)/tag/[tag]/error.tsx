'use client';

import ErrorState, { type ErrorProps } from '@/components/ErrorState';

export default function SegmentError(props: ErrorProps) {
  return <ErrorState {...props} title="關鍵字頁暫時無法載入" back={{ href: '/ranking/', label: '看關鍵字排行' }} />;
}
