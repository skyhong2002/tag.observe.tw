import Link from 'next/link';
import { fetchTagGroupList, type GroupRef } from '@/lib/api';
import { pageMetadata } from '@/lib/seo.mts';

export const revalidate = 300;
export const metadata = pageMetadata(
  '/group/',
  '標籤群組',
  '把新聞標籤歸成身分群組（政治人物、現任立委、藝人…）與主題大類（政治、體育…），比較同一群組裡誰最常上新聞。',
);

type Group = GroupRef & { parentId: number | null; tags: number };

// Groups and topics as a tree (docs/tag-groups.md); counts include subgroups.
function Tree({ groups, parentId }: { groups: Group[]; parentId: number | null }) {
  const level = groups.filter((g) => g.parentId === parentId);
  if (!level.length) return null;
  return (
    <ul className={parentId === null ? 'flex flex-wrap gap-2' : 'mt-1 ml-3 space-y-1 border-l border-zinc-200 pl-3 dark:border-zinc-800'}>
      {level.map((g) => (
        <li key={g.id} className={parentId === null ? 'min-w-40' : ''}>
          <Link href={`/group/${g.id}/`} className="hover:underline">
            {g.label}
          </Link>
          <span className="ml-1 text-xs tabular-nums text-zinc-500">{g.tags.toLocaleString('zh-TW')}</span>
          <Tree groups={groups} parentId={g.id} />
        </li>
      ))}
    </ul>
  );
}

export default async function GroupIndexPage() {
  const groups = await fetchTagGroupList().catch((): Group[] => []);
  return (
    <div className="space-y-8 py-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">標籤群組</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          一個標籤可以同時屬於多個群組。點進群組，比較同一群組裡的標籤最近被報導了多少。數字是群組（含子群組）裡的標籤數。
        </p>
      </div>
      {(
        [
          ['group', '身分／類型'],
          ['topic', '主題大類'],
        ] as const
      ).map(([kind, title]) => (
        <section key={kind}>
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="mt-3 text-sm">
            <Tree groups={groups.filter((g) => g.kind === kind)} parentId={null} />
          </div>
        </section>
      ))}
    </div>
  );
}
