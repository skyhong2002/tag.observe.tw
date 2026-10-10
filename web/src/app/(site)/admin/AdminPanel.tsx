'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import AdminGate, { adminFetch, note } from './AdminGate';
import { type Definition, LabelChip, type Outlet, OutletIcon } from './media/labels';

type Account = {
  email: string;
  name: string | null;
  picture: string | null;
  role: 'admin' | 'reader';
  createdAt: string;
  lastLoginAt: string;
};

const when = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short' });
const card = 'mt-3 rounded-lg border border-zinc-200 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-900';

export default function AdminPanel() {
  return (
    <AdminGate next="/admin/">
      <Bookmarklet />
      <Outlets />
      <Accounts />
      <Database />
    </AdminGate>
  );
}

// Adminer behind the gateway (app/src/admin/db-console.ts), signed in as the
// admin's own MariaDB account.
function Database() {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">資料庫</h2>
      <p className={note}>用 Adminer 直接查詢或修改資料。會自動以你自己的資料庫帳號登入，每一筆查詢都記在 MariaDB 的稽核紀錄裡。</p>
      <a
        href="/admin/db/"
        className="mt-3 inline-flex min-h-9 items-center rounded-full border border-zinc-300 px-4 text-sm hover:border-brand-600 dark:border-zinc-700"
      >
        開啟資料庫
      </a>
    </section>
  );
}

// A bookmark that opens /admin/media/ for whatever news page is showing.
function Bookmarklet() {
  const link = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const source = `javascript:location.href='${location.origin}/admin/media/?url='+encodeURIComponent(location.href)`;
    // React refuses javascript: hrefs, so set it on the element directly.
    link.current?.setAttribute('href', source);
    setCode(source);
  }, []);
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">從新聞網站直接設定</h2>
      <p className={note}>
        把下面的按鈕拖到 Chrome
        的書籤列。之後在任何新聞網站的文章頁按這個書籤，就會跳到這家媒體的設定頁，可以調整標籤（藍營、綠營、新聞、非主流…）、重抓這篇文章或馬上跑爬蟲。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          ref={link}
          href="/admin/media/"
          onClick={(event) => event.preventDefault()}
          className="inline-flex min-h-9 cursor-grab items-center rounded-full bg-brand-700 px-4 text-sm font-medium text-white shadow-sm dark:bg-brand-600"
        >
          設定這家媒體
        </a>
        <button
          type="button"
          disabled={!code}
          onClick={() => navigator.clipboard.writeText(code).then(() => setCopied(true))}
          className="min-h-9 rounded-full border border-zinc-300 px-3 text-sm hover:border-brand-600 dark:border-zinc-700"
        >
          {copied ? '已複製' : '複製書籤網址'}
        </button>
      </div>
      <details className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        <summary className="cursor-pointer">沒辦法拖曳？手動加入</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>按「複製書籤網址」。</li>
          <li>在 Chrome 書籤列按右鍵 →「新增網頁…」。</li>
          <li>名稱填「設定這家媒體」，網址欄貼上剛才複製的內容，儲存。</li>
        </ol>
      </details>
    </section>
  );
}

function Outlets() {
  const [data, setData] = useState<{ media: Outlet[]; categories: Definition[] } | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    adminFetch<{ media: Outlet[]; categories: Definition[] }>('/auth/admin/media')
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);
  const labels = useMemo(() => new Map(data?.categories.map((d) => [d.key, d.label])), [data]);
  const q = query.trim().toLowerCase();
  const shown = (data?.media ?? []).filter(
    (o) => !q || o.media.includes(q) || o.title.toLowerCase().includes(q) || o.categories.some((c) => labels.get(c)?.includes(q)),
  );
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">媒體標籤{data ? `（${data.media.length} 家）` : ''}</h2>
      {error ? (
        <p className={note}>{error}</p>
      ) : !data ? (
        <p className={note}>載入中…</p>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋媒體名稱、代碼或標籤"
            className="mt-3 w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <ul className={`${card} max-h-[28rem] divide-y divide-zinc-200 overflow-y-auto dark:divide-zinc-800`}>
            {shown.map((o) => (
              <li key={o.media}>
                <Link
                  href={`/admin/media/?media=${o.media}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <OutletIcon outlet={o} />
                  <span className="font-medium">{o.title}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{o.media}</span>
                  <span className="ml-auto flex flex-wrap gap-1">
                    {o.categories.map((c) => (
                      <LabelChip key={c} keyName={c} label={labels.get(c) ?? c} />
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Accounts() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  useEffect(() => {
    adminFetch<{ users: Account[] }>('/auth/users')
      .then((body) => setAccounts(body.users))
      .catch(() => setAccounts([]));
  }, []);
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">登入過的帳號{accounts ? `（${accounts.length}）` : ''}</h2>
      {!accounts ? (
        <p className={note}>載入中…</p>
      ) : (
        <ul className={`${card} divide-y divide-zinc-200 dark:divide-zinc-800`}>
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
  );
}
