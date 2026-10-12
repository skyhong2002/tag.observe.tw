'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { useSession } from '@/lib/session';
import AdminGate, { adminFetch, note } from './AdminGate';
import { type Definition, LabelChip, type Outlet, OutletIcon } from './media/labels';
import Reports from './Reports';

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

export default function AdminPanel() {
  return (
    <AdminGate next="/admin/">
      <Reports />
      <Avatars />
      <TagVisualsLink />
      <WritingPeopleLink />
      <TagGroups />
      <Bookmarklet />
      <Outlets />
      <Accounts />
      <Database />
    </AdminGate>
  );
}

function Avatars() {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">人物頭像</h2>
      <p className={note}>人物標籤的素描頭像：確認自動挑選的結果、改用其他候選或隱藏。</p>
      <a
        href="/admin/avatars/"
        className="mt-3 inline-flex min-h-9 items-center rounded-full border border-zinc-300 px-4 text-sm hover:border-brand-600 dark:border-zinc-700"
      >
        檢視人物頭像
      </a>
    </section>
  );
}

function TagVisualsLink() {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">標籤圖像</h2>
      <p className={note}>非人物標籤的地圖輪廓、標誌、emoji 與圖示：確認 AI 挑的圖、改用其他圖示或上傳標誌。</p>
      <a
        href="/admin/tag-visuals/"
        className="mt-3 inline-flex min-h-9 items-center rounded-full border border-zinc-300 px-4 text-sm hover:border-brand-600 dark:border-zinc-700"
      >
        檢視標籤圖像
      </a>
    </section>
  );
}

function WritingPeopleLink() {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">發言者標籤</h2>
      <p className={note}>「看寫法」裡被轉述的發言者：設定角色或背景標籤，同一位發言者可有多個標籤。</p>
      <a
        href="/admin/writing/"
        className="mt-3 inline-flex min-h-9 items-center rounded-full border border-zinc-300 px-4 text-sm hover:border-brand-600 dark:border-zinc-700"
      >
        檢視發言者
      </a>
    </section>
  );
}

function TagGroups() {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">標籤群組</h2>
      <p className={note}>把標籤歸進身分群組（政治人物、現任立委、藝人…）與主題大類，確認或排除自動判斷的結果。</p>
      <a
        href="/admin/tag-groups/"
        className="mt-3 inline-flex min-h-9 items-center rounded-full border border-zinc-300 px-4 text-sm hover:border-brand-600 dark:border-zinc-700"
      >
        編輯標籤群組
      </a>
    </section>
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
    <section className="mt-8">
      <h2 className="text-lg font-semibold">登入過的帳號{accounts ? `（${accounts.length}）` : ''}</h2>
      <p className={note}>
        對方先用 Google 登入一次，就能在這裡設為管理員；下一次載入頁面即生效。標「設定檔」的管理員寫在伺服器的
        TAG_ADMIN_EMAILS，這裡不能取消。
      </p>
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
