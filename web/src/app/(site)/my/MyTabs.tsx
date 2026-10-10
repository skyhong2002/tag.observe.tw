'use client';

import { usePathname } from 'next/navigation';
import SectionTabs from '@/components/SectionTabs';

const TABS = [
  { href: '/my/', label: '我的動態' },
  { href: '/my/following/', label: '追蹤清單' },
  { href: '/my/saved/', label: '收藏' },
  { href: '/my/reading/', label: '閱讀報告' },
  { href: '/my/settings/', label: '設定' },
];

export default function MyTabs() {
  const path = usePathname();
  const here = path.endsWith('/') ? path : `${path}/`;
  return <SectionTabs label="我的新文易數" tabs={TABS.map((t) => ({ ...t, current: t.href === here }))} className="mt-4" />;
}
