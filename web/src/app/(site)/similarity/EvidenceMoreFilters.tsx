'use client';

import { useEffect, useState } from 'react';
import type { readGraphState } from '@/lib/relationship-query.mts';

// The finer 新聞對照 filters, one compact row under the main one: similarity
// range, bylines, publication gap, story size and order. Each one is a URL key, so a filtered
// view can be shared. Pair-only filters (score, gap, story size) leave out
// explicit citations, which have no measured pair.

type State = ReturnType<typeof readGraphState>;
type Patch = Record<string, string | number | undefined>;

export const moreFilterCount = (state: State) =>
  [state.minScore !== null, state.maxScore !== null, state.bylines !== 'all', state.gap !== 'all', state.minGroup > 0].filter(Boolean)
    .length;
export const clearMoreFilters: Patch = {
  minScore: undefined,
  maxScore: undefined,
  bylines: undefined,
  gap: undefined,
  minGroup: undefined,
  sort: undefined,
};

/** A whole-percent box that applies after typing stops (or on blur), not on every keystroke. */
function PercentInput({
  value,
  onCommit,
  label,
  placeholder,
  className,
}: {
  value: number | null;
  onCommit: (value: number | undefined) => void;
  label: string;
  placeholder: string;
  className: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => setText(value === null ? '' : String(value)), [value]);
  const commit = (next: string) => {
    const number = next.trim() === '' ? undefined : Math.min(100, Math.max(0, Math.round(Number(next))));
    if (number !== undefined && !Number.isFinite(number)) return;
    if ((number ?? null) !== value) onCommit(number);
  };
  useEffect(() => {
    const timer = setTimeout(() => commit(text), 600);
    return () => clearTimeout(timer);
  });
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={100}
      step={1}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => commit(text)}
      className={className}
    />
  );
}

const small = (active: boolean) =>
  `h-8 rounded-md border bg-white px-2 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 ${
    active ? 'border-brand-600 dark:border-brand-500' : 'border-zinc-300 dark:border-zinc-700'
  }`;

/** One compact, always-visible row: each label sits beside its control; set filters get an accent border. */
export default function EvidenceMoreFilters({
  state,
  threshold,
  onChange,
}: {
  state: State;
  /** The index's own lower bound (0–1); lower minimums cannot match anything. */
  threshold: number;
  onChange: (patch: Patch) => void;
}) {
  const floor = Math.round(threshold * 100);
  const set = (patch: Patch) => onChange({ ...patch, page: undefined });
  const choice = <T extends string | number>(
    label: string,
    value: T,
    unset: T,
    options: Array<[T, string]>,
    apply: (value: string) => Patch,
    hint?: string,
  ) => (
    <label title={hint} className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
      {label}
      <select
        value={value}
        onChange={(event) => set(apply(event.target.value))}
        className={`${small(value !== unset)} min-w-0 flex-1 sm:flex-none`}
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <fieldset className="grid grid-cols-2 items-center gap-x-3 gap-y-2 rounded-lg sm:flex sm:flex-wrap sm:gap-x-4 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
      <legend className="sr-only">新聞對照的進一步篩選</legend>
      <span className="col-span-2 flex items-center gap-1.5">
        相似度
        <PercentInput
          label="相似度下限（%）"
          placeholder={`${floor}`}
          value={state.minScore}
          onCommit={(value) => set({ minScore: value })}
          className={`${small(state.minScore !== null)} w-16`}
        />
        <span aria-hidden="true">–</span>
        <PercentInput
          label="相似度上限（%）"
          placeholder="100"
          value={state.maxScore}
          onCommit={(value) => set({ maxScore: value })}
          className={`${small(state.maxScore !== null)} w-16`}
        />
        %
        <span
          className="cursor-help text-zinc-500 dark:text-zinc-400"
          title={`相似度、時間差與篇數只適用內文相似的配對，套用時不列明示來源／引用。索引只收相似度 ${floor}% 以上的配對。`}
        >
          ⓘ
        </span>
      </span>
      {choice(
        '署名',
        state.bylines,
        'all',
        [
          ['all', '不限'],
          ['both', '兩篇都有'],
          ['missing', '至少一篇沒有'],
          ['none', '兩篇都沒有'],
        ],
        (value) => ({ bylines: value === 'all' ? undefined : value }),
      )}
      {choice(
        '時間差',
        state.gap,
        'all',
        [
          ['all', '不限'],
          ['same', '同時（1 分鐘內）'],
          ['hour', '1 小時內'],
          ['later', '超過 1 小時'],
        ],
        (value) => ({ gap: value === 'all' ? undefined : value }),
      )}
      {choice(
        '同則篇數',
        state.minGroup,
        0,
        [
          [0, '不限'],
          [3, '3 篇以上'],
          [5, '5 篇以上'],
          [10, '10 篇以上'],
        ],
        (value) => ({ minGroup: Number(value) || undefined }),
        '同一則新聞（彼此相似的文章群）至少幾篇',
      )}
      {choice(
        '排序',
        state.sort,
        'latest',
        [
          ['latest', '最新在前'],
          ['score', '相似度高到低'],
        ],
        (value) => ({ sort: value === 'score' ? 'score' : undefined }),
      )}
    </fieldset>
  );
}
