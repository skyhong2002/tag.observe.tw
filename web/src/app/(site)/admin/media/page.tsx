import type { Metadata } from 'next';
import { Suspense } from 'react';
import SectionTabs from '@/components/SectionTabs';
import MediaEditor from './MediaEditor';

export const metadata: Metadata = { title: '媒體設定 · 管理後台', robots: { index: false } };

// Every outlet with its labels; /admin/media/?media=… edits one, and the
// 「設定這家媒體」 bookmarklet lands on /admin/media/?url=….
export default function AdminMediaPage() {
  return (
    <div className="space-y-5">
      <SectionTabs here="/admin/media/" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">媒體設定</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">每家媒體的標籤、單篇文章的標籤和署名，以及手動跑爬蟲。</p>
      </header>
      <Suspense fallback={<p className="text-sm text-zinc-600 dark:text-zinc-400">載入中…</p>}>
        <MediaEditor />
      </Suspense>
    </div>
  );
}
