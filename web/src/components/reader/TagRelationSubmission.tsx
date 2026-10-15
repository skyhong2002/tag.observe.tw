'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { fetchTagSuggestions } from '@/components/FormSuggestInput';
import SuggestInput, { type Suggestion } from '@/components/SuggestInput';
import type { TagRelationType } from '@/lib/api';
import { loginHref, useSession } from '@/lib/session';

const field = 'mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700';
const pill = 'min-h-9 flex-1 rounded-full border px-2 text-sm disabled:opacity-50';

type Group = { id: number; label: string; kind: 'group' | 'topic'; curated?: boolean };

/**
 * Propose a relation; it joins the vote on /tag/<tag>/relations/. The box
 * suggests existing categories (curated rosters such as 2024 立委 are not
 * offered: they follow official lists) and keywords; picking a category asks
 * 「屬於」, a keyword 「相關」. The reason is optional.
 */
export default function TagRelationSubmission({ tag, onDone }: { tag: string; onDone?: () => void }) {
  const session = useSession();
  const [type, setType] = useState<TagRelationType>('related');
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const pending = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    fetch('/api/v1/tag-groups')
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((body: { groups: Group[] }) => live.current && setGroups(body.groups.filter((g) => g.kind === 'group' && !g.curated)))
      .catch(() => {});
  }, []);
  const suggest = useCallback(
    async (typed: string, signal: AbortSignal, partial: (items: Suggestion[]) => void) => {
      const needle = typed.toLocaleLowerCase();
      const categories = groups
        .filter((g) => g.label.toLocaleLowerCase().includes(needle))
        .slice(0, 4)
        .map((g) => ({ key: `group:${g.label}`, label: g.label, hint: '分類' }));
      partial(categories);
      const tags = await fetchTagSuggestions(typed, signal);
      return [
        ...categories,
        ...tags
          .filter((t) => t.tag !== tag && !categories.some((c) => c.label === t.tag))
          .map((t) => ({ key: `tag:${t.tag}`, label: t.tag, hint: `${t.articles} 篇` })),
      ];
    },
    [groups, tag],
  );
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    const normalized = target.trim();
    if (normalized === tag || [...normalized].length > 60 || /[\p{Cc}\p{Cs}]/u.test(normalized)) {
      setError('請填寫不同的有效標籤（最多 60 字）。');
      return;
    }
    if (!normalized || !['related', 'is-a', 'alias'].includes(type)) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/auth/tags/${encodeURIComponent(tag)}/relations`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, target: normalized, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `送出失敗（${response.status}）`);
      if (!live.current) return;
      setMessage(
        body.status === 'revoked'
          ? '這筆關係先前已被管理員撤下，這次沒有新增。'
          : body.status === 'rejected'
            ? '這筆關係管理員已決定不成立，這次沒有新增。'
            : body.status === 'approved'
              ? '這筆關係已經成立。'
              : body.duplicate
                ? '這筆關係已經在投票中。'
                : '已加入投票。其他讀者同意後就會成立。',
      );
      setTarget('');
      setReason('');
      onDone?.();
    } catch (err) {
      if (live.current) setError((err as Error).message);
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  const types: [TagRelationType, string][] = [
    ['is-a', `${tag}屬於它`],
    ['related', '相關'],
    ['alias', '是別名'],
  ];
  return (
    <section className="mt-8 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
      <h2 className="text-base font-semibold">加一個</h2>
      {!session ? (
        <p role="status">正在確認登入狀態…</p>
      ) : !session.enabled ? (
        <p>登入功能暫時無法使用。</p>
      ) : !session.user ? (
        <p className="pb-2 text-zinc-600 dark:text-zinc-400">
          <a
            href={loginHref(`/tag/${encodeURIComponent(tag)}/relations/`)}
            className="inline-flex min-h-11 items-center text-brand-700 underline dark:text-brand-400"
          >
            登入
          </a>
          後可以回答問題，或提出新的分類、相關詞或別名。
        </p>
      ) : (
        <form aria-busy={busy} onSubmit={submit} className="mt-2 space-y-3 pb-2">
          <div>
            <SuggestInput
              aria-label="分類或關鍵字"
              value={target}
              onValueChange={setTarget}
              suggest={suggest}
              onPick={(picked) => {
                setTarget(picked.label);
                setType(picked.key.startsWith('group:') ? 'is-a' : 'related');
              }}
              delay={200}
              required
              maxLength={120}
              className={field}
              disabled={busy}
              placeholder="輸入分類或關鍵字，例如：民進黨"
            />
          </div>
          <fieldset className="flex gap-1.5" disabled={busy}>
            <legend className="sr-only">關係</legend>
            {types.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => setType(value)}
                className={`${pill} ${type === value ? 'border-brand-700 bg-brand-700 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <label className="block">
            <span className="text-zinc-600 dark:text-zinc-400">理由或來源（選填）</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              className={field}
              disabled={busy}
              placeholder="可附網址，勿填寫私人資料"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !target.trim()}
            className="min-h-11 rounded-full bg-brand-700 px-4 text-white disabled:opacity-50"
          >
            {busy ? '送出中…' : '加入投票'}
          </button>
          {message && (
            <p role="status" className="text-zinc-700 dark:text-zinc-300">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
