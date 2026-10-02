'use client';

import { useLinkStatus } from 'next/link';

// Swaps a <Link>'s label while its navigation is in flight, so in-page links
// like 顯示更多 don't look dead while the server renders the next page.
export default function PendingLabel({ children, pending = '載入中…' }: { children: React.ReactNode; pending?: string }) {
  const { pending: isPending } = useLinkStatus();
  return <span aria-live="polite">{isPending ? pending : children}</span>;
}
