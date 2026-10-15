import Link from 'next/link';
import type { TagRelations, TagRelationType } from '@/lib/api';

const TYPES: { type: TagRelationType; label: string; description: string }[] = [
  { type: 'is-a', label: '屬於', description: '上位分類：這個標籤屬於哪些類別，可同時屬於多個分類。' },
  { type: 'related', label: '相關', description: '相關詞：具有明確關聯的關鍵字。' },
  { type: 'alias', label: '又稱', description: '同義與別名：指向同一事物的其他名稱。' },
];

// Only what readers established; proposing and voting live on /tag/<tag>/relations/,
// which most readers never need (like the picture vote behind 提供相關圖片).
export default function TagRelationsPanel({ tag, data }: { tag: string; data: TagRelations | null }) {
  const base = `/tag/${encodeURIComponent(tag)}`;
  const shown = TYPES.map((t) => ({ ...t, entries: data?.relations.filter((r) => r.type === t.type) ?? [] })).filter(
    (t) => t.entries.length,
  );
  return (
    <section
      id="tag-relations"
      aria-labelledby="tag-relations-title"
      className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="tag-relations-title" className="text-lg font-semibold">
          標籤關係
        </h2>
        <span className="flex gap-3 text-sm">
          <Link
            prefetch={false}
            href={`${base}/relations/`}
            className="inline-flex min-h-11 items-center text-brand-700 underline dark:text-brand-400"
          >
            改關係
          </Link>
          <Link
            prefetch={false}
            href={`${base}/picture/`}
            className="inline-flex min-h-11 items-center text-brand-700 underline dark:text-brand-400"
          >
            換圖
          </Link>
        </span>
      </div>
      {data ? (
        shown.length ? (
          <dl className="mt-1 space-y-1">
            {shown.map(({ type, label, description, entries }) => (
              <div key={type} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <dt className="shrink-0 text-sm text-zinc-600 dark:text-zinc-400" title={description}>
                  {label}
                </dt>
                <dd className="min-w-0">
                  <ul className="flex flex-wrap gap-1.5">
                    {entries.map((r) => (
                      <li key={r.id} className="max-w-full">
                        <Link
                          prefetch={false}
                          href={r.target.href}
                          className="inline-flex min-h-9 max-w-full items-center gap-1 break-words rounded-full border border-zinc-300 px-3 text-sm text-brand-700 hover:border-brand-600 dark:border-zinc-700 dark:text-brand-400"
                        >
                          <span className="min-w-0 break-words">{r.target.label}</span>
                          {r.inherited && <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">（上層）</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">尚未收錄</p>
        )
      ) : (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">標籤關係暫時無法載入，請稍後再試。</p>
      )}
      {!!data?.voting && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Link prefetch={false} href={`${base}/relations/`} className="text-brand-700 underline dark:text-brand-400">
            {data.voting} 筆投票中
          </Link>
        </p>
      )}
      {data?.truncated && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">關係較多，目前僅列出部分。</p>}
    </section>
  );
}
