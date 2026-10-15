'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { TagRelationType } from '@/lib/api';
import { loginHref, useSession } from '@/lib/session';

const field = 'mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700';

const NAMES: Record<TagRelationType, string> = { 'is-a': '分類', related: '相關詞', alias: '別名' };

/**
 * Propose a relation; it joins the vote on /tag/<tag>/relations/. That page
 * passes the type its tabs chose (fixedType) and reloads after a proposal.
 */
export default function TagRelationSubmission({
  tag,
  fixedType,
  onDone,
}: {
  tag: string;
  fixedType?: TagRelationType;
  onDone?: () => void;
}) {
  const session = useSession();
  const [chosenType, setType] = useState<TagRelationType>('related');
  const type = fixedType ?? chosenType;
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    const normalized = target.trim();
    if (normalized === tag || [...normalized].length > 60 || /[\p{Cc}\p{Cs}]/u.test(normalized)) {
      setError('請填寫不同的有效標籤（最多 60 字）。');
      return;
    }
    if (!normalized || !reason.trim() || !['related', 'is-a', 'alias'].includes(type)) return;
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
        body: JSON.stringify({ type, target: target.trim(), reason: reason.trim() }),
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
  return (
    <section className="mt-6 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
      <h2 className="font-semibold">提出一個{NAMES[type]}</h2>
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
          後可以投票，或提出新的分類、相關詞或別名。
        </p>
      ) : (
        <form aria-busy={busy} onSubmit={submit} className="space-y-3 pb-2">
          <p className="text-zinc-600 dark:text-zinc-400">
            送出後成為候選，其他讀者同意就會成立。一起出現在新聞中，不一定代表有分類或同義關係。
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {!fixedType && (
              <label>
                關係類型
                <select value={type} onChange={(e) => setType(e.target.value as TagRelationType)} className={field} disabled={busy}>
                  <option value="related">相關詞</option>
                  <option value="is-a">上位分類（此標籤屬於…）</option>
                  <option value="alias">同義或別名</option>
                </select>
              </label>
            )}
            <label>
              關鍵字
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                required
                maxLength={120}
                className={field}
                disabled={busy}
                placeholder={type === 'is-a' ? '例如：政治人物' : '要關聯的關鍵字'}
              />
            </label>
          </div>
          <label className="block">
            理由與來源
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={1000}
              rows={3}
              className={field}
              disabled={busy}
              placeholder="請附上可查證的說明或來源網址，勿填寫私人資料。"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !target.trim() || !reason.trim()}
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
