// Shared with the event detail page; keep section titles and statistic tiles consistent.
const card = 'rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900';

export function SectionTitle({ id, children, note }: { id: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div>
      <h2 id={id} className="scroll-mt-20 text-base font-semibold">
        {children}
      </h2>
      {note && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{note}</p>}
    </div>
  );
}

/** Four headline numbers: the run, the peak, the reach, the split. */
export function StatTiles({ tiles }: { tiles: Array<{ label: string; value: React.ReactNode; note?: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className={`${card} px-4 py-3`}>
          <dt className="text-xs text-zinc-600 dark:text-zinc-400">{t.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums leading-tight">{t.value}</dd>
          {t.note && <dd className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
