import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import MediaEditor from './MediaEditor';

export const metadata: Metadata = { title: '媒體設定 · 管理後台', robots: { index: false } };

// Landing page of the 「設定這家媒體」 bookmarklet (/admin/media/?url=…), or
// /admin/media/?media=… from the outlet list on /admin/.
export default function AdminMediaPage() {
  return (
    <div className="py-4">
      <p className="text-sm">
        <Link href="/admin/" className="text-brand-700 underline dark:text-brand-400">
          管理後台
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-bold">媒體設定</h1>
      <Suspense fallback={<p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">載入中…</p>}>
        <MediaEditor />
      </Suspense>
    </div>
  );
}
