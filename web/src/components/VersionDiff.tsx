import Link from 'next/link';
import type { ReactNode } from 'react';
import type { DiffSegment, TextDiff } from '../../../app/src/similarity/text-diff.ts';

// Changes between two versions of a story: text only in the first struck
// through in red, text only in the second on green. Used by the comparison
// list and journalist pages.

const number = (value: number) => value.toLocaleString('zh-TW');
const LONG = 40;
export const removedStyle =
  'rounded-sm bg-rose-100 px-0.5 text-rose-800 line-through decoration-rose-500/70 box-decoration-clone dark:bg-rose-950/70 dark:text-rose-300';
export const addedStyle =
  'rounded-sm bg-emerald-100 px-0.5 text-emerald-900 no-underline box-decoration-clone dark:bg-emerald-950/70 dark:text-emerald-300';

/** The same changes read the other way round. */
export function invertSegments(segments: DiffSegment[]): DiffSegment[] {
  return segments.map(([op, value]) => [op === 0 ? 0 : op === 1 ? -1 : 1, value]);
}
export function invertDiff(diff: TextDiff): TextDiff {
  return { ...diff, hunks: diff.hunks.map(invertSegments), removed: diff.added, added: diff.removed };
}

/** A long added or removed passage shows only its start, so short edits stay visible. */
function Changed({ value }: { value: string }) {
  const chars = Array.from(value.replace(/…（共 \d+ 字）$/, ''));
  if (chars.length <= LONG) return value;
  const total = Number(/…（共 (\d+) 字）$/.exec(value)?.[1] ?? chars.length);
  return (
    <>
      {chars.slice(0, 24).join('')}…<span className="text-xs opacity-80">（整段 {number(total)} 字）</span>
    </>
  );
}

/** Text with removals struck through in red and additions on green; kept text plain. */
export function DiffText({ segments }: { segments: DiffSegment[] }) {
  return segments.map(([op, value], index) =>
    op === 0 ? (
      <span key={index}>{value}</span>
    ) : op < 0 ? (
      <del key={index} className={removedStyle}>
        <span className="sr-only">刪除：</span>
        <Changed value={value} />
      </del>
    ) : (
      <ins key={index} className={addedStyle}>
        <span className="sr-only">新增：</span>
        <Changed value={value} />
      </ins>
    ),
  );
}

/** Only the changed spots of the body; nothing at all when not a word changed. */
export function BodyChanges({
  diff,
  label = '內文改了',
  removed = '刪',
  added = '增',
}: {
  diff: TextDiff | null;
  label?: string;
  removed?: string;
  added?: string;
}) {
  if (!diff || diff.identical) return null;
  return (
    <div className="space-y-1 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700" data-testid="body-changes">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {label} {number(diff.hunks.length + diff.more)} 處
        </span>
        <span className="mx-1.5">·</span>
        <span className="text-rose-700 dark:text-rose-400">
          {removed} {number(diff.removed)} 字
        </span>
        <span className="mx-1.5">·</span>
        <span className="text-emerald-700 dark:text-emerald-400">
          {added} {number(diff.added)} 字
        </span>
      </p>
      <ol className="space-y-1 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
        {diff.hunks.map((hunk, index) => (
          <li key={index} className="break-words">
            <DiffText segments={hunk} />
          </li>
        ))}
      </ol>
      {diff.more > 0 && <p className="text-xs text-zinc-500 dark:text-zinc-400">另有 {number(diff.more)} 處未列出</p>}
    </div>
  );
}

const keep = (segments: DiffSegment[], side: -1 | 1) => segments.filter(([op]) => op !== -side);
const cell = 'min-w-0 break-words';

/**
 * Two versions side by side on wide screens: the first with its removals in red
 * on the left, the second with its additions in green on the right. Each title
 * and changed spot is one grid row, so both sides always line up. Narrow screens
 * get one merged column.
 */
export function VersionCompare({
  heads,
  links,
  title,
  body,
  label = '內文改了',
  removed = '刪',
  added = '增',
}: {
  heads: [ReactNode, ReactNode];
  /** Each side's article page and plain title. */
  links: [{ href: string; title: string }, { href: string; title: string }];
  title: DiffSegment[] | null | undefined;
  body: TextDiff | null | undefined;
  label?: string;
  removed?: string;
  added?: string;
}) {
  const retitled = !!title?.some(([op]) => op !== 0);
  const changed = !!body && !body.identical;
  const linked = (side: 0 | 1, content: ReactNode) => (
    <Link href={links[side].href} className="hover:text-brand-700 dark:hover:text-brand-400">
      {content}
    </Link>
  );
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2" data-testid="version-compare">
      <div className={`${cell} text-xs`}>{heads[0]}</div>
      <div className={`${cell} text-xs max-sm:order-3`}>{heads[1]}</div>
      {retitled ? (
        <>
          <p className={`${cell} hidden text-[15px] font-medium leading-7 sm:block`}>
            {linked(0, <DiffText segments={keep(title!, -1)} />)}
          </p>
          <p className={`${cell} hidden text-[15px] font-medium leading-7 sm:block`}>
            {linked(1, <DiffText segments={keep(title!, 1)} />)}
          </p>
          <p className={`${cell} text-[15px] font-medium leading-7 max-sm:order-4 sm:hidden`}>
            {linked(1, <DiffText segments={title!} />)}
          </p>
        </>
      ) : (
        <>
          <p className={`${cell} text-[15px] font-medium leading-7 max-sm:order-2`}>{linked(0, links[0].title)}</p>
          <p className={`${cell} text-[15px] font-medium leading-7 max-sm:order-4`}>{linked(1, links[1].title)}</p>
        </>
      )}
      {changed && (
        <div
          className="order-5 mt-1 grid grid-cols-subgrid gap-y-1 border-zinc-200 max-sm:border-l-2 max-sm:pl-3 sm:col-span-2 dark:border-zinc-700"
          data-testid="body-changes"
        >
          <p className="text-xs text-zinc-500 sm:col-span-2 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {label} {number(body.hunks.length + body.more)} 處
            </span>
            <span className="mx-1.5">·</span>
            <span className="text-rose-700 dark:text-rose-400">
              {removed} {number(body.removed)} 字
            </span>
            <span className="mx-1.5">·</span>
            <span className="text-emerald-700 dark:text-emerald-400">
              {added} {number(body.added)} 字
            </span>
          </p>
          {body.hunks.map((hunk, index) => (
            <div key={index} className="contents text-sm leading-7 text-zinc-600 dark:text-zinc-400">
              <p className={`${cell} hidden border-t border-zinc-100 pt-1 sm:block dark:border-zinc-800`}>
                <DiffText segments={keep(hunk, -1)} />
              </p>
              <p className={`${cell} hidden border-t border-zinc-100 pt-1 sm:block dark:border-zinc-800`}>
                <DiffText segments={keep(hunk, 1)} />
              </p>
              <p className={`${cell} sm:hidden`}>
                <DiffText segments={hunk} />
              </p>
            </div>
          ))}
          {body.more > 0 && <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:col-span-2">另有 {number(body.more)} 處未列出</p>}
        </div>
      )}
    </div>
  );
}
