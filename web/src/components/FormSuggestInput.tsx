'use client';

import { useRouter } from 'next/navigation';
import { type Ref, useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import MediaIcon from '@/components/MediaIcon';
import SuggestInput, { type Suggestion } from '@/components/SuggestInput';

// SuggestInput for plain GET forms rendered by server components, which cannot
// hand a suggest function across the client boundary. `source` names where the
// suggestions come from; picking one fills the box and submits the form (unless
// submitOnPick is off), or
// opens the item's own page when it has one (a topic, a keyword with go).

export type SuggestItem = { value: string; label?: string; hint?: string; media?: string; href?: string };
export type SuggestSource =
  /** Keywords from /api/v1/tags/suggest (articles in 14 days); `local` (e.g. this outlet's own terms) are listed first. */
  | { kind: 'tags'; local?: string[]; go?: boolean }
  /** Byline names of every kind from /api/v1/bylines. */
  | { kind: 'credits'; hours?: number }
  /** 議題／專題 titles from /api/v1/topics; picking opens the topic. */
  | { kind: 'topics'; topicKind: 'topic' | 'feature' }
  | { kind: 'list'; items: SuggestItem[] };

const tagHref = (tag: string) => `/tag/${encodeURIComponent(tag)}/`;
const includes = (text: string, typed: string) => text.toLocaleLowerCase().includes(typed.toLocaleLowerCase());

async function json<T>(path: string, signal: AbortSignal): Promise<T | null> {
  const response = await fetch(path, { signal });
  return response.ok ? ((await response.json()) as T) : null;
}

/** Keyword matches with their 14-day article counts, for client components. */
export async function fetchTagSuggestions(typed: string, signal: AbortSignal) {
  const data = await json<{ tags: Array<{ tag: string; articles: number }> }>(
    `/api/v1/tags/suggest?${new URLSearchParams({ q: typed })}`,
    signal,
  );
  return data?.tags ?? [];
}

async function suggestionsFor(source: SuggestSource, typed: string, signal: AbortSignal): Promise<SuggestItem[]> {
  if (source.kind === 'list')
    return source.items.filter((item) => includes(item.value, typed) || (item.label !== undefined && includes(item.label, typed)));
  if (source.kind === 'tags') {
    const local = (source.local ?? []).filter((tag) => includes(tag, typed));
    const remote = local.length >= 8 ? [] : await fetchTagSuggestions(typed, signal);
    const counts = new Map(remote.map((row) => [row.tag, row.articles]));
    const seen = new Set(local);
    return [...local, ...[...counts.keys()].filter((tag) => !seen.has(tag))].map((tag) => ({
      value: tag,
      hint: seen.has(tag) ? '此媒體常用' : `${(counts.get(tag) ?? 0).toLocaleString('zh-TW')} 篇`,
      href: source.go ? tagHref(tag) : undefined,
    }));
  }
  if (source.kind === 'credits') {
    const data = await json<{ bylines: Array<{ name: string; articles: number; outlets: Array<{ media: string; name: string }> }> }>(
      `/api/v1/bylines?${new URLSearchParams({ q: typed, hours: String(source.hours ?? 168) })}`,
      signal,
    );
    return (data?.bylines ?? []).map((entry) => ({
      value: entry.name,
      media: entry.outlets[0]?.media,
      hint: `${entry.outlets[0]?.name ?? ''} ${entry.articles.toLocaleString('zh-TW')} 篇`,
    }));
  }
  const data = await json<{
    topics: Array<{ id: string; title: string | null; media: string; mediaTitle: string; kind?: string }>;
  }>(`/api/v1/topics?${new URLSearchParams({ kind: source.topicKind, q: typed })}`, signal);
  return (data?.topics ?? []).flatMap((topic) =>
    topic.title
      ? [
          {
            value: topic.title,
            media: topic.media,
            hint: topic.mediaTitle,
            href: `/${source.topicKind}/${encodeURIComponent(topic.media)}/${encodeURIComponent(topic.id)}/`,
          },
        ]
      : [],
  );
}

export default function FormSuggestInput({
  source,
  defaultValue = '',
  inputRef,
  onEscape,
  submitOnPick = true,
  wrapperClassName,
  ...input
}: {
  source: SuggestSource;
  /** false in multi-field forms: picking only fills the box. */
  submitOnPick?: boolean;
  showOnEmpty?: boolean;
  name: string;
  defaultValue?: string;
  inputRef?: Ref<HTMLInputElement>;
  onEscape?: () => void;
  id?: string;
  type?: 'search' | 'text';
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  className?: string;
  wrapperClassName?: string;
  'aria-label'?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(defaultValue);
  const own = useRef<HTMLInputElement>(null);
  const items = useRef(new Map<string, SuggestItem>());
  const remote = source.kind !== 'list';
  // Server components rebuild `source` on every render; key the callback on its contents.
  const sourceKey = JSON.stringify(source);
  const suggest = useCallback(
    async (typed: string, signal: AbortSignal): Promise<Suggestion[]> => {
      const found = await suggestionsFor(JSON.parse(sourceKey) as SuggestSource, typed, signal);
      items.current = new Map(found.map((item) => [item.href ?? item.value, item]));
      return found.map((item) => ({
        key: item.href ?? item.value,
        label: item.label ?? item.value,
        hint: item.hint,
        icon: item.media ? <MediaIcon media={item.media} size={14} /> : undefined,
      }));
    },
    [sourceKey],
  );
  return (
    <SuggestInput
      {...input}
      ref={(node) => {
        own.current = node;
        if (typeof inputRef === 'function') inputRef(node);
        else if (inputRef) inputRef.current = node;
      }}
      value={text}
      onValueChange={setText}
      suggest={suggest}
      delay={remote ? 150 : 0}
      wrapperClassName={wrapperClassName}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onEscape?.();
      }}
      onPick={(picked) => {
        const item = items.current.get(picked.key);
        if (!item) return;
        if (item.href) return router.push(item.href);
        flushSync(() => setText(item.value));
        if (submitOnPick) own.current?.form?.requestSubmit();
      }}
    />
  );
}
