'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FOLLOW_NOUN, type FollowKind, follows, setFollow } from '@/lib/reader';
import { loginHref, useSession } from '@/lib/session';

export const pill =
  'inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
export const pillOff =
  'border-zinc-300 text-zinc-700 hover:border-brand-600 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-brand-400';
export const pillOn = 'border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-200';

// 追蹤 a tag, outlet, journalist or event; followed items make up 我的動態 (/my/).
// Signed-out readers get a link to sign in and come back here; nothing shows
// while the session loads or when sign-in is off.
export default function FollowButton({ kind, target, className = '' }: { kind: FollowKind; target: string; className?: string }) {
  const session = useSession();
  const list = follows.useValue();
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!session?.enabled) return null;
  if (!session.user)
    return (
      <a href={loginHref(path)} className={`${pill} ${pillOff} ${className}`} title={`登入後追蹤這個${FOLLOW_NOUN[kind]}`}>
        <Plus /> 追蹤
      </a>
    );
  const on = Boolean(list?.some((f) => f.kind === kind && f.target === target));
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!list || busy}
      title={error || (on ? `取消追蹤這個${FOLLOW_NOUN[kind]}` : `追蹤後會出現在「我的動態」`)}
      onClick={async () => {
        setBusy(true);
        setError('');
        try {
          await setFollow({ kind, target }, !on);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      className={`${pill} ${on ? pillOn : pillOff} ${className}`}
    >
      {on ? <Check /> : <Plus />}
      {on ? '已追蹤' : '追蹤'}
      {error && <span className="sr-only">：{error}</span>}
    </button>
  );
}

const Plus = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);
const Check = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);
