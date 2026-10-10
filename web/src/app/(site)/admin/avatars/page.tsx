import type { Metadata } from 'next';
import Link from 'next/link';
import AvatarReview from './AvatarReview';

export const metadata: Metadata = { title: '人物頭像 · 管理後台', robots: { index: false } };

export default function AdminAvatarsPage() {
  return (
    <div className="py-4">
      <p className="text-sm">
        <Link href="/admin/" className="text-brand-700 underline dark:text-brand-400">
          管理後台
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-bold">人物頭像</h1>
      <AvatarReview />
    </div>
  );
}
