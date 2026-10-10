'use client';

import { useEffect, useState } from 'react';
import { loadSession } from './session';

// A signed-in reader's own data, from the gateway's /auth/me/* routes
// (app/src/reader/routes.ts, docs/login.md#讀者功能). Pages stay static: these
// are fetched in the browser, once per page load, and shared by every button
// on the page through a small store.

export type FollowKind = 'tag' | 'media' | 'journalist' | 'event';
export type Follow = { kind: FollowKind; target: string /** An outlet's name. */; label?: string };
export type SaveKind = 'article' | 'event';
export type Save = {
  kind: SaveKind;
  id: number;
  note: string | null;
  savedAt: string;
  article?: { id: number; media: string; mediaTitle: string; title: string; url: string; publishedAt: string } | null;
  event?: { id: number; tags: string[]; lastTime: string } | null;
};
export type Prefs = { theme?: 'light' | 'dark' | null; analyticsOptOut?: boolean; hiddenMedia?: string[]; history?: boolean };

export const FOLLOW_NOUN: Record<FollowKind, string> = { tag: '標籤', media: '媒體', journalist: '記者', event: '事件' };

/** JSON call to /auth/me/*; throws the server's error message. */
export async function readerFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    ...(init.body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(body.error ?? `HTTP ${response.status}`);
  return body as T;
}

/** A value loaded once per page and pushed to every subscriber when it changes. */
function store<T>(load: () => Promise<T>) {
  let value: T | undefined;
  let pending: Promise<T> | null = null;
  const listeners = new Set<(value: T) => void>();
  const set = (next: T) => {
    value = next;
    for (const listener of listeners) listener(next);
  };
  const get = () => {
    pending ??= load().then((v) => {
      set(v);
      return v;
    });
    return pending;
  };
  function useValue(): T | undefined {
    const [state, setState] = useState<T | undefined>(value);
    useEffect(() => {
      listeners.add(setState);
      get().catch(() => {});
      return () => {
        listeners.delete(setState);
      };
    }, []);
    return state;
  }
  return { get, set, useValue };
}

/** null when nobody is signed in (or sign-in is off). */
const signedIn = async () => Boolean((await loadSession()).user);

export const follows = store<Follow[] | null>(async () =>
  (await signedIn()) ? (await readerFetch<{ follows: Follow[] }>('/auth/me/follows')).follows : null,
);
export async function setFollow(follow: Follow, on: boolean) {
  const body = await readerFetch<{ follows: Follow[] }>('/auth/me/follows', { method: 'PUT', body: { ...follow, follow: on } });
  follows.set(body.follows);
}

export const saves = store<Save[] | null>(async () =>
  (await signedIn()) ? (await readerFetch<{ saves: Save[] }>('/auth/me/saves')).saves : null,
);
export async function setSave(kind: SaveKind, id: number, saved: boolean, note?: string | null) {
  const body = await readerFetch<{ saves: Save[] }>('/auth/me/saves', { method: 'PUT', body: { kind, id, saved, note } });
  saves.set(body.saves);
}

export const prefs = store<Prefs | null>(async () =>
  (await signedIn()) ? (await readerFetch<{ prefs: Prefs }>('/auth/me/prefs')).prefs : null,
);
/** Saves a change for a signed-in reader; does nothing for everyone else. */
export async function savePrefs(change: Prefs) {
  if (!(await signedIn())) return null;
  const body = await readerFetch<{ prefs: Prefs }>('/auth/me/prefs', { method: 'PUT', body: change });
  prefs.set(body.prefs);
  return body.prefs;
}

export const when = (iso: string) =>
  new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export const followHref = (f: Follow) =>
  f.kind === 'tag'
    ? `/tag/${encodeURIComponent(f.target)}/`
    : f.kind === 'media'
      ? `/media/${encodeURIComponent(f.target)}/`
      : f.kind === 'journalist'
        ? `/journalist/${encodeURIComponent(f.target)}/`
        : `/eve/${f.target}/`;
