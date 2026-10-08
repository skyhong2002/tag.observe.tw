import Link from 'next/link';
import { taipeiHour } from '@/lib/api';
import { eventThreadHeadline } from '@/lib/event-presentation.mts';
import { fetchThreadPart } from '@/lib/event-thread-api';

interface RelatedThread {
  thread: { id: number; majorTags: string[]; firstTime: string; lastTime: string };
  hours: Array<{ major: string[]; news: Array<{ title: string }> }>;
}

export default async function ContinuationLinks({ ids, label }: { ids: number[]; label: string }) {
  if (!ids.length) return null;
  const rows = await Promise.all(
    ids.map(async (id) => ({ id, data: await fetchThreadPart<RelatedThread>(String(id), '').catch(() => null) })),
  );
  return (
    <details className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        {label} <span className="ml-2 text-xs font-normal text-zinc-500">{ids.length} 件</span>
      </summary>
      <ul className="divide-y divide-zinc-100 px-4 pb-2 dark:divide-zinc-800">
        {rows.map(({ id, data }) => (
          <li key={id} className="py-2">
            <Link href={`/eve/${id}/`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
              #{id} · {data ? eventThreadHeadline(data) : '查看事件'} →
            </Link>
            {data && (
              <p className="mt-1 text-xs text-zinc-500">
                {taipeiHour(data.thread.firstTime)} 至 {taipeiHour(data.thread.lastTime)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
