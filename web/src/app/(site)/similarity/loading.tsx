import MediaGraphLoading from '@/components/MediaGraphLoading';

export default function Loading() {
  return (
    <div data-similarity-dashboard className="flex h-[calc(100svh-112px)] min-h-[420px] flex-col gap-3">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">新聞關係圖</h1>
        <div aria-hidden="true" className="mt-1 flex h-4 items-center gap-2">
          <span className="h-2 w-20 rounded bg-zinc-100 dark:bg-zinc-800" />
          <span className="h-2 w-36 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div
          aria-hidden="true"
          className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
        >
          {[
            ['期間', 'w-36'],
            ['顯示媒體數', 'w-28'],
            ['藍綠分類', 'w-28'],
            ['媒體 tag', 'w-40'],
          ].map(([label, width]) => (
            <div key={label} className="flex items-center gap-2 text-zinc-400">
              {label}
              <div className={`h-[34px] ${width} rounded-lg bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-800`} />
            </div>
          ))}
          <div className="flex h-4 basis-full items-center lg:basis-auto">
            <span className="h-2 w-52 rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </div>
        <div
          aria-hidden="true"
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800"
        >
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-xs text-zinc-400 dark:bg-zinc-800">
            {['全部關係', '內文相似', '明示引用'].map((label) => (
              <span key={label} className="px-3 py-1.5">
                {label}
              </span>
            ))}
          </div>
          <span className="h-7 w-48 rounded bg-zinc-50 dark:bg-zinc-800/50" />
        </div>
        <div className="min-h-0 flex-1">
          <MediaGraphLoading />
        </div>
        <div
          aria-hidden="true"
          className="flex h-16 shrink-0 items-center gap-3 border-t border-zinc-100 px-3 dark:border-zinc-800 sm:h-12"
        >
          <span className="h-2 w-20 rounded bg-orange-100 dark:bg-orange-950" />
          <span className="h-2 w-20 rounded bg-violet-100 dark:bg-violet-950" />
        </div>
      </div>
      <div aria-hidden="true" className="flex h-4 shrink-0 items-center">
        <span className="h-2 w-64 max-w-full rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
