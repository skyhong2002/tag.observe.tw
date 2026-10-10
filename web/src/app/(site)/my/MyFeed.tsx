'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SaveButton from '@/components/reader/SaveButton';
import SourceLink from '@/components/SourceLink';
import { type Follow, followHref, prefs, readerFetch, savePrefs, when } from '@/lib/reader';
import { card, note } from './ReaderGate';
import { Onboarding, Recommended, useSuggestions } from './Suggestions';

type FeedArticle = {
  id: number;
  media: string;
  mediaTitle: string;
  title: string;
  url: string;
  publishedAt: string;
  tags: string[];
  matched: Follow[];
};
type FeedEvent = {
  id: number;
  title: string;
  tags: string[];
  firstTime: string;
  lastTime: string;
  active: boolean;
  headlines: Array<{ title: string; url: string; media: string; mediaTitle: string }>;
};
type Feed = { days: number; follows: Follow[]; articles: FeedArticle[]; events: FeedEvent[] };

const chip =
  'inline-flex items-center rounded bg-zinc-100 px-1.5 py-px text-xs text-zinc-700 hover:text-brand-700 dark:bg-zinc-800 dark:text-zinc-300';
const label = (f: Follow, a?: FeedArticle) =>
  f.kind === 'tag'
    ? `#${f.target}`
    : f.kind === 'media'
      ? (a?.mediaTitle ?? f.target)
      : f.kind === 'journalist'
        ? `記者 ${f.target}`
        : `事件 ${f.target}`;

// 我的動態: the last week from everything the reader follows (GET /auth/me/feed).
export default function MyFeed() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState('');
  // Set once the reader leaves the starter picks, so following the first item does not hide them.
  const [onboarding, setOnboarding] = useState<boolean | null>(null);
  const suggestions = useSuggestions();
  const saved = prefs.useValue();
  const hidden = new Set(saved?.hiddenMedia ?? []);
  const load = () =>
    readerFetch<Feed>('/auth/me/feed')
      .then(setFeed)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  if (error) return <p className={note}>{error}</p>;
  if (!feed) return <p className={note}>載入中…</p>;
  if (onboarding ?? !feed.follows.length)
    return (
      <Onboarding
        onDone={() => {
          setOnboarding(false);
          load();
        }}
      />
    );
  const hide = async (media: string) => {
    await savePrefs({ hiddenMedia: [...hidden, media] });
    await load();
  };
  const articles = feed.articles.filter((a) => !hidden.has(a.media));
  return (
    <div className="space-y-8">
      {feed.events.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">追蹤的事件</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {feed.events.map((e) => (
              <li key={e.id} className={`${card} p-3`}>
                <p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className={`h-2 w-2 rounded-full ${e.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} aria-hidden="true" />
                  {e.active ? '進行中' : '已沉寂'} · 最近更新 {when(e.lastTime)}
                </p>
                <Link href={`/eve/${e.id}/`} className="mt-1 block font-medium hover:underline">
                  {e.title}
                </Link>
                <ul className="mt-2 space-y-1">
                  {e.headlines.slice(1).map((h) => (
                    <li key={h.url} className="text-xs text-zinc-600 dark:text-zinc-400">
                      【{h.mediaTitle}】{h.title}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="text-lg font-semibold">
          近 {feed.days} 天的報導<span className="ml-2 text-sm font-normal text-zinc-500">{articles.length} 篇</span>
        </h2>
        {!articles.length ? (
          <p className={note}>這段期間沒有符合追蹤條件的報導。</p>
        ) : (
          <ul className={`${card} mt-3 divide-y divide-zinc-200 dark:divide-zinc-800`}>
            {articles.map((a) => (
              <li key={a.id} className="px-3 py-2.5">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <Link href={`/media/${encodeURIComponent(a.media)}/`} className="font-medium hover:underline">
                    {a.mediaTitle}
                  </Link>
                  <time dateTime={a.publishedAt} className="tabular-nums">
                    {when(a.publishedAt)}
                  </time>
                  {a.matched.map((f) => (
                    <Link key={`${f.kind}:${f.target}`} href={followHref(f)} className={chip}>
                      {label(f, a)}
                    </Link>
                  ))}
                </p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <Link href={`/article/${a.id}/`} className="font-medium leading-snug hover:underline">
                    {a.title}
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <SaveButton kind="article" id={a.id} className="!min-h-7 !px-2 !text-xs" />
                    <button
                      type="button"
                      onClick={() => hide(a.media)}
                      title={`我的動態與私人 RSS 不再顯示${a.mediaTitle}（可在設定取消）`}
                      className="min-h-7 rounded-full px-2 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      隱藏這家
                    </button>
                  </div>
                </div>
                <SourceLink url={a.url} showUrl className="!min-h-5 !text-[11px]" />
              </li>
            ))}
          </ul>
        )}
      </section>
      {suggestions && <Recommended data={suggestions} />}
    </div>
  );
}
