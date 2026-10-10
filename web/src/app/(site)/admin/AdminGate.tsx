'use client';

import type { ReactNode } from 'react';
import { loginHref, useSession } from '@/lib/session';

export const note = 'mt-4 text-sm text-zinc-600 dark:text-zinc-400';

// Access is enforced by the gateway (/auth/admin/*); this only hides what a
// non-admin could not load anyway. `next` brings the admin back after login,
// query string included, so the bookmarklet's ?url= survives signing in.
export default function AdminGate({ next, children }: { next: string; children: ReactNode }) {
  const session = useSession();
  if (!session) return <p className={note}>載入中…</p>;
  if (!session.enabled) return <p className={note}>登入功能尚未開放。</p>;
  if (!session.user)
    return (
      <p className={note}>
        請先
        <a href={loginHref(next)} className="mx-1 text-brand-700 underline dark:text-brand-400">
          登入
        </a>
        。
      </p>
    );
  if (session.user.role !== 'admin') return <p className={note}>這個頁面只開放給管理員。</p>;
  return children;
}

/** JSON call to the gateway's admin API; throws the server's error message. */
export async function adminFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
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
