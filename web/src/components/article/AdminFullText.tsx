'use client';

import { type ReactNode, useEffect, useState } from 'react';
import SourceLink from '@/components/SourceLink';
import { taipei } from '@/lib/api';
import { useSession } from '@/lib/session';

// Admins read the whole stored body (GET /auth/admin/articles/:id/body,
// app/src/admin/routes.ts) in place of the reader excerpt, past the public
// seven-day window too. The page itself stays static and cacheable: everyone
// gets the excerpt (`children`) first, and only an admin's browser swaps it.
// The gateway enforces admin access.

type FullText = {
  body: string | null;
  chars: number;
  status: string | null;
  source: string | null;
  fetchedAt: string | null;
  archived: boolean;
};

export default function AdminFullText({ id, sourceUrl, children }: { id: number; sourceUrl: string; children: ReactNode }) {
  const session = useSession();
  const admin = session?.user?.role === 'admin';
  const [text, setText] = useState<FullText | null>(null);
  useEffect(() => {
    if (!admin) return;
    let live = true;
    fetch(`/auth/admin/articles/${id}/body`, { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => (response.ok ? (response.json() as Promise<FullText>) : null))
      .then((body) => live && setText(body))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [admin, id]);
  if (!admin || !text?.body) return children;
  return (
    <section aria-label="全文（管理員）">
      <p className="mb-3 text-xs text-amber-800 dark:text-amber-300">
        {[
          '全文 · 管理員限定，讀者只看得到節錄',
          `${text.chars.toLocaleString('zh-TW')} 字`,
          text.fetchedAt && `擷取於 ${taipei(text.fetchedAt)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="whitespace-pre-wrap break-words text-[1.125rem] leading-[1.95] text-zinc-800 dark:text-zinc-200">{text.body}</p>
      <div className="mt-3">
        <SourceLink url={sourceUrl} label="原站文章" showUrl />
      </div>
    </section>
  );
}
