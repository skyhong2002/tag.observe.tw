'use client';

import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import { useSession } from '@/lib/session';
import { adminFetch, note } from '../AdminGate';

type Account = {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  role: 'admin' | 'reader';
  // 'config' = TAG_ADMIN_EMAILS in .env, which only the server config can change.
  adminSource: 'config' | 'granted' | null;
  grantedBy: string | null;
  createdAt: string;
  lastLoginAt: string;
};

const when = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short' });
const card = 'mt-3 rounded-lg border border-zinc-200 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-900';

// Who has signed in, and who is an admin (GET /auth/users, PUT /auth/users/:id/role).
export default function Accounts() {
  const me = useSession()?.user;
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const load = () =>
    adminFetch<{ users: Account[] }>('/auth/users')
      .then((body) => setAccounts(body.users))
      .catch(() => setAccounts([]));
  useEffect(() => {
    load();
  }, []);
  async function setRole(account: Account, role: Account['role']) {
    const who = account.name ?? account.email;
    if (!confirm(role === 'admin' ? `把 ${who} 設為管理員？` : `取消 ${who} 的管理員權限？`)) return;
    setBusy(account.id);
    setError('');
    try {
      await adminFetch(`/auth/users/${account.id}/role`, { method: 'PUT', body: { role } });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section>
      {accounts && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          共 {accounts.length} 個帳號，管理員 {accounts.filter((a) => a.role === 'admin').length} 個。
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!accounts ? (
        <p className={note}>載入中…</p>
      ) : (
        <ul className={`${card} divide-y divide-zinc-200 dark:divide-zinc-800`}>
          {accounts.map((account) => (
            <li key={account.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <Avatar src={account.picture} label={account.name ?? account.email} size={28} />
              <span className="font-medium">{account.name ?? account.email}</span>
              {account.name && <span className="text-zinc-500 dark:text-zinc-400">{account.email}</span>}
              <span
                className="text-xs text-zinc-500 dark:text-zinc-400"
                title={account.grantedBy ? `由 ${account.grantedBy} 設為管理員` : undefined}
              >
                {account.role === 'admin' ? (account.adminSource === 'config' ? '管理員（設定檔）' : '管理員') : '讀者'}
              </span>
              <span className="ml-auto text-xs text-zinc-500 tabular-nums dark:text-zinc-400">最近登入 {when(account.lastLoginAt)}</span>
              {account.adminSource !== 'config' && account.id !== me?.id && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setRole(account, account.role === 'admin' ? 'reader' : 'admin')}
                  className="min-h-8 rounded-full border border-zinc-300 px-3 text-xs hover:border-brand-600 disabled:opacity-50 dark:border-zinc-700"
                >
                  {busy === account.id ? '處理中…' : account.role === 'admin' ? '取消管理員' : '設為管理員'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
