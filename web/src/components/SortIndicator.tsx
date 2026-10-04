/** Arrow after a sortable column heading; the inactive glyph shows the column can be sorted. */
export default function SortIndicator({ active, descending }: { active: boolean; descending: boolean }) {
  return (
    <span aria-hidden="true" className={active ? '' : 'text-zinc-400 dark:text-zinc-600'}>
      {active ? (descending ? '▼' : '▲') : '↕'}
    </span>
  );
}
