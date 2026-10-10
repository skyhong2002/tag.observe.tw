'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import FollowButton from '@/components/reader/FollowButton';
import SaveButton from '@/components/reader/SaveButton';
import SourceLink from '@/components/SourceLink';
import { type Follow, followHref, follows, readerFetch, when } from '@/lib/reader';
import { card, note } from './ReaderGate';

// What to follow next (GET /auth/me/suggestions, app/src/reader/suggestions.ts).

export type Suggestion = Follow & { label: string; because: string };
type StarterEvent = { id: number; title: string; tags: string[] };
type OtherSide = {
  camp: 'blue' | 'green';
  share: number;
  articles: Array<{ id: number; media: string; mediaTitle: string; title: string; url: string; publishedAt: string; tag: string }>;
};
export type SuggestionData = {
  starter: { events: StarterEvent[]; tags: Suggestion[]; media: Suggestion[] };
  related: Suggestion[];
  reading: { tags: Suggestion[]; otherSide: OtherSide | null } | null;
};

const CAMP = { blue: '藍營', green: '綠營' } as const;
const OTHER = { blue: 'green', green: 'blue' } as const;
const small = '!min-h-7 !px-2 !text-xs';

export function useSuggestions() {
  const [data, setData] = useState<SuggestionData | null>(null);
  useEffect(() => {
    readerFetch<SuggestionData>('/auth/me/suggestions')
      .then(setData)
      .catch(() => {});
  }, []);
  return data;
}

/** One suggestion: its name links to the page, the button follows it, and the reason sits underneath. */
function Chip({ s, reason = true }: { s: Suggestion; reason?: boolean }) {
  return (
    <li className={`${card} flex items-center justify-between gap-2 px-3 py-2`}>
      <div className="min-w-0">
        <Link href={followHref(s)} className="block truncate font-medium hover:underline">
          {s.label}
        </Link>
        {reason && <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{s.because}</p>}
      </div>
      <FollowButton kind={s.kind} target={s.target} className={`shrink-0 ${small}`} />
    </li>
  );
}

function ChipGrid({ title, hint, list }: { title: string; hint?: string; list: Suggestion[] }) {
  if (!list.length) return null;
  return (
    <section>
      <h3 className="font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => (
          <Chip key={`${s.kind}:${s.target}`} s={s} />
        ))}
      </ul>
    </section>
  );
}

/** Today's events, rising tags and busiest outlets: a first pick for a reader with no follows yet. */
export function Starter({ data }: { data: SuggestionData['starter'] }) {
  return (
    <div className="space-y-6">
      {data.events.length > 0 && (
        <section>
          <h3 className="font-semibold">今天的焦點事件</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">追蹤事件後，它後續的發展與各家標題會出現在「我的動態」。</p>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {data.events.map((e) => (
              <li key={e.id} className={`${card} flex items-start justify-between gap-3 px-3 py-2.5`}>
                <div className="min-w-0">
                  <Link href={`/eve/${e.id}/`} className="font-medium leading-snug hover:underline">
                    {e.title}
                  </Link>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {e.tags.map((t) => (
                      <span key={t} className="rounded bg-zinc-100 px-1.5 py-px text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        #{t}
                      </span>
                    ))}
                  </p>
                </div>
                <FollowButton kind="event" target={String(e.id)} className={`shrink-0 ${small}`} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <ChipGrid title="正在升溫的標籤" hint="標籤會持續收集各家新報導，事件結束後也還在。" list={data.tags} />
      <ChipGrid title="今天報導最多的媒體" hint="追蹤一家媒體會收到它的所有報導，量可能很大。" list={data.media} />
    </div>
  );
}

/** For a reader without follows: pick a few, then see the feed they make. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const data = useSuggestions();
  const list = follows.useValue() ?? [];
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-900 dark:bg-brand-950/40">
        <p className="font-medium">從這裡開始</p>
        <p className="mt-1 text-zinc-700 dark:text-zinc-300">
          挑幾個你在意的事件、標籤或媒體按「追蹤」，它們的新報導就會集中在「我的動態」。之後在任何標籤、媒體、記者或事件頁也都能追蹤。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!list.length}
            onClick={onDone}
            className="inline-flex min-h-9 items-center rounded-full bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50 dark:bg-brand-600"
          >
            {list.length ? `已追蹤 ${list.length} 項，看我的動態` : '先追蹤至少一項'}
          </button>
        </div>
      </div>
      {!data ? <p className={note}>正在找今天的熱門內容…</p> : <Starter data={data.starter} />}
    </div>
  );
}

/** Below the feed: what to follow next and, for one-sided reading, the other camp's reports. */
export function Recommended({ data }: { data: SuggestionData }) {
  const reading = data.reading;
  const other = reading?.otherSide;
  // A tag the reader keeps reading is listed once, under the reading reason.
  const read = new Set(reading?.tags.map((s) => s.target));
  const related = data.related.filter((s) => !(s.kind === 'tag' && read.has(s.target)));
  const nothing = !related.length && !reading?.tags.length && !other;
  return (
    <div className="space-y-8">
      {other && (
        <section>
          <h2 className="text-lg font-semibold">換個角度看</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            近 30 天你在本站讀的藍綠媒體報導中，{Math.round(other.share * 100)}% 來自{CAMP[other.camp]}。這是
            {CAMP[OTHER[other.camp]]}媒體最近對同樣主題的報導：
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
                  <SaveButton kind="article" id={a.id} className={`shrink-0 ${small}`} />
                </div>
                <SourceLink url={a.url} showUrl className="!min-h-5 !text-[11px]" />
              </li>
            ))}
          </ul>
        </section>
      )}
      {!nothing && (
        <section className="space-y-5">
          <h2 className="text-lg font-semibold">推薦追蹤</h2>
          <ChipGrid title="你可能也想追蹤" hint="依你已追蹤的標籤、記者與事件。" list={related} />
          {reading && <ChipGrid title="你常讀但還沒追蹤" hint="依你的閱讀紀錄。" list={reading.tags} />}
        </section>
      )}
      <details className="group">
        <summary className="cursor-pointer text-lg font-semibold">探索今天的熱門</summary>
        <div className="mt-3">
          <Starter data={data.starter} />
        </div>
      </details>
    </div>
  );
}
