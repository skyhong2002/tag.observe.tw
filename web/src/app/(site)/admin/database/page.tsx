import type { Metadata } from 'next';
import SectionTabs from '@/components/SectionTabs';
import AdminGate from '../AdminGate';

export const metadata: Metadata = { title: '資料庫 · 管理後台', robots: { index: false } };

// Adminer itself lives behind the gateway at /admin/db/ (app/src/admin/db-console.ts),
// signed in as the admin's own MariaDB account; this tab only explains and links.
export default function AdminDatabasePage() {
  return (
    <div className="space-y-5">
      <SectionTabs here="/admin/database/" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">資料庫</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          用 Adminer 直接查詢或修改資料。會自動以你自己的資料庫帳號登入，每一筆查詢都記在 MariaDB
          的稽核紀錄裡；沒有資料庫帳號的管理員開啟會被拒絕。
        </p>
      </header>
      <AdminGate next="/admin/database/">
        <a href="/admin/db/" className="inline-flex min-h-9 items-center rounded-full bg-brand-700 px-4 text-sm font-medium text-white">
          開啟資料庫
        </a>
      </AdminGate>
    </div>
  );
}
