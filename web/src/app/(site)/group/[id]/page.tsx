import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchTagGroupRanking } from '@/lib/api';
import { pageMetadata } from '@/lib/seo.mts';
import GroupRankingTable from './GroupRankingTable';

export const revalidate = 300;
const DAYS = [1, 7, 30] as const;
type Params = { id: string };
type Search = { days?: string };

const load = (id: string, days: number) =>
  /^\d+$/.test(id) ? fetchTagGroupRanking(Number(id), days).catch(() => null) : Promise.resolve(null);

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const group = await load(id, 7);
  if (!group) return {};
  return pageMetadata(
    `/group/${group.id}/`,
    `${group.label}：標籤比較`,
    `「${group.label}」群組裡的 ${group.tags} 個標籤，依最近的報導篇數排序比較。`,
  );
}

export default async function GroupPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const days = DAYS.find((d) => String(d) === sp.days) ?? 7;
  const group = await load(id, days);
  if (!group) notFound();
  const subgroupLabel = Object.fromEntries(group.subgroups.map((g) => [g.id, g.label]));
  return (
    <div className="space-y-6 py-4">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/group/" className="hover:underline">
            標籤群組
          </Link>
          {[...group.parents].reverse().map((p) => (
            <span key={p.id}>
              {' › '}
              <Link href={`/group/${p.id}/`} className="hover:underline">
                {p.label}
              </Link>
            </span>
          ))}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{group.label}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {group.kind === 'topic' ? '主題大類' : '身分／類型群組'}，共 {group.tags.toLocaleString('zh-TW')} 個標籤
          {group.subgroups.length > 0 && '（含子群組）'}。下表是最近 {days} 天上過新聞排行門檻的標籤，依報導篇數排序，並和再之前的 {days}{' '}
          天比較。
        </p>
        {group.children.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1 text-xs" aria-label="子群組">
            {group.children.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/group/${c.id}/`}
                  className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-800 hover:underline dark:bg-brand-950 dark:text-brand-300"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-1 text-sm">
        {DAYS.map((d) => (
          <Link
            key={d}
            href={`/group/${group.id}/${d === 7 ? '' : `?days=${d}`}`}
            className={`rounded-md px-3 py-1 ${d === days ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}
          >
            {d} 天
          </Link>
        ))}
      </div>
      {group.ranking.length ? (
        <GroupRankingTable rows={group.ranking} days={days} subgroupLabel={subgroupLabel} />
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">最近 {days} 天沒有這個群組的標籤上新聞排行。</p>
      )}
    </div>
  );
}
