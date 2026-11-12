'use client';

import { usePathname } from 'next/navigation';
import { METHOD_HREF } from '@/lib/site-nav';

// The only part of the footer's 資料來源與計算方式 that needs the browser: hide it on
// the full write-up itself. The blocks arrive as server-rendered children.
export default function FooterMethodGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === METHOD_HREF || `${pathname}/` === METHOD_HREF) return null;
  return children;
}
