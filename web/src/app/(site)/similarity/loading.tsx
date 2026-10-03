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
          className="grid shrink-0 grid-cols-3 gap-2 border-b border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800 sm:flex sm:items-end sm:gap-3"
        >
          {['顯示媒體數', '藍綠分類', '媒體 tag'].map((label) => (
            <div key={label} className="min-w-0 text-zinc-400 sm:w-32">
              {label}
              <div className="mt-1 h-[38px] rounded-lg bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-800" />
            </div>
          ))}
          <div className="col-span-3 flex h-4 items-center sm:pb-2">
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
