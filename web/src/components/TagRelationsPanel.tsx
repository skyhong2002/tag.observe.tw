import Link from 'next/link';
import type { TagRelations, TagRelationType } from '@/lib/api';
import TagRelationSubmission from './reader/TagRelationSubmission';

const TYPES: { type: TagRelationType; label: string; description: string }[] = [
  { type: 'is-a', label: '上位分類', description: '這個標籤屬於哪些類別，可同時屬於多個分類。' },
  { type: 'related', label: '相關詞', description: '具有明確關聯的關鍵字。' },
  { type: 'alias', label: '同義與別名', description: '指向同一事物的其他名稱。' },
];

export default function TagRelationsPanel({ tag, data }: { tag: string; data: TagRelations | null }) {
  return (
    <section
      id="tag-relations"
      aria-labelledby="tag-relations-title"
      className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tag-relations-title" className="text-lg font-semibold">
          標籤關係
        </h2>
        <Link
          prefetch={false}
          href={`/tag/${encodeURIComponent(tag)}/picture/`}
          className="inline-flex min-h-11 items-center text-sm text-brand-700 underline dark:text-brand-400"
        >
          提供相關圖片
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">依共用分類與審核通過的投稿整理；報導中一起出現的詞另列於共現統計。</p>
      {data ? (
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          {TYPES.map(({ type, label, description }) => {
            const entries = data.relations.filter((r) => r.type === type);
            return (
              <div key={type} className="min-w-0">
                <dt className="text-sm font-semibold" title={description}>
                  {label}
                </dt>
                <dd className="mt-2">
                  {entries.length ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {entries.map((r) => (
                        <li key={r.id} className="max-w-full">
                          <Link
                            prefetch={false}
                            href={r.target.href}
                            className="inline-flex min-h-11 max-w-full items-center gap-1 break-words rounded-full border border-zinc-300 px-3 text-sm text-brand-700 hover:border-brand-600 dark:border-zinc-700 dark:text-brand-400"
                          >
                            <span className="min-w-0 break-words">{r.target.label}</span>
                            {r.inherited && <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">（上層）</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">尚未收錄</p>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">標籤關係暫時無法載入，請稍後再試。</p>
      )}
      {data?.truncated && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">關係較多，目前僅列出部分已核准關係。</p>}
      <TagRelationSubmission key={tag} tag={tag} />
    </section>
  );
}
