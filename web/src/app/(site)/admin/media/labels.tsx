export type Definition = { key: string; label: string; sort: number };
export type Outlet = { media: string; title: string; icon: string | null; categories: string[] };

// Camp labels keep the site's blue/green; every other label is neutral.
const tone: Record<string, string> = {
  blue: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
  green: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
};
const neutral = 'border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';

export function LabelChip({ keyName, label }: { keyName: string; label: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${tone[keyName] ?? neutral}`}>{label}</span>;
}

/** Toggle chip: filled while selected. */
export function LabelToggle({ def, on, onToggle }: { def: Definition; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${
        on
          ? `${tone[def.key] ?? 'border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-950 dark:text-brand-200'} font-medium`
          : 'border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-400'
      }`}
    >
      {on ? '✓ ' : '+ '}
      {def.label}
    </button>
  );
}

export function OutletIcon({ outlet, size = 20 }: { outlet: Pick<Outlet, 'icon'>; size?: number }) {
  return outlet.icon ? (
    <img src={outlet.icon} alt="" width={size} height={size} className="shrink-0 rounded-sm" />
  ) : (
    <span className="inline-block shrink-0 rounded-sm bg-zinc-200 dark:bg-zinc-700" style={{ width: size, height: size }} />
  );
}
