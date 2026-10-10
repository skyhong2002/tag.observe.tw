'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { type SaveKind, saves, setSave } from '@/lib/reader';
import { loginHref, useSession } from '@/lib/session';
import { pill, pillOff, pillOn } from './FollowButton';

// 收藏 an article or event to come back to at /my/saved/, where notes are added.
export default function SaveButton({ kind, id, className = '' }: { kind: SaveKind; id: number; className?: string }) {
  const session = useSession();
  const list = saves.useValue();
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!session?.enabled) return null;
  if (!session.user)
    return (
      <a href={loginHref(path)} className={`${pill} ${pillOff} ${className}`} title="登入後收藏">
        <Mark filled={false} /> 收藏
      </a>
    );
  const on = Boolean(list?.some((s) => s.kind === kind && s.id === id));
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!list || busy}
      title={error || (on ? '取消收藏' : '收藏後可在「我的收藏」找到，並加上註記')}
      onClick={async () => {
        setBusy(true);
        setError('');
        try {
          await setSave(kind, id, !on);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      className={`${pill} ${on ? pillOn : pillOff} ${className}`}
    >
      <Mark filled={on} />
      {on ? '已收藏' : '收藏'}
      {error && <span className="sr-only">：{error}</span>}
    </button>
  );
}

const Mark = ({ filled }: { filled: boolean }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    width="13"
    height="13"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinejoin="round"
  >
    <path d="M4 2.5h8v11L8 10.5l-4 3z" />
  </svg>
);
