'use client';

import ErrorState, { type ErrorProps } from '@/components/ErrorState';

export default function SegmentError(props: ErrorProps) {
  return <ErrorState {...props} title="媒體頁暫時無法載入" />;
}
