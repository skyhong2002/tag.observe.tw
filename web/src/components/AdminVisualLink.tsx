'use client';

import { useSession } from '@/lib/session';

// A 「換圖」 link beside a non-person tag's title, for admins only: it opens
// that tag in /admin/tag-visuals/ (docs/tag-visuals.md). The page stays
// static and cacheable; only an admin's browser draws the link.
export default function AdminVisualLink({ tag, has }: { tag: string; has: boolean }) {
  const admin = useSession()?.user?.role === 'admin';
  if (!admin) return null;
  return (
    <a
      href={`/admin/tag-visuals/?tag=${encodeURIComponent(tag)}`}
      className="inline-flex min-h-8 items-center rounded-full border border-zinc-300 px-3 text-sm text-zinc-600 hover:border-brand-600 dark:border-zinc-700 dark:text-zinc-400"
    >
      {has ? '換圖' : '加圖'}
    </a>
  );
}
