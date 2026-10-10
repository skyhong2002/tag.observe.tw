'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FOLLOW_NOUN, type Follow, type FollowKind, followHref, follows, setFollow } from '@/lib/reader';
import { button, card, field, note } from '../ReaderGate';

const KINDS: FollowKind[] = ['tag', 'media', 'journalist', 'event'];

// Everything the reader follows, by kind, with a way to stop following and to
// add a tag by name (other kinds are followed from their own pages).
export default function Following() {
  const list = follows.useValue();
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');
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
          if (tag.trim() && (await run({ kind: 'tag', target: tag.trim() }, true))) setTag('');
        }}
      >
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          maxLength={60}
          placeholder="輸入標籤，例如：颱風"
          aria-label="要追蹤的標籤"
          className={`${field} w-full max-w-xs`}
        />
        <button type="submit" className={button} disabled={!tag.trim()}>
          追蹤這個標籤
        </button>
      </form>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!list?.length && <p className={note}>還沒有追蹤任何東西。媒體、記者與事件請到各自的頁面按「追蹤」。</p>}
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
