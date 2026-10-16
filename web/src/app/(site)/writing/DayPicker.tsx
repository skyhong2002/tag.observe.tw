import FilterChips from '@/components/FilterChips';

export const WRITING_DAYS = [7, 30, 90] as const;
export const writingDays = (value: string | undefined) => {
  const n = Number(value);
  return (WRITING_DAYS as readonly number[]).includes(n) ? n : 30;
};

/** The `days` query the 看寫法 tabs carry across; empty for the default 30. */
export const daysQuery = (days: number) => (days === 30 ? '' : `days=${days}`);

/** 近 7／30／90 天, keeping the other filters. */
export function DayPicker({ days, path, params }: { days: number; path: string; params: Record<string, string | undefined> }) {
  return (
    <FilterChips
      label="期間"
      items={WRITING_DAYS.map((d) => {
        const q = new URLSearchParams(
          Object.entries({ ...params, days: d === 30 ? undefined : String(d) }).filter((e): e is [string, string] => !!e[1]),
        );
        return { href: `${path}${q.size ? `?${q}` : ''}`, label: `近 ${d} 天`, current: d === days };
      })}
    />
  );
}
