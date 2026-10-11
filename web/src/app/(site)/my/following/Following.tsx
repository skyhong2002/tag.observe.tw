'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import MediaIcon from '@/components/MediaIcon';
import SuggestInput, { type Suggestion } from '@/components/SuggestInput';
import { FOLLOW_NOUN, type Follow, type FollowKind, followHref, follows, setFollow } from '@/lib/reader';
import { button, card, field, note } from '../ReaderGate';
import { SuggestionPills } from '../Suggestions';

const KINDS: FollowKind[] = ['tag', 'media', 'journalist', 'event'];

// Outlet names for the box, fetched once when the page opens so outlets match
// as soon as they are typed, without a round trip.
let outletList: Promise<Array<{ media: string; name: string }>> | null = null;
const outlets = () => {
  outletList ??= fetch('/api/v1/media')
    .then((response): Promise<Record<string, { title?: string }>> => (response.ok ? response.json() : Promise.resolve({})))
    .then((map) => Object.entries(map).map(([media, value]) => ({ media, name: value.title ?? media })))
    .catch(() => {
      outletList = null;
      return [];
    });
  return outletList;
};
// Each request crosses the public edge (about half a second), so answers are
// kept for the page's lifetime: deleting back to an earlier prefix is instant.
const answers = new Map<string, Promise<unknown>>();
const getJson = <T,>(path: string): Promise<T | null> => {
  let answer = answers.get(path) as Promise<T | null> | undefined;
  if (!answer) {
    answer = fetch(path)
      .then((response) => (response.ok ? (response.json() as Promise<T>) : null))
      .catch(() => null);
    answer.then((value) => value === null && answers.delete(path));
    if (answers.size > 300) answers.delete(answers.keys().next().value as string);
    answers.set(path, answer);
  }
  return answer;
};
const day = (iso: string) => new Date(iso).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' });

type Found = Follow & { label: string; hint: string; icon?: string };
const KIND_ORDER: FollowKind[] = ['tag', 'media', 'journalist', 'event'];

/** Everything followable that matches: a few keywords, outlets, journalists and events,
 *  always in that order. Each source shows as soon as it answers (`emit`). */
async function followSuggestions(typed: string, signal: AbortSignal, emit: (items: Found[]) => void): Promise<Found[]> {
  const needle = typed.toLocaleLowerCase();
  const found: Record<FollowKind, Found[]> = { tag: [], media: [], journalist: [], event: [] };
  const all = () => KIND_ORDER.flatMap((kind) => found[kind]);
  const fill = async <T,>(kind: FollowKind, source: Promise<T>, toItems: (value: T) => Found[]) => {
    const value = await source;
    if (signal.aborted) return;
    found[kind] = toItems(value);
    emit(all());
  };
  await Promise.allSettled([
    fill('media', outlets(), (list) =>
      list
        .filter((outlet) => outlet.name.toLocaleLowerCase().includes(needle) || outlet.media.includes(needle))
        .slice(0, 3)
        .map((outlet) => ({ kind: 'media' as const, target: outlet.media, label: outlet.name, hint: '媒體', icon: outlet.media })),
    ),
    fill(
      'tag',
      getJson<{ tags: Array<{ tag: string; articles: number }> }>(`/api/v1/tags/suggest?${new URLSearchParams({ q: typed })}`),
      (data) =>
        (data?.tags ?? []).slice(0, 4).map((row) => ({
          kind: 'tag' as const,
          target: row.tag,
          label: `#${row.tag}`,
          hint: `標籤 · ${row.articles.toLocaleString('zh-TW')} 篇`,
        })),
    ),
    fill(
      'journalist',
      getJson<{ bylines: Array<{ name: string; articles: number; outlets: Array<{ media: string; name: string }> }> }>(
        `/api/v1/bylines?${new URLSearchParams({ q: typed, kind: 'person', hours: '168' })}`,
      ),
      (data) =>
        (data?.bylines ?? []).slice(0, 3).map((entry) => ({
          kind: 'journalist' as const,
          target: entry.name,
          label: entry.name,
          hint: `記者 · ${entry.outlets[0]?.name ?? ''} ${entry.articles.toLocaleString('zh-TW')} 篇`,
          icon: entry.outlets[0]?.media,
        })),
    ),
    fill(
      'event',
      getJson<{ threads: Array<{ id: number; tags: string[]; lastTime: string }> }>(
        `/api/v1/events/threads/suggest?${new URLSearchParams({ q: typed, limit: '3' })}`,
      ),
      (data) =>
        (data?.threads ?? []).map((thread) => ({
          kind: 'event' as const,
          target: String(thread.id),
          label: thread.tags.join('、'),
          hint: `事件 · ${day(thread.lastTime)}`,
        })),
    ),
  ]);
  return all();
}

