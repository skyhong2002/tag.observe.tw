import Link from 'next/link';
import { fetchTagGroupOverview, type TagGroupSummary } from '@/lib/api';
import { pageMetadata } from '@/lib/seo.mts';

export const revalidate = 300;
export const metadata = pageMetadata(
  '/group/',
  '標籤群組',
  '把新聞標籤歸成身分群組（政治人物、現任立委、藝人…）與主題大類（政治、體育…），看每個群組最近誰最常上新聞。',
);

const DAYS = [1, 7, 30] as const;
const n = (v: number) => v.toLocaleString('zh-TW');
const tagHref = (tag: string) => `/tag/${encodeURIComponent(tag)}/`;

/** Change against the period before, worded so it reads without colour too. */
function Change({ recent, previous }: { recent: number; previous: number }) {
  const d = recent - previous;
  if (!previous) return <span className="text-zinc-500">新</span>;
  return (
    <span className={d > 0 ? 'text-red-700 dark:text-red-400' : d < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500'}>
      {d > 0 ? '▲' : d < 0 ? '▼' : '–'}
      {d ? n(Math.abs(d)) : ''}
    </span>
  );
}

// One group: its busiest tags this period as thin bars scaled to the card's top
// tag, the reports summed, and the change from the period before.
function GroupCard({ group, parents, days }: { group: TagGroupSummary; parents: string[]; days: number }) {
  const max = group.top[0]?.recent ?? 1;
  return (
    <li className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      {parents.length > 0 && <p className="text-xs text-zinc-500">{parents.join(' › ')} ›</p>}
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          <Link href={`/group/${group.id}/${days === 7 ? '' : `?days=${days}`}`} className="hover:underline">
            {group.label}
          </Link>
        </h3>
        <span className="text-xs tabular-nums whitespace-nowrap text-zinc-600 dark:text-zinc-400">
          {n(group.recent)} 篇 <Change recent={group.recent} previous={group.previous} />
        </span>
      </div>
      <p className="mt-0.5 text-xs text-zinc-500">
        {n(group.active)} 個標籤上新聞 · 共 {n(group.tags)} 個
      </p>
      <ol className="mt-3 space-y-1.5 text-sm">
        {group.top.map((t) => (
          <li key={t.tag} title={`${t.tag}：近 ${days} 天 ${n(t.recent)} 篇，前 ${days} 天 ${n(t.previous)} 篇`}>
            <div className="flex items-baseline justify-between gap-2">
              <Link href={tagHref(t.tag)} className="min-w-0 truncate hover:underline">
                {t.tag}
              </Link>
              <span className="shrink-0 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                {n(t.recent)} <Change recent={t.recent} previous={t.previous} />
              </span>
            </div>
            <div aria-hidden="true" className="mt-0.5 h-1.5 rounded-sm bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full rounded-sm bg-brand-500" style={{ width: `${Math.max(2, (t.recent / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </li>
  );
}

export default async function GroupIndexPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = DAYS.find((d) => String(d) === sp.days) ?? 7;
  const groups = await fetchTagGroupOverview(days).catch((): TagGroupSummary[] => []);
  const byId = new Map(groups.map((g) => [g.id, g]));
  const parentsOf = (g: TagGroupSummary) => {
    const out: string[] = [];
    for (let p = g.parentId; p != null && out.length < 5; p = byId.get(p)?.parentId ?? null) out.unshift(byId.get(p)?.label ?? '');
    return out;
  };
  return (
    <div className="space-y-8 py-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">標籤群組</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          新聞標籤依身分（政治人物、藝人…）與主題（政治、體育…）分組，一個標籤可以在多個群組。每張卡片是一個群組最近 {days}{' '}
          天報導最多的標籤，▲▼ 是和再之前 {days} 天相比；點群組名稱看完整排名。
        </p>
        <div className="mt-4 flex gap-1 text-sm">
          {DAYS.map((d) => (
            <Link
              key={d}
              href={d === 7 ? '/group/' : `/group/?days=${d}`}
              className={`rounded-md px-3 py-1 ${d === days ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}
            >
              {d} 天
            </Link>
          ))}
        </div>
      </div>
      {(
        [
          ['group', '身分／類型'],
          ['topic', '主題大類'],
        ] as const
      ).map(([kind, title]) => {
        const ofKind = groups.filter((g) => g.kind === kind);
        // Busiest first; groups with nothing in the news this period go to one line at the end.
        const busy = ofKind.filter((g) => g.top.length).sort((a, b) => b.recent - a.recent);
        const quiet = ofKind.filter((g) => !g.top.length);
        return (
          <section key={kind}>
            <h2 className="text-lg font-semibold">{title}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {busy.map((g) => (
                <GroupCard key={g.id} group={g} parents={parentsOf(g)} days={days} />
              ))}
            </ul>
            {quiet.length > 0 && (
              <p className="mt-3 text-sm text-zinc-500">
                最近 {days} 天沒有標籤上新聞：
                {quiet.map((g, i) => (
                  <span key={g.id}>
                    {i > 0 && '、'}
                    <Link href={`/group/${g.id}/`} className="hover:underline">
                      {g.label}
                    </Link>
                    <span className="tabular-nums">（{n(g.tags)}）</span>
                  </span>
                ))}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
