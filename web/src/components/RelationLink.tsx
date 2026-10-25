'use client';

import { useSession } from '@/lib/session';

// 「改關係」 after a tag's chips for any signed-in reader, like 「換圖」 beside
// its picture: voting and proposals live on /tag/{tag}/relations/, which most
// readers never need. The page stays static; only a signed-in browser draws it.
export default function RelationLink({ tag, voting }: { tag: string; voting: number }) {
  const user = useSession()?.user;
  if (!user) return null;
  return (
    <a
      href={`/tag/${encodeURIComponent(tag)}/relations/`}
      title={voting ? `${voting} 筆投票中` : undefined}
      className="inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-full border border-zinc-300 px-3 text-sm text-zinc-600 hover:border-brand-600 dark:border-zinc-700 dark:text-zinc-400"
    >
      改關係
      {voting > 0 && (
        <span className="tabular-nums text-brand-700 dark:text-brand-400">
          · {voting}
          <span className="sr-only"> 筆投票中</span>
        </span>
      )}
    </a>
  );
}
