'use client';

import ErrorState, { type ErrorProps } from '@/components/ErrorState';

export default function SegmentError(props: ErrorProps) {
  return <ErrorState {...props} title="議題頁暫時無法載入" />;
}
