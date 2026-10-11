import type { TagGroupRef } from '@/lib/api';

// The groups a tag is filed under (docs/tag-groups.md): identity groups
// (政治人物、現任立委…) first, then topics (政治、體育…) in a lighter style.

export default function TagGroupChips({ groups }: { groups: TagGroupRef[] }) {
  if (!groups.length) return null;
  const ordered = [...groups.filter((g) => g.kind === 'group'), ...groups.filter((g) => g.kind === 'topic')];
  return (
    <ul className="flex flex-wrap gap-1 text-xs" aria-label="標籤分類">
      {ordered.map((g) => (
        <li
          key={g.id}
          className={`rounded-full px-2 py-0.5 ${
            g.kind === 'group'
              ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
              : 'border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400'
          }`}
        >
          {g.label}
        </li>
      ))}
    </ul>
  );
}
