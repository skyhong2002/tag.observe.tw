import Link from 'next/link';

// One outlet's tags as chips: the camp (kept in tag) first, then the tags from
// site.observe.tw, each linking to that filter on /media/, then a link to
// edit them on site.observe.tw (the domains are in its tooltip). The same
// chip styles are used in the /media/ table.

const chip = 'shrink-0 whitespace-nowrap rounded px-1.5 py-px text-[11px] font-medium ring-1 ring-inset';
export const tagChip = `${chip} bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700`;
export const campChip = {
  blue: `${chip} bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800`,
  green: `${chip} bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800`,
};
const CAMP_LABELS = { blue: '藍營傾向', green: '綠營傾向' };
const linkHover = 'hover:ring-zinc-400 dark:hover:ring-zinc-500';

export default function MediaTagChips({
  camp,
  labels,
  domains = [],
}: {
  camp: 'blue' | 'green' | 'other';
  labels: Array<{ key: string; label: string }>;
  /** Domains the tags come from, the main one first. */
  domains?: string[];
}) {
  const main = domains[0];
  const from = `標籤來自網站雷達上的的 ${domains.join('、')}`;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">標籤</span>
      {camp !== 'other' && (
        <Link href={`/media/?camp=${camp}`} className={`${campChip[camp]} ${linkHover}`}>
          {CAMP_LABELS[camp]}
        </Link>
      )}
      {labels.map((l) => (
        <Link key={l.key} href={`/media/?tag=${encodeURIComponent(l.key)}`} className={`${tagChip} ${linkHover}`}>
          {l.label}
        </Link>
      ))}
      {camp === 'other' && !labels.length && <span className="text-xs text-zinc-500 dark:text-zinc-400">尚無標籤</span>}
      {main && (
        <a
          href={`https://site.observe.tw/site/${encodeURIComponent(main)}/#tags`}
          title={from}
          className="ml-1 whitespace-nowrap text-xs text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800 dark:text-brand-400 dark:decoration-brand-700"
        >
          編輯標籤
        </a>
      )}
    </div>
  );
}
