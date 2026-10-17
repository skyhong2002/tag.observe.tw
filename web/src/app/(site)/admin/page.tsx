import type { Metadata } from 'next';
import SectionTabs from '@/components/SectionTabs';
import AdminGate from './AdminGate';
import Reports from './Reports';

export const metadata: Metadata = { title: '讀者回報 · 管理後台', robots: { index: false } };

// The admin section's first tab: the queue of readers' corrections.
export default function AdminPage() {
  return (
    <div className="space-y-5">
      <SectionTabs here="/admin/" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">讀者回報</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          讀者在文章頁按「回報錯誤」送來的修正。採納或不採納後，讀者會在自己的設定頁看到結果和你的說明。
        </p>
      </header>
      <AdminGate next="/admin/">
        <Reports />
      </AdminGate>
    </div>
  );
}
