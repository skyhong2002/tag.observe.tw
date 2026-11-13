// The loading.tsx placeholder: the shape of a heading, a filter row and a list,
// in the page's own frame, so the content replaces it without moving the header
// or footer. Only for segments that never call notFound(): a streamed response
// starts with 200, so a skeleton above a 404 would turn it into a soft 404.

const bar = 'rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800';

/** The event table's shape: a date bar, then picture cards beside an index, so
 *  the stories land where their placeholders were. */
export function EventSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-5">
      <span className="sr-only">{label}載入中…</span>
      <div className="space-y-3" aria-hidden="true">
        <div className={`${bar} h-8 w-40`} />
        <div className={`${bar} h-4 w-full max-w-md`} />
      </div>
      <div className="flex gap-1 overflow-hidden rounded-xl border border-zinc-200 p-2 dark:border-zinc-800" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder days
          <div key={i} className={`${bar} h-12 w-14 shrink-0 rounded-lg`} />
        ))}
      </div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8" aria-hidden="true">
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="grid gap-4 rounded-xl border border-zinc-200 p-4 md:grid-cols-[18rem_minmax(0,1fr)] dark:border-zinc-800"
            >
              <div className={`${bar} aspect-video rounded-lg`} />
              <div className="space-y-3">
                <div className={`${bar} h-4 w-1/3`} />
                <div className={`${bar} h-6 w-11/12`} />
                <div className={`${bar} h-6 w-2/3`} />
                <div className={`${bar} h-3 w-full`} />
                <div className={`${bar} h-12 w-full`} />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden space-y-2 lg:block">
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
            <div key={i} className={`${bar} h-4`} style={{ width: `${92 - ((i * 11) % 30)}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PageSkeleton({ label, rows = 8 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">{label}載入中…</span>
      <div className="space-y-3" aria-hidden="true">
        <div className={`${bar} h-8 w-48`} />
        <div className={`${bar} h-4 w-full max-w-xl`} />
      </div>
      <div className="flex flex-wrap gap-2" aria-hidden="true">
        {[16, 20, 14, 18].map((w) => (
          <div key={w} className={`${bar} h-9 rounded-full`} style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
          <li key={i} className="flex items-center gap-3 py-3">
            <div className={`${bar} h-5 w-8 shrink-0`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`${bar} h-4`} style={{ width: `${88 - ((i * 13) % 36)}%` }} />
              <div className={`${bar} h-3 w-1/3`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
