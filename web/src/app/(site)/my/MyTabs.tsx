'use client';

import { usePathname } from 'next/navigation';
import SectionTabs from '@/components/SectionTabs';

// The layout cannot see which /my/ page it wraps, so the tabs read the path.
export default function MyTabs() {
  const path = usePathname();
  return <SectionTabs here={path.endsWith('/') ? path : `${path}/`} className="mt-4" />;
}
