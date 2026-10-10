'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SaveButton from '@/components/reader/SaveButton';
import SourceLink from '@/components/SourceLink';
import { type Follow, follows, readerFetch, setFollow, when } from '@/lib/reader';
import { card } from './ReaderGate';

// What to follow next (GET /auth/me/suggestions, app/src/reader/suggestions.ts):
// capsules on /my/following/, and the other camp's reports on /my/.

type Suggestion = Follow & { label: string; because: string };
type OtherSide = {
  camp: 'blue' | 'green';
  share: number;
  articles: Array<{ id: number; media: string; mediaTitle: string; title: string; url: string; publishedAt: string; tag: string }>;
};
export type SuggestionData = {
  starter: { events: Array<{ id: number; title: string; tags: string[] }>; tags: Suggestion[]; media: Suggestion[] };
  related: Suggestion[];
  reading: { tags: Suggestion[]; otherSide: OtherSide | null } | null;
};

const CAMP = { blue: '藍營', green: '綠營' } as const;
const OTHER = { blue: 'green', green: 'blue' } as const;

export function useSuggestions() {
  const [data, setData] = useState<SuggestionData | null>(null);
  useEffect(() => {
    readerFetch<SuggestionData>('/auth/me/suggestions')
      .then(setData)
      .catch(() => {});
  }, []);
  return data;
}

/** A follow toggle shaped like a tag: + to follow, ✓ once followed (pressing again undoes it). */
function Pill({ s }: { s: Suggestion }) {
  const list = follows.useValue();
  const [busy, setBusy] = useState(false);
  const on = Boolean(list?.some((f) => f.kind === s.kind && f.target === s.target));
  return (
    <li>
      <button
        type="button"
        aria-pressed={on}
        disabled={busy || !list}
        title={s.because}
        onClick={async () => {
          setBusy(true);
          await setFollow(s, !on).catch(() => {});
          setBusy(false);
        }}
        className={`inline-flex min-h-8 max-w-[16rem] items-center gap-1 rounded-full border px-3 text-sm disabled:opacity-60 ${
          on
            ? 'border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-200'
            : 'border-zinc-300 text-zinc-700 hover:border-brand-600 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-300'
        }`}
      >
        <span className="truncate">{s.label}</span>
        <span aria-hidden="true" className="shrink-0 text-xs">
          {on ? '✓' : '+'}
        </span>
      </button>
    </li>
  );
}

function Row({ title, list }: { title: string; list: Suggestion[] }) {
  if (!list.length) return null;
  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{title}</h3>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {list.map((s) => (
          <Pill key={`${s.kind}:${s.target}`} s={s} />
        ))}
      </ul>
    </div>
  );
}

/** /my/following/: everything worth following right now, as capsules. */
export function SuggestionPills() {
  const data = useSuggestions();
  if (!data) return null;
  const reading = data.reading?.tags ?? [];
  const read = new Set(reading.map((s) => s.target));
  const forYou = [...reading, ...data.related.filter((s) => !(s.kind === 'tag' && read.has(s.target)))];
  const events = data.starter.events.map((e) => ({
    kind: 'event' as const,
    target: String(e.id),
    label: e.title,
    because: e.tags.map((t) => `#${t}`).join(' '),
  }));
  return (
    <section className="space-y-4">
      <h2 className="font-semibold">推薦</h2>
      <Row title="為你推薦" list={forYou} />
      <Row title="焦點事件" list={events} />
      <Row title="升溫標籤" list={data.starter.tags} />
      <Row title="媒體" list={data.starter.media} />
    </section>
  );
}

/** /my/: with one-sided reading, the other camp's latest reports on the same topics. */
export function OtherSideReports({ other }: { other: OtherSide }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">換個角度看</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        近 30 天你讀的藍綠媒體報導有 {Math.round(other.share * 100)}% 來自{CAMP[other.camp]}，以下是{CAMP[OTHER[other.camp]]}
        的同主題報導。
      </p>
      <ul className={`${card} mt-3 divide-y divide-zinc-200 dark:divide-zinc-800`}>
        {other.articles.map((a) => (
          <li key={a.id} className="px-3 py-2.5">
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium">{a.mediaTitle}</span>
              <time dateTime={a.publishedAt}>{when(a.publishedAt)}</time>
              <Link href={`/tag/${encodeURIComponent(a.tag)}/`} className="hover:text-brand-700">
                #{a.tag}
              </Link>
            </p>
            <div className="mt-1 flex items-start justify-between gap-3">
              <Link href={`/article/${a.id}/`} className="font-medium leading-snug hover:underline">
                {a.title}
              </Link>
              <SaveButton kind="article" id={a.id} className="shrink-0 !min-h-7 !px-2 !text-xs" />
            </div>
            <SourceLink url={a.url} showUrl className="!min-h-5 !text-[11px]" />
          </li>
        ))}
      </ul>
    </section>
  );
}