// Everything the reader follows, by kind, with a way to stop following, a box
// that finds anything followable (keywords, outlets, journalists, events; picking
// one follows it at once, Enter alone follows the text as a tag), and suggested capsules to follow with one click.
export default function Following() {
  const list = follows.useValue();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [found, setFound] = useState(new Map<string, Follow>());
  const followedKey = (list ?? []).map((f) => `${f.kind}:${f.target}`).join('|');
  useEffect(() => {
    void outlets();
  }, []);
  const suggest = useCallback(
    async (typed: string, signal: AbortSignal, partial: (items: Suggestion[]) => void): Promise<Suggestion[]> => {
      const followed = new Set(followedKey.split('|'));
      const show = (items: Found[]) => {
        setFound(new Map(items.map((item) => [`${item.kind}:${item.target}`, { kind: item.kind, target: item.target }])));
        return items.map((item) => {
          const key = `${item.kind}:${item.target}`;
          return {
            key,
            label: item.label,
            hint: followed.has(key) ? `已追蹤 · ${item.hint}` : item.hint,
            icon: item.icon ? <MediaIcon media={item.icon} size={14} /> : undefined,
          };
        });
      };
      return show(await followSuggestions(typed, signal, (items) => partial(show(items))));
    },
    [followedKey],
  );
  if (list === undefined) return <p className={note}>載入中…</p>;
  const run = async (follow: Follow, on: boolean) => {
    setError('');
    try {
      await setFollow(follow, on);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  };
  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (text.trim() && (await run({ kind: 'tag', target: text.trim() }, true))) setText('');
        }}
      >
        <SuggestInput
          value={text}
          onValueChange={setText}
          suggest={suggest}
          delay={60}
          limit={13}
          onPick={async (item) => {
            const follow = found.get(item.key);
            if (follow && (await run(follow, true))) setText('');
          }}
          wrapperClassName="w-full max-w-md"
          maxLength={60}
          placeholder="搜尋標籤、媒體、記者或事件"
          aria-label="搜尋要追蹤的標籤、媒體、記者或事件"
          className={`${field} w-full`}
        />
        <button type="submit" className={button} disabled={!text.trim()}>
          追蹤為標籤
        </button>
      </form>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <SuggestionPills />
      {!list?.length && <p className={note}>還沒有追蹤任何東西。點上面的推薦，或在標籤、媒體、記者、事件頁按「追蹤」。</p>}
      {KINDS.map((kind) => {
        const ofKind = (list ?? []).filter((f) => f.kind === kind);
        return ofKind.length ? (
          <section key={kind}>
            <h2 className="font-semibold">
              {FOLLOW_NOUN[kind]}
              <span className="ml-2 text-sm font-normal text-zinc-500">{ofKind.length}</span>
            </h2>
            <ul className={`${card} mt-2 divide-y divide-zinc-200 dark:divide-zinc-800`}>
              {ofKind.map((f) => (
                <li key={f.target} className="flex items-center justify-between gap-3 px-3 py-2">
                  <Link href={followHref(f)} className="hover:underline">
                    {kind === 'tag' ? `#${f.target}` : kind === 'event' ? `事件 #${f.target}` : (f.label ?? f.target)}
                  </Link>
                  <button type="button" className={button} onClick={() => run(f, false)}>
                    取消追蹤
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null;
      })}
    </div>
  );
}
