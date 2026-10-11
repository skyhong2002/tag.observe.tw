import type { Metadata } from 'next';
import Link from 'next/link';
import TagVisualReview from './TagVisualReview';

export const metadata: Metadata = { title: '標籤圖像 · 管理後台', robots: { index: false } };

export default function AdminTagVisualsPage() {
  return (
    <div className="py-4">
      <p className="text-sm">
        <Link href="/admin/" className="text-brand-700 underline dark:text-brand-400">
          管理後台
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-bold">標籤圖像</h1>
      <TagVisualReview />
    </div>
  );
}
