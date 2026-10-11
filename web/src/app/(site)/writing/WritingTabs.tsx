import Link from 'next/link';

export const WRITING_DAYS = [7, 30, 90] as const;
export const writingDays = (value: string | undefined) => {
  const n = Number(value);
  return (WRITING_DAYS as readonly number[]).includes(n) ? n : 30;
};

const tabClass = (active: boolean) =>
  `flex min-h-9 items-center whitespace-nowrap rounded-md px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${active ? 'bg-white font-medium text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}`;

/** 看寫法 sub-pages; the period carries across. */
export default function WritingTabs({ current, days }: { current: 'social' | 'titles'; days: number }) {
  const q = days === 30 ? '' : `?days=${days}`;
  return (
    <nav aria-label="看寫法" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-900">
      {[
        { key: 'social', href: '/writing/', label: '轉述社群貼文' },
        { key: 'titles', href: '/writing/titles/', label: '標題用詞' },
      ].map((tab) => (
        <Link
          key={tab.key}
          href={`${tab.href}${q}`}
          aria-current={current === tab.key ? 'page' : undefined}
          className={tabClass(current === tab.key)}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** 近 7／30／90 天, keeping the other filters. */
export function DayPicker({ days, path, params }: { days: number; path: string; params: Record<string, string | undefined> }) {
  return (
    <span className="inline-flex gap-1 rounded-lg bg-zinc-100 p-1 text-xs dark:bg-zinc-900">
      {WRITING_DAYS.map((d) => {
        const q = new URLSearchParams(
          Object.entries({ ...params, days: d === 30 ? undefined : String(d) }).filter((e): e is [string, string] => !!e[1]),
        );
        return (
          <Link
            key={d}
            href={`${path}${q.size ? `?${q}` : ''}`}
            aria-current={d === days ? 'page' : undefined}
            className={`${tabClass(d === days)} !min-h-7 !px-2`}
          >
            近 {d} 天
          </Link>
        );
      })}
    </span>
  );
}
