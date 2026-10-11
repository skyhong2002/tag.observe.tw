'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useId, useState } from 'react';
import MediaIcon from '@/components/MediaIcon';
import OutletPicker from '@/components/OutletPicker';
import SuggestInput from '@/components/SuggestInput';
import { type BylineIndex, bylineHref } from '@/lib/bylines';

// Filters for the non-person byline tabs. Typing a name lists matching
// credits from the API (picking one opens it); picking an outlet reloads the
// list right away. Enter without a highlighted suggestion still submits.

export default function BylineFilters({
  hours,
  kind,
  q = '',
  media = '',
  outlets,
  clearHref,
}: {
  hours: number;
  kind: string;
  q?: string;
  media?: string;
  outlets: BylineIndex['outlets'];
  clearHref: string;
}) {
  const router = useRouter();
  const id = useId();
  const [text, setText] = useState(q);
  const suggest = useCallback(
    async (typed: string, signal: AbortSignal) => {
      const params = new URLSearchParams({
        hours: String(hours),
        q: typed,
        ...(kind !== 'all' ? { kind } : {}),
        ...(media ? { media } : {}),
      });
      const response = await fetch(`/api/v1/bylines?${params}`, { signal });
      if (!response.ok) return [];
      const data = (await response.json()) as BylineIndex;
      return data.bylines.map((entry) => ({
        key: entry.key,
        label: entry.name,
        icon: entry.outlets[0] && <MediaIcon media={entry.outlets[0].media} title={entry.outlets[0].name} size={14} />,
        hint: `${entry.outlets[0]?.name ?? ''} ${entry.articles.toLocaleString('zh-TW')} 篇`,
      }));
    },
    [hours, kind, media],
  );
  const go = (patch: { q?: string; media?: string }) => {
    const next = { hours: String(hours), kind, q: text.trim(), media, ...patch };
    router.push(`/byline/?${new URLSearchParams(Object.entries(next).filter((entry) => entry[1]))}`);
  };
  return (
    <form action="/byline/" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="hours" value={hours} />
      <input type="hidden" name="kind" value={kind} />
      {media && <input type="hidden" name="media" value={media} />}
      <label htmlFor={`${id}-q`} className="text-xs text-zinc-500">
        搜尋署名
        <SuggestInput
          id={`${id}-q`}
          name="q"
          value={text}
          onValueChange={setText}
          suggest={suggest}
          delay={150}
          onPick={(item) => router.push(bylineHref(item.key, hours))}
          maxLength={120}
          placeholder="姓名、筆名或團隊名稱"
          wrapperClassName="mt-1"
          className="block w-64 max-w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
        />
      </label>
      <label htmlFor={`${id}-media`} className="text-xs text-zinc-500">
        刊登媒體
        <OutletPicker
          id={`${id}-media`}
          outlets={outlets}
          value={media}
          onChange={(value) => go({ media: value })}
          className="mt-1 block w-56 max-w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
        />
      </label>
      <button type="submit" className="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white">
        查詢
      </button>
      {(q || media) && (
        <Link href={clearHref} className="py-2 text-sm text-brand-700 dark:text-brand-400">
          清除篩選
        </Link>
      )}
    </form>
  );
}
