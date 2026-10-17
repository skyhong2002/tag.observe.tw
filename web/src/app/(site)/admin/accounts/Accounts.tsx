'use client';

import { Fragment, useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import SortIndicator from '@/components/SortIndicator';
import TableScroller from '@/components/TableScroller';
import { useSession } from '@/lib/session';
import { table } from '@/lib/table-styles';
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
// GET /auth/admin/user-activity (app/src/admin/user-activity.ts).
type Group = 'use' | 'contribute' | 'admin';
type Activity = {
  metrics: Array<{ key: string; label: string; group: Group }>;
  users: Record<number, { counts: Record<string, number>; lastActiveAt: string | null }>;
};
type Row = Account & { counts: Record<string, number>; use: number; contribute: number; admin: number; lastActiveAt: string | null };
type SortKey = 'name' | 'role' | 'use' | 'contribute' | 'admin' | 'lastActiveAt' | 'lastLoginAt' | `m:${string}`;

// Short Taipei time for the columns (10/17 21:08); the year only when it is not this one.
// Rendered in the browser after the fetch, so server and client never disagree.
const when = (iso: string | null, full = false) => {
  if (!iso) return '—';
  const date = new Date(iso);
  const year = date.toLocaleString('en', { timeZone: 'Asia/Taipei', year: 'numeric' });
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    ...(full || year !== new Date().toLocaleString('en', { timeZone: 'Asia/Taipei', year: 'numeric' }) ? { year: 'numeric' } : {}),
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
};
const roleLabel = (a: Account) => (a.role === 'admin' ? (a.adminSource === 'config' ? '管理員＊' : '管理員') : '讀者');
const head = 'text-left text-xs text-zinc-600 dark:text-zinc-400';
const groupHead = `${table.cell} !py-1 border-b border-zinc-200 text-center font-medium dark:border-zinc-800`;

// Who has signed in, what they did on the site, and who is an admin
// (GET /auth/users, PUT /auth/users/:id/role). 互動 is a reader's own use,
// 貢獻 what they gave the site; admin edits are one column, itemised on hover/tap.
export default function Accounts() {
  const me = useSession()?.user;
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortKey>('lastActiveAt');
  const [descending, setDescending] = useState(true);
  const load = () =>
    adminFetch<{ users: Account[] }>('/auth/users')
      .then((body) => setAccounts(body.users))
      .catch(() => setAccounts([]));
  useEffect(() => {
    load();
    adminFetch<Activity>('/auth/admin/user-activity')
      .then(setActivity)
      .catch(() => setActivity({ metrics: [], users: {} }));
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
  if (!accounts) return <p className={note}>載入中…</p>;

  const metrics = activity?.metrics ?? [];
  const of = (group: Group) => metrics.filter((m) => m.group === group);
  const sum = (counts: Record<string, number>, group: Group) => of(group).reduce((n, m) => n + (counts[m.key] ?? 0), 0);
  const rows: Row[] = accounts.map((a) => {
    const counts = activity?.users[a.id]?.counts ?? {};
    return {
      ...a,
      counts,
      use: sum(counts, 'use'),
      // Admin edits are contributions too.
      contribute: sum(counts, 'contribute') + sum(counts, 'admin'),
      admin: sum(counts, 'admin'),
      lastActiveAt: activity?.users[a.id]?.lastActiveAt ?? null,
    };
  });
  const value = (r: Row): number | string => {
    if (sort === 'name') return (r.name ?? r.email).toLowerCase();
    if (sort === 'role') return r.role === 'admin' ? (r.adminSource === 'config' ? 2 : 1) : 0;
    if (sort === 'lastActiveAt' || sort === 'lastLoginAt') return r[sort] ? Date.parse(r[sort] as string) : 0;
    if (sort.startsWith('m:')) return r.counts[sort.slice(2)] ?? 0;
    return r[sort as 'use' | 'contribute' | 'admin'];
  };
  const sorted = [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    const order = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number);
    return (descending ? -order : order) || Date.parse(b.lastLoginAt) - Date.parse(a.lastLoginAt);
  });
  const sortBy = (key: SortKey) => {
    if (sort === key) setDescending(!descending);
    else {
      setSort(key);
      setDescending(key !== 'name');
    }
  };
  const th = (key: SortKey, label: string, className: string, title?: string, rowSpan?: number) => (
    <th
      key={key}
      rowSpan={rowSpan}
      aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'}
      className={`${className} !py-1.5 align-bottom font-medium`}
      title={title}
    >
      <button
        type="button"
        onClick={() => sortBy(key)}
        className={`inline-flex items-center gap-0.5 whitespace-nowrap hover:text-brand-700 ${sort === key ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
      >
        {label}
        <SortIndicator active={sort === key} descending={descending} />
      </button>
    </th>
  );
  const count = (n: number, strong = false, title?: string) => (
    <td className={`${table.num} !py-1.5 ${n ? (strong ? 'font-medium' : '') : 'text-zinc-400 dark:text-zinc-600'}`} title={title}>
      {n ? n.toLocaleString() : '—'}
    </td>
  );
  const adminTitle = (r: Row) =>
    of('admin')
      .filter((m) => r.counts[m.key])
      .map((m) => `${m.label} ${r.counts[m.key]}`)
      .join('、') || undefined;
  const active7 = rows.filter((r) => r.lastActiveAt && Date.now() - Date.parse(r.lastActiveAt) < 7 * 86400e3).length;

  return (
    <section className="space-y-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        共 {accounts.length} 個帳號，管理員 {accounts.filter((a) => a.role === 'admin').length} 個
        {activity && `，近 7 天有活動 ${active7} 個`}。
      </p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <TableScroller card label="帳號與活動，可左右捲動">
        <table className="w-full text-sm">
          <thead className={head}>
            <tr className="bg-(--table-head-bg)">
              {th('name', '帳號', table.leadHead, undefined, 2)}
              {th('role', '身分', table.cell, undefined, 2)}
              <th colSpan={2} className={groupHead}>
                合計
              </th>
              {of('use').length > 0 && (
                <th colSpan={of('use').length} className={groupHead} title="讀者自己的使用">
                  互動
                </th>
              )}
              {metrics.length > 0 && (
                <th colSpan={of('contribute').length + 1} className={groupHead} title="回報、投票、投稿與管理修改">
                  貢獻
                </th>
              )}
              <th colSpan={2} className={groupHead}>
                時間
              </th>
              <th rowSpan={2} className={`${table.cell} !py-1.5 align-bottom font-medium`}>
                <span className="sr-only">操作</span>
              </th>
            </tr>
            <tr className="bg-(--table-head-bg)">
              {th('use', '互動', table.num, '閱讀、追蹤、收藏的次數')}
              {th('contribute', '貢獻', table.num, '回報、投票、投稿與管理修改的次數')}
              {of('use').map((m) =>
                th(`m:${m.key}`, m.label, table.num, m.key === 'reads' ? '讀者開啟閱讀紀錄才會記，清除後歸零' : undefined),
              )}
              {of('contribute').map((m) => th(`m:${m.key}`, m.label, table.num))}
              {metrics.length > 0 &&
                th(
                  'admin',
                  '管理修改',
                  table.num,
                  of('admin')
                    .map((m) => m.label)
                    .join('、'),
                )}
              {th('lastActiveAt', '最近活動', table.cell)}
              {th('lastLoginAt', '最近登入', table.cell)}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.map((r) => (
              <tr key={r.id} className={`${table.row} whitespace-nowrap`}>
                <th
                  scope="row"
                  className={`${table.lead} !py-1.5 text-left font-normal`}
                  title={`${r.email} · ${when(r.createdAt, true)} 加入`}
                >
                  <span className={`${table.leadBox} flex items-center gap-2`}>
                    <Avatar src={r.picture} label={r.name ?? r.email} size={24} />
                    <span className={`${table.leadText} font-medium`}>{r.name ?? r.email}</span>
                  </span>
                </th>
                <td
                  className={`${table.cell} !py-1.5 text-xs text-zinc-600 dark:text-zinc-400`}
                  title={
                    r.adminSource === 'config'
                      ? '寫在 TAG_ADMIN_EMAILS，這裡不能取消'
                      : r.grantedBy
                        ? `由 ${r.grantedBy} 設為管理員`
                        : undefined
                  }
                >
                  {roleLabel(r)}
                </td>
                {count(r.use, true)}
                {count(r.contribute, true)}
                {of('use').map((m) => (
                  <Fragment key={m.key}>{count(r.counts[m.key] ?? 0)}</Fragment>
                ))}
                {of('contribute').map((m) => (
                  <Fragment key={m.key}>{count(r.counts[m.key] ?? 0)}</Fragment>
                ))}
                {metrics.length > 0 && count(r.admin, false, adminTitle(r))}
                <td className={`${table.cell} !py-1.5 tabular-nums`}>{when(r.lastActiveAt)}</td>
                <td className={`${table.cell} !py-1.5 tabular-nums text-zinc-600 dark:text-zinc-400`}>{when(r.lastLoginAt)}</td>
                <td className={`${table.cell} !py-1.5 text-right`}>
                  {r.adminSource !== 'config' && r.id !== me?.id && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setRole(r, r.role === 'admin' ? 'reader' : 'admin')}
                      className="min-h-7 rounded-full border border-zinc-300 px-3 text-xs hover:border-brand-600 disabled:opacity-50 dark:border-zinc-700"
                    >
                      {busy === r.id ? '處理中…' : r.role === 'admin' ? '取消管理員' : '設為管理員'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroller>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        互動是讀者自己的使用（閱讀紀錄只在讀者開啟時才記）；貢獻是回報錯誤、投票、投稿與管理修改。管理修改依各項修改紀錄計算，游標移到（手機點一下）數字上可看細項。最近活動是以上任一項的最後時間；游標移到名字上可看
        Email 和加入時間。
      </p>
    </section>
  );
}
