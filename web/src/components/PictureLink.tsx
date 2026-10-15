'use client';

import { useSession } from '@/lib/session';

// 「換圖」 beside a tag's title for any signed-in reader: votes and uploads
// on /tag/{tag}/picture/ (docs/tag-pictures.md). The page stays static and
// cacheable; only a signed-in browser draws the link.
export default function PictureLink({ tag, has }: { tag: string; has: boolean }) {
  const user = useSession()?.user;
  if (!user) return null;
  return (
    <a
      href={`/tag/${encodeURIComponent(tag)}/picture/`}
      className="inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-full border border-zinc-300 px-3 text-sm text-zinc-600 hover:border-brand-600 dark:border-zinc-700 dark:text-zinc-400"
    >
      {has ? '換圖' : '加圖'}
    </a>
  );
}
