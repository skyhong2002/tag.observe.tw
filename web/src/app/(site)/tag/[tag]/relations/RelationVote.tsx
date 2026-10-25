'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import TagRelationSubmission from '@/components/reader/TagRelationSubmission';
import type { TagRelation, TagRelationType } from '@/lib/api';
import { loginHref } from '@/lib/session';

// Readers decide a tag's relations (app/src/tag-groups/relation-votes.ts): the
// page asks one question at a time with the evidence behind it, and a relation
// is established once another reader agrees and agreements outnumber
// disagreements. Relations established before voting, locked by an admin, or
// kept from official lists (2024 立委…) are listed but not asked.

type Candidate = {
  key: string;
  type: TagRelationType;
  target: string;
  origin: 'submission' | 'suggestion' | 'cooccur' | 'alias';
  sourceLabel: string;
  note: string | null;
  evidence?: { text: string; href?: string }[];
  submissionId: number | null;
  status: 'voting' | 'established';
  agree: number;
  disagree: number;
  myVote: -1 | 0 | 1;
  mine: boolean;
};
type State = { signedIn: boolean; admin: boolean; candidates: Candidate[] };

const PREFIX: Record<TagRelationType, string> = { 'is-a': '屬於', related: '相關', alias: '又稱' };
// Readers' own proposals first, then what the data says, then plain co-occurrence.
const ORDER: Candidate['origin'][] = ['submission', 'alias', 'suggestion', 'cooccur'];
const note = 'mt-3 text-sm text-zinc-600 dark:text-zinc-400';
const answer = 'min-h-11 flex-1 rounded-full border px-2 text-base disabled:opacity-50';

function question(tag: string, c: Pick<Candidate, 'type' | 'target'>) {
  if (c.type === 'is-a') return `${tag}屬於「${c.target}」嗎？`;
  if (c.type === 'alias') return `「${c.target}」是${tag}的別名嗎？`;
  return `「${c.target}」和${tag}相關嗎？`;
}

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
  const [state, setState] = useState<State | null>(null);
  const [shown, setShown] = useState<TagRelation[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [skipped, setSkipped] = useState<string[]>([]);
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
      setShown(view.relations.filter((r) => !r.inherited));
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
  const queue = state.candidates
    .filter((c) => c.status === 'voting' && !c.mine && c.myVote === 0 && !skipped.includes(c.key))
    .sort((a, b) => ORDER.indexOf(a.origin) - ORDER.indexOf(b.origin) || b.agree - a.agree);
  const current = queue[0];
  const evidence = (c: Candidate) => c.evidence ?? (c.note ? [{ text: c.note }] : []);
  return (
    <>
      <section aria-labelledby="relations-shown" className="mt-4">
        <h2 id="relations-shown" className="text-sm text-zinc-600 dark:text-zinc-400">
          現在顯示在標籤頁上的
        </h2>
        {shown.length ? (
          <ul className="mt-1.5 flex flex-wrap gap-1.5 text-sm">
            {shown.map((r) => (
              <li key={r.id} className="max-w-full">
                <Link
                  prefetch={false}
                  href={r.target.href}
                  className="inline-flex max-w-full items-baseline gap-1 rounded-full border border-zinc-300 px-2.5 py-0.5 text-brand-800 hover:underline dark:border-zinc-700 dark:text-brand-300"
                >
                  <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">{PREFIX[r.type]}</span>
                  <span className="min-w-0 break-words">{r.target.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm">還沒有。</p>
        )}
      </section>

      <section aria-labelledby="relations-ask" className="mt-6">
        <h2 id="relations-ask" className="text-base font-semibold">
          幫忙判斷
          {queue.length > 0 && (
            <span className="ml-1 text-sm font-normal text-zinc-600 dark:text-zinc-400">（還有 {queue.length} 題）</span>
          )}
        </h2>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        {current ? (
          <div className="mt-2 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="flex justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span>{current.sourceLabel}</span>
              {current.agree + current.disagree > 0 && <span>{current.agree + current.disagree} 人回答過</span>}
            </p>
            <p className="mt-1 break-words text-lg font-semibold">{question(tag, current)}</p>
            {evidence(current).length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {evidence(current).map((e) => (
                  <li
                    key={e.text}
                    className="break-words border-l-2 border-zinc-300 pl-2 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    {e.href ? (
                      <Link prefetch={false} href={e.href} className="hover:underline">
                        {e.text}
                      </Link>
                    ) : (
                      e.text
                    )}
                  </li>
                ))}
              </ul>
            )}
            {state.signedIn ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy === current.key}
                  onClick={() => vote(current, 1)}
                  className={`${answer} border-brand-700 bg-brand-700 text-white`}
                >
                  是
                </button>
                <button
                  type="button"
                  disabled={busy === current.key}
                  onClick={() => vote(current, -1)}
                  className={`${answer} border-zinc-300 dark:border-zinc-700`}
                >
                  不是
                </button>
                <button
                  type="button"
                  disabled={busy === current.key}
                  onClick={() => setSkipped((s) => [...s, current.key])}
                  className={`${answer} max-w-24 border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400`}
                >
                  不確定
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm">
                <a href={loginHref(`/tag/${encodeURIComponent(tag)}/relations/`)} className="text-brand-700 underline dark:text-brand-400">
                  登入後回答
                </a>
                <button
                  type="button"
                  onClick={() => setSkipped((s) => [...s, current.key])}
                  className="ml-4 text-zinc-600 underline dark:text-zinc-400"
                >
                  看下一題
                </button>
              </p>
            )}
            {state.admin && current.submissionId !== null && (
              <p className="mt-2 flex gap-3 text-xs">
                <button type="button" className="underline" disabled={busy === current.key} onClick={() => lock(current, 'approved')}>
                  鎖定成立
                </button>
                <button type="button" className="underline" disabled={busy === current.key} onClick={() => lock(current, 'rejected')}>
                  鎖定不成立
                </button>
              </p>
            )}
          </div>
        ) : (
          <p className={note}>
            {state.candidates.some((c) => c.status === 'voting')
              ? '這個標籤的問題都看過了，謝謝。'
              : '目前沒有待判斷的問題，可以在下面加一個。'}
          </p>
        )}
        {queue[1] && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">下一題：{question(tag, queue[1])}</p>}
        <p className={note}>
          每題至少 1 位其他讀者回答「是」、且「是」比「不是」多，就會顯示在標籤頁。立委、縣市長等任期名冊依官方名單維護，不在這裡投票。
        </p>
      </section>

      {state.candidates.length > 0 && (
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer text-zinc-700 dark:text-zinc-300">全部候選與你的回答（{state.candidates.length}）</summary>
          <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
            {state.candidates.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 break-words">
                  {question(tag, c)}
                  <span className="ml-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {c.status === 'established' ? '已成立 · ' : ''}
                    {c.mine ? '你提出的 · ' : ''}是 {c.agree}・不是 {c.disagree}
                  </span>
                </span>
                {state.signedIn && !c.mine && (
                  <span className="flex shrink-0 gap-1">
                    {([1, -1] as const).map((value) => {
                      const on = c.myVote === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={busy === c.key}
                          aria-pressed={on}
                          onClick={() => vote(c, on ? 0 : value)}
                          className={`min-h-9 rounded-full border px-3 ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}
                        >
                          {value === 1 ? '是' : '不是'}
                        </button>
                      );
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <TagRelationSubmission tag={tag} onDone={() => void load()} />
    </>
  );
}
