/** Arrow after a sortable column heading; the inactive glyph shows the column can be sorted. */
export default function SortIndicator({ active, descending }: { active: boolean; descending: boolean }) {
  return (
    <span aria-hidden="true" className={active ? '' : 'text-zinc-600 dark:text-zinc-400'}>
      {active ? (descending ? '▼' : '▲') : '↕'}
    </span>
  );
}
