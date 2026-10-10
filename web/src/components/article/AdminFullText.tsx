'use client';

import { useState } from 'react';
import { taipei } from '@/lib/api';
import { useSession } from '@/lib/session';

// Admins read the whole stored body (GET /auth/admin/articles/:id/body,
// app/src/admin/routes.ts), past the reader excerpt and the public seven-day
// window. The gateway enforces admin access; readers never see this section.

type FullText = {
  body: string | null;
  chars: number;
  status: string | null;
  source: string | null;
  fetchedAt: string | null;
  archived: boolean;
};

export default function AdminFullText({ id }: { id: number }) {
  const session = useSession();
  const [text, setText] = useState<FullText | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  if (session?.user?.role !== 'admin') return null;

  const toggle = async () => {
    if (open || text) return setOpen(!open);
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/auth/admin/articles/${id}/body`, { cache: 'no-store', credentials: 'same-origin' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(body.error ?? `HTTP ${response.status}`);
      setText(body as FullText);
      setOpen(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-label="全文（管理員）" className="my-8 rounded-lg border border-dashed border-amber-400 p-4 dark:border-amber-600">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-expanded={open}
          className="min-h-9 rounded-full border border-zinc-300 px-3 text-sm hover:border-brand-600 disabled:opacity-50 dark:border-zinc-700"
        >
          {loading ? '讀取中…' : open ? '收起全文' : '顯示全文'}
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">管理員限定，讀者只看得到節錄</span>
      </div>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {open && text && (
        <div className="mt-4">
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            {[
              text.body && `${text.chars.toLocaleString('zh-TW')} 字`,
              text.status && `狀態 ${text.status}`,
              text.source && `來源 ${text.source}`,
              text.fetchedAt && `擷取於 ${taipei(text.fetchedAt)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {text.body ? (
            <p className="whitespace-pre-wrap break-words text-[1.125rem] leading-[1.95] text-zinc-800 dark:text-zinc-200">{text.body}</p>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {text.archived ? '正文已移至封存，目前不在資料庫中。' : '資料庫裡沒有這篇的正文。'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
