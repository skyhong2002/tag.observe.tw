'use client';

import Link from 'next/link';
import { useState } from 'react';
import SourceLink from '@/components/SourceLink';
import { type Save, saves, setSave, when } from '@/lib/reader';
import { button, card, field, note } from '../ReaderGate';

// Saved articles and events, newest first, each with the reader's own note.
export default function Saved() {
  const list = saves.useValue();
  if (list === undefined) return <p className={note}>載入中…</p>;
  if (!list?.length) return <p className={note}>還沒有收藏。在文章或事件頁按「收藏」，之後就能在這裡找到並加上註記。</p>;
  return (
    <ul className={`${card} divide-y divide-zinc-200 dark:divide-zinc-800`}>
      {list.map((s) => (
        <SavedRow key={`${s.kind}:${s.id}`} save={s} />
      ))}
    </ul>
  );
}

function SavedRow({ save }: { save: Save }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(save.note ?? '');
  const [error, setError] = useState('');
  const run = async (saved: boolean, nextNote?: string) => {
    setError('');
    try {
      await setSave(save.kind, save.id, saved, nextNote);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const a = save.article;
  const e = save.event;
  return (
    <li className="px-3 py-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {save.kind === 'article'
          ? a
            ? `${a.mediaTitle} · ${when(a.publishedAt)}`
            : '文章'
          : e
            ? `事件 · 最近更新 ${when(e.lastTime)}`
            : '事件'}
        <span className="ml-2">收藏於 {when(save.savedAt)}</span>
      </p>
      {save.kind === 'article' ? (
        a ? (
          <>
            <Link href={`/article/${a.id}/`} className="mt-1 block font-medium hover:underline">
              {a.title}
            </Link>
            <SourceLink url={a.url} showUrl className="!min-h-5 !text-[11px]" />
          </>
        ) : (
          <p className="mt-1 text-zinc-500">這篇文章已不在本站。</p>
        )
      ) : e ? (
        <Link href={`/eve/${e.id}/`} className="mt-1 block font-medium hover:underline">
          {e.tags.join('、') || `事件 #${e.id}`}
        </Link>
      ) : (
        <p className="mt-1 text-zinc-500">這個事件已不在本站。</p>
      )}
      {editing ? (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(true, text);
          }}
        >
          <textarea value={text} onChange={(ev) => setText(ev.target.value)} rows={2} maxLength={500} className={field} aria-label="註記" />
          <div className="flex gap-2">
            <button type="submit" className={button}>
              儲存註記
            </button>
            <button type="button" className={button} onClick={() => setEditing(false)}>
              取消
            </button>
          </div>
        </form>
      ) : (
        save.note && (
          <p className="mt-2 whitespace-pre-wrap rounded bg-amber-50 px-2 py-1 text-zinc-800 dark:bg-amber-950/40 dark:text-zinc-200">
            {save.note}
          </p>
        )
      )}
      {!editing && (
        <div className="mt-2 flex gap-2">
          <button type="button" className={button} onClick={() => setEditing(true)}>
            {save.note ? '修改註記' : '加註記'}
          </button>
          <button type="button" className={button} onClick={() => run(false)}>
            取消收藏
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p>}
    </li>
  );
}
