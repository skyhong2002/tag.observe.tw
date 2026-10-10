'use client';

import { usePathname } from 'next/navigation';
import SectionTabs from './SectionTabs';

export default function FooterApiTabs() {
  const pathname = usePathname().replace(/\/$/, '');
  return (
    <SectionTabs
      label="API 文件與狀態"
      variant="footer"
      className="mb-2"
      tabs={[
        { href: '/api/', label: 'API 文件', current: pathname === '/api' },
        { href: '/api/status/', label: 'API 狀態', current: pathname === '/api/status' },
      ]}
    />
  );
}
