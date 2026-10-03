export default function Loading() {
  return (
    <div role="status" className="flex h-[calc(100svh-172px)] min-h-[420px] flex-col gap-3 sm:h-[calc(100svh-112px)]">
      <h1 className="text-xl font-semibold sm:text-2xl">新聞關係圖</h1>
      <p className="text-xs text-zinc-500">正在載入媒體關係圖…</p>
      <div aria-hidden="true" className="flex-1 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
