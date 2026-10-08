'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';

// The daily table's date bar: a week of days like a calendar row, flanked by
// previous/next, with a date field for anything older and the day's hours
// folded behind one button.

const dayHref = (day: string) => `/event/?day=${day}`;
const weekday = (day: string) => '日一二三四五六'[new Date(`${day}T00:00:00Z`).getUTCDay()];
const mmdd = (day: string) => day.slice(5).replace('-', '/');
const WEEK = 7;

function Arrow({ day, dir }: { day?: string; dir: 'prev' | 'next' }) {
  const label = dir === 'prev' ? '前一天' : '後一天';
  const icon = (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path
        d={dir === 'prev' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  const base = 'flex h-12 w-8 shrink-0 items-center justify-center rounded-lg';
  return day ? (
    <Link
      href={dayHref(day)}
      aria-label={`${label}（${mmdd(day)}）`}
      title={label}
      className={`${base} text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100`}
    >
      {icon}
    </Link>
  ) : (
    <span aria-hidden className={`${base} text-zinc-300 dark:text-zinc-700`}>
      {icon}
    </span>
  );
}

export default function EventDayNav({
  day,
  days,
  today,
  hourCount,
  hours,
}: {
  day: string;
  days: string[];
  /** Today's date in Taipei, labelled 今天 in the strip. */
  today: string;
  /** Snapshot hours that day, and their picker (rendered on the server). */
  hourCount: number;
  hours: ReactNode;
}) {
  const [hoursOpen, setHoursOpen] = useState(false);
  // On a phone the week scrolls; bring the shown day into view.
  const strip = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = strip.current;
    const here = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && here) el.scrollLeft = here.offsetLeft + here.offsetWidth / 2 - el.clientWidth / 2;
  }, []);
  const i = days.indexOf(day);
  const prev = days.filter((d) => d < day).at(-1);
  const next = days.find((d) => d > day);
  // A week with the shown day in it, leaning towards the latest days.
  const end = Math.min(days.length, Math.max(i, 0) + 1 + Math.floor(WEEK / 2));
  const week = days.slice(Math.max(0, end - WEEK), end);
  return (
    <nav aria-label="選擇日期" className="rounded-xl border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center">
          <Arrow day={prev} dir="prev" />
          <ol ref={strip} className="relative flex min-w-0 gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
            {week.map((d) => {
              const here = d === day;
              return (
                <li key={d}>
                  <Link
                    href={dayHref(d)}
                    aria-current={here ? 'page' : undefined}
                    className={`flex h-12 w-14 flex-col items-center justify-center rounded-lg tabular-nums leading-tight ${
                      here
                        ? 'bg-brand-700 text-white shadow-sm dark:bg-brand-600'
                        : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className={`text-[11px] ${here ? 'text-white/80' : 'text-zinc-500'}`}>
                      {d === today ? '今天' : `週${weekday(d)}`}
                    </span>
                    <span className="font-medium">{mmdd(d)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <Arrow day={next} dir="next" />
        </div>
        <div className="ml-auto flex items-center gap-2 pr-1">
          {days.length > 0 && (
            <form action="/event/" className="flex items-center">
              <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-600 focus-within:border-brand-600 dark:border-zinc-700 dark:text-zinc-400">
                <span>其他日期</span>
                <input
                  type="date"
                  name="day"
                  defaultValue={day}
                  min={days[0]}
                  max={days.at(-1)}
                  onChange={(e) => e.currentTarget.value && e.currentTarget.form?.requestSubmit()}
                  className="bg-transparent text-zinc-900 outline-none dark:text-zinc-100 dark:[color-scheme:dark]"
                />
              </label>
              <button type="submit" className="sr-only">
                前往
              </button>
            </form>
          )}
          {hourCount > 1 && (
            <button
              type="button"
              aria-expanded={hoursOpen}
              aria-controls="event-day-hours"
              onClick={() => setHoursOpen((o) => !o)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${
                hoursOpen
                  ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                  : 'border-zinc-200 text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              各時段關鍵字
              <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition-transform ${hoursOpen ? 'rotate-180' : ''}`} aria-hidden>
                <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {hoursOpen && (
        <div id="event-day-hours" className="mt-2 border-t border-zinc-200 px-1 pt-2 dark:border-zinc-800">
          {hours}
        </div>
      )}
    </nav>
  );
}
