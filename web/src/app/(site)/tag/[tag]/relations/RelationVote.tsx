'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import TagRelationSubmission from '@/components/reader/TagRelationSubmission';
import type { TagRelation, TagRelationType } from '@/lib/api';
import { loginHref } from '@/lib/session';

// Vote on a tag's relations (app/src/tag-groups/relation-votes.ts): one other
// reader agreeing, with more agreements than disagreements, establishes one.
// Relations established before voting, or locked by an admin, are shown but
// not on the ballot.

type Candidate = {
  key: string;
  type: TagRelationType;
  target: string;
  origin: 'submission' | 'suggestion' | 'cooccur';
  sourceLabel: string;
  note: string | null;
  submissionId: number | null;
  status: 'voting' | 'established';
  agree: number;
  disagree: number;
  myVote: -1 | 0 | 1;
  mine: boolean;
};
type State = { signedIn: boolean; admin: boolean; candidates: Candidate[] };

const TABS: { type: TagRelationType; label: string }[] = [
  { type: 'is-a', label: '屬於哪些分類' },
  { type: 'related', label: '相關詞' },
  { type: 'alias', label: '又稱（別名）' },
];
const note = 'mt-3 text-sm text-zinc-600 dark:text-zinc-400';
const pill = 'min-h-9 flex-1 rounded-full border px-2 text-sm disabled:opacity-50';

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
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

export default function RelationVote({ tag }: { tag: string }) {
  const [type, setType] = useState<TagRelationType>('is-a');
  const [state, setState] = useState<State | null>(null);
  const [fixed, setFixed] = useState<TagRelation[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const latest = useRef(0);
  const path = `/auth/tags/${encodeURIComponent(tag)}/relations`;
  const load = useCallback(async () => {
    const id = ++latest.current;
    try {
      const [candidates, view] = await Promise.all([
        call<State>(`${path}/candidates`),
        call<{ relations: TagRelation[] }>(`/api/v1/tags/${encodeURIComponent(tag)}/relations`),
      ]);
      if (id !== latest.current) return;
      setState(candidates);
      setFixed(view.relations.filter((r) => !r.inherited));
      setError('');
    } catch (err) {
      if (id === latest.current) setError((err as Error).message);
    }
  }, [path, tag]);
  useEffect(() => {
    void load();
  }, [load]);
  const vote = async (c: Candidate, value: -1 | 0 | 1) => {
    setBusy(c.key);
    try {
      const result = await call<{ candidates: Candidate[] }>(`${path}/vote`, { method: 'PUT', body: { key: c.key, value } });
      setState((current) => (current ? { ...current, candidates: result.candidates } : current));
      void load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  };
  const lock = async (c: Candidate, status: 'approved' | 'rejected') => {
    if (!c.submissionId) return;
    setBusy(c.key);
    try {
      await call(`/auth/admin/tag-submissions/${c.submissionId}`, {
        method: 'PUT',
        body: { status, reason: status === 'approved' ? '管理員在關係頁鎖定成立' : '管理員在關係頁鎖定不成立' },
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  };
  if (!state) return <p className={note}>{error || '載入中…'}</p>;
  const candidates = state.candidates.filter((c) => c.type === type);
  // Established before voting or locked: shown, not on the ballot.
  const locked = fixed.filter((r) => r.type === type && !candidates.some((c) => c.status === 'established' && c.target === r.target.label));
  const count = (t: TagRelationType) => state.candidates.filter((c) => c.type === t && c.status === 'voting').length;
  return (
    <>
      <p className={note}>大家同意的才會顯示：至少 1 位其他讀者同意、且同意比不同意多就成立。每人每筆一票，可以改投或取消。</p>
      {!state.signedIn && (
        <p className={note}>
          <a href={loginHref(`/tag/${encodeURIComponent(tag)}/relations/`)} className="text-brand-700 underline dark:text-brand-400">
            登入
          </a>
          後可以投票或提出新的關係。
        </p>
      )}
      <nav aria-label="關係類型" className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.type}
            type="button"
            aria-pressed={t.type === type}
            onClick={() => setType(t.type)}
            className={`min-h-9 rounded-full border px-3 text-sm ${t.type === type ? 'border-brand-700 bg-brand-700 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}
          >
            {t.label}
            {count(t.type) > 0 && <span className="ml-1 tabular-nums">· {count(t.type)}</span>}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {locked.length + candidates.length === 0 ? (
        <p className={note}>這一類還沒有任何關係，可以在下面提出第一個。</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {locked.map((r) => (
            <li key={r.id} className="rounded-lg border-2 border-brand-600 p-2 text-sm">
              <span className="block text-xs text-zinc-600 dark:text-zinc-400">已成立</span>
              <Link prefetch={false} href={r.target.href} className="block break-words text-base font-semibold hover:underline">
                {r.target.label}
              </Link>
            </li>
          ))}
          {candidates.map((c) => (
            <li
              key={c.key}
              className={`rounded-lg border-2 p-2 text-sm ${c.status === 'established' ? 'border-brand-600' : 'border-zinc-200 dark:border-zinc-800'}`}
            >
              <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                {c.status === 'established' ? '已成立 · ' : ''}
                {c.sourceLabel}
              </span>
              <span className="block break-words text-base font-semibold">{c.target}</span>
              {c.note && <span className="block break-words text-xs text-zinc-600 dark:text-zinc-400">{c.note}</span>}
              {c.mine ? (
                <p className="mt-2 rounded-full border border-dashed border-zinc-300 py-1 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                  由其他讀者投票 · {c.agree} 同意
                </p>
              ) : (
                <div className="mt-2 flex gap-1.5">
                  {([1, -1] as const).map((value) => {
                    const on = c.myVote === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={!state.signedIn || busy === c.key}
                        aria-pressed={on}
                        onClick={() => vote(c, on ? 0 : value)}
                        className={`${pill} ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-zinc-300 hover:border-brand-600 dark:border-zinc-700'}`}
                      >
                        {value === 1 ? '同意' : '不同意'} {value === 1 ? c.agree : c.disagree}
                      </button>
                    );
                  })}
                </div>
              )}
              {state.admin && c.submissionId !== null && c.status === 'voting' && (
                <span className="mt-1 flex justify-center gap-3 text-xs">
                  <button type="button" className="underline" disabled={busy === c.key} onClick={() => lock(c, 'approved')}>
                    鎖定成立
                  </button>
                  <button type="button" className="underline" disabled={busy === c.key} onClick={() => lock(c, 'rejected')}>
                    鎖定不成立
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <TagRelationSubmission key={type} tag={tag} fixedType={type} onDone={() => void load()} />
    </>
  );
}
