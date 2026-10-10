'use client';

import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import { loginHref, useSession } from '@/lib/session';

type Account = {
  email: string;
  name: string | null;
  picture: string | null;
  role: 'admin' | 'reader';
  createdAt: string;
  lastLoginAt: string;
};

const when = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short' });

// Admin tools will live here (e.g. editing per-media tag rules that are
// hard-coded today). Access is enforced by the gateway; this page only hides
// what a non-admin could not load anyway.
export default function AdminPanel() {
  const session = useSession();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const admin = session?.user?.role === 'admin';
  useEffect(() => {
    if (!admin) return;
    fetch('/auth/users', { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : { users: [] }))
      .then((body: { users: Account[] }) => setAccounts(body.users))
      .catch(() => setAccounts([]));
  }, [admin]);

  const note = 'mt-4 text-sm text-zinc-600 dark:text-zinc-400';
  if (!session) return <p className={note}>載入中…</p>;
  if (!session.enabled) return <p className={note}>登入功能尚未開放。</p>;
  if (!session.user)
    return (
      <p className={note}>
        請先
        <a href={loginHref('/admin/')} className="mx-1 text-brand-700 underline dark:text-brand-400">
          登入
        </a>
        。
      </p>
    );
  if (!admin) return <p className={note}>這個頁面只開放給管理員。</p>;
  return (
    <>
      <p className={note}>管理功能（例如調整各媒體的標籤設定）之後會陸續加在這裡。</p>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">登入過的帳號{accounts ? `（${accounts.length}）` : ''}</h2>
        {!accounts ? (
          <p className={note}>載入中…</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {accounts.map((account) => (
              <li key={account.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <Avatar src={account.picture} label={account.name ?? account.email} size={28} />
                <span className="font-medium">{account.name ?? account.email}</span>
                {account.name && <span className="text-zinc-500 dark:text-zinc-400">{account.email}</span>}
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{account.role === 'admin' ? '管理員' : '讀者'}</span>
                <span className="ml-auto text-xs text-zinc-500 tabular-nums dark:text-zinc-400">最近登入 {when(account.lastLoginAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
