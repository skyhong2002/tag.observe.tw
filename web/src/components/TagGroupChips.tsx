import Link from 'next/link';
import type React from 'react';
import type { TagGroupRef, TagRelation } from '@/lib/api';

// The groups a tag is filed under (docs/tag-groups.md): identity groups
// (政治人物、現任立委…) first, then topics (政治、體育…) in a lighter style.
// Groups above a subgroup the tag is in are listed too. Each links to the
// group's comparison page. Relations readers established that are not one of
// those groups (相關詞、別名、a tag as a category) follow, then `after`
// (「改關係」).

const PREFIX: Record<TagRelation['type'], string> = { 'is-a': '屬於', related: '相關', alias: '又稱' };

export default function TagGroupChips({
  groups,
  relations = [],
  after,
}: {
  groups: TagGroupRef[];
  relations?: TagRelation[];
  after?: React.ReactNode;
}) {
  const ordered = [...groups.filter((g) => g.kind === 'group'), ...groups.filter((g) => g.kind === 'topic')];
  const shown = new Set(groups.map((g) => `group:${g.id}`));
  const extra = relations.filter((r) => !shown.has(r.target.id));
  if (!ordered.length && !extra.length && !after) return null;
  return (
    <ul className="flex min-w-0 flex-wrap items-center gap-1 text-xs" aria-label="標籤分類與關係">
      {ordered.map((g) => (
        <li key={g.id}>
          <Link
            prefetch={false}
            href={`/group/${g.id}/`}
            className={`block rounded-full px-2 py-0.5 hover:underline ${
              g.kind === 'group'
                ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                : 'border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400'
            }`}
          >
            {g.label}
          </Link>
        </li>
      ))}
      {extra.map((r) => (
        <li key={r.id} className="min-w-0 max-w-full">
          <Link
            prefetch={false}
            href={r.target.href}
            className="flex min-w-0 max-w-full items-baseline gap-1 rounded-full border border-zinc-300 px-2 py-0.5 text-brand-800 hover:underline dark:border-zinc-700 dark:text-brand-300"
          >
            <span className="shrink-0 text-zinc-600 dark:text-zinc-400">{PREFIX[r.type]}</span>
            <span className="min-w-0 break-words">{r.target.label}</span>
            {r.inherited && <span className="shrink-0 text-zinc-600 dark:text-zinc-400">（上層）</span>}
          </Link>
        </li>
      ))}
      {after && <li className="ml-1">{after}</li>}
    </ul>
  );
}
