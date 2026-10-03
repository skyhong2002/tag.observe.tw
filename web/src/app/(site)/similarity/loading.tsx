export default function Loading() {
  return (
    <div role="status" className="space-y-4 py-6">
      <h1 className="text-2xl font-semibold">新聞相似度與引用關係</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">正在讀取擷取覆蓋率、內文配對與引用關係…</p>
      <div aria-hidden="true" className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
