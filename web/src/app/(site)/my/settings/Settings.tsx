'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { prefs, readerFetch, savePrefs, when } from '@/lib/reader';
import { button, card, field, note, primary } from '../ReaderGate';

export default function Settings() {
  return (
    <div className="space-y-10">
      <PrivateFeed />
      <HiddenMedia />
      <Synced />
      <ApiKeys />
      <MyReports />
    </div>
  );
}

function Copy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className={button} onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}>
      {copied ? '已複製' : '複製'}
    </button>
  );
}

function PrivateFeed() {
  const [state, setState] = useState<{ url: string | null; createdAt: string | null } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    readerFetch<{ url: string | null; createdAt: string | null }>('/auth/me/feed-token')
      .then(setState)
      .catch((e: Error) => setError(e.message));
  }, []);
  const run = (method: 'POST' | 'DELETE') =>
    readerFetch<{ url: string | null; createdAt: string | null }>('/auth/me/feed-token', { method })
      .then(setState)
      .catch((e: Error) => setError(e.message));
  return (
    <section>
      <h2 className="text-lg font-semibold">私人 RSS</h2>
      <p className={note}>
        把「我的動態」訂閱到 RSS
        閱讀器（Feedly、Inoreader、NetNewsWire…），有新報導時就會看到。網址本身就是鑰匙，不要公開分享；外流時按「換一個網址」，舊網址立刻失效。
      </p>
      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
      {state &&
        (state.url ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={state.url}
                aria-label="私人 RSS 網址"
                className={`${field} w-full max-w-xl font-mono text-xs`}
                onFocus={(e) => e.target.select()}
              />
              <Copy text={state.url} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={button} onClick={() => confirm('舊網址會立刻失效，確定換一個？') && run('POST')}>
                換一個網址
              </button>
              <button type="button" className={button} onClick={() => confirm('停用後 RSS 閱讀器會讀不到，確定？') && run('DELETE')}>
                停用
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={`${primary} mt-3`} onClick={() => run('POST')}>
            建立私人 RSS 網址
          </button>
        ))}
    </section>
  );
}

function HiddenMedia() {
  const saved = prefs.useValue();
  const hidden = saved?.hiddenMedia ?? [];
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    readerFetch<Record<string, { title: string | null }>>('/api/v1/media')
      .then((body) => setNames(Object.fromEntries(Object.entries(body).map(([m, info]) => [m, info.title ?? m]))))
      .catch(() => {});
  }, []);
  return (
    <section>
      <h2 className="text-lg font-semibold">隱藏的媒體</h2>
      <p className={note}>在「我的動態」按「隱藏這家」的媒體，不會出現在動態與私人 RSS 裡。</p>
      {!hidden.length ? (
        <p className="mt-2 text-sm text-zinc-500">沒有隱藏任何媒體。</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {hidden.map((m) => (
            <li
              key={m}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 py-1 pl-3 pr-1 text-sm dark:border-zinc-700"
            >
              {names[m] ?? m}
              <button
                type="button"
                className="rounded-full px-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => savePrefs({ hiddenMedia: hidden.filter((x) => x !== m) })}
              >
                取消隱藏
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Synced() {
  return (
    <section>
      <h2 className="text-lg font-semibold">跨裝置同步</h2>
      <p className={note}>
        登入時，右上角的深淺色切換與
        <Link href="/observe/opt-out/" className="mx-1 text-brand-700 underline dark:text-brand-400">
          統計退出設定
        </Link>
        會存在帳號裡，換一台裝置登入也一樣。
        <Link href="/my/reading/" className="mx-1 text-brand-700 underline dark:text-brand-400">
          閱讀紀錄
        </Link>
        預設關閉，需要自己開啟。
      </p>
    </section>
  );
}

type Key = { id: number; prefix: string; label: string; createdAt: string; lastUsedAt: string | null };
function ApiKeys() {
  const [keys, setKeys] = useState<{ keys: Key[]; max: number } | null>(null);
  const [label, setLabel] = useState('');
  const [fresh, setFresh] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    readerFetch<{ keys: Key[]; max: number }>('/auth/me/api-keys')
      .then(setKeys)
      .catch((e: Error) => setError(e.message));
  }, []);
  const create = async () => {
    setError('');
    try {
      const body = await readerFetch<{ key: string; keys: Key[]; max: number }>('/auth/me/api-keys', { method: 'POST', body: { label } });
      setFresh(body.key);
      setKeys(body);
      setLabel('');
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const revoke = async (key: Key) => {
    if (!confirm(`撤銷「${key.label}」？使用這把金鑰的程式會回到一般額度。`)) return;
    await readerFetch<{ keys: Key[]; max: number }>(`/auth/me/api-keys/${key.id}`, { method: 'DELETE' })
      .then(setKeys)
      .catch((e: Error) => setError(e.message));
  };
  return (
    <section>
      <h2 className="text-lg font-semibold">API 金鑰</h2>
      <p className={note}>
        <Link href="/api/" className="mr-1 text-brand-700 underline dark:text-brand-400">
          公開 API
        </Link>
        不需要金鑰，每個 IP 每分鐘 60 次。請求帶上 <code className="text-xs">x-api-key</code> 標頭，就改用這把金鑰自己的額度：每分鐘 1000
        次。最多 {keys?.max ?? 3} 把。
      </p>
      {fresh && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium">新的金鑰只顯示這一次，請現在複製保存：</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 text-xs dark:bg-zinc-900">{fresh}</code>
            <Copy text={fresh} />
          </div>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-600 dark:text-zinc-400">{`curl -H 'x-api-key: ${fresh}' https://tag.observe.tw/api/v1/ranking`}</pre>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
      {keys && keys.keys.length > 0 && (
        <ul className={`${card} mt-3 divide-y divide-zinc-200 dark:divide-zinc-800`}>
          {keys.keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="font-medium">{k.label}</span>
              <code className="text-xs text-zinc-500">{k.prefix}…</code>
              <span className="text-xs text-zinc-500 tabular-nums">
                建立 {when(k.createdAt)} · {k.lastUsedAt ? `最近使用 ${when(k.lastUsedAt)}` : '尚未使用'}
              </span>
              <button type="button" className={`${button} ml-auto`} onClick={() => revoke(k)}>
                撤銷
              </button>
            </li>
          ))}
        </ul>
      )}
      {keys && keys.keys.length < keys.max && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (label.trim()) create();
          }}
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={64}
            placeholder="用途，例如：研究計畫"
            aria-label="金鑰名稱"
            className={`${field} w-full max-w-xs`}
          />
          <button type="submit" className={button} disabled={!label.trim()}>
            建立金鑰
          </button>
        </form>
      )}
    </section>
  );
}

type Report = {
  id: number;
  kind: string;
  tags: string[] | null;
  message: string;
  status: 'open' | 'accepted' | 'rejected';
  createdAt: string;
  resolution: string | null;
  article: { id: number; title: string; mediaTitle: string } | null;
};
export const REPORT_KIND: Record<string, string> = { tags: '標籤', byline: '署名', media: '媒體歸屬', other: '其他' };
export const REPORT_STATUS: Record<Report['status'], string> = { open: '待處理', accepted: '已採納', rejected: '未採納' };

function MyReports() {
  const [reports, setReports] = useState<Report[] | null>(null);
  useEffect(() => {
    readerFetch<{ reports: Report[] }>('/auth/me/reports')
      .then((body) => setReports(body.reports))
      .catch(() => setReports([]));
  }, []);
  return (
    <section>
      <h2 className="text-lg font-semibold">我的回報</h2>
      <p className={note}>在文章頁按「回報錯誤」送出的內容與處理結果。</p>
      {reports && !reports.length && <p className="mt-2 text-sm text-zinc-500">還沒有回報。</p>}
      {reports && reports.length > 0 && (
        <ul className={`${card} mt-3 divide-y divide-zinc-200 dark:divide-zinc-800`}>
          {reports.map((r) => (
            <li key={r.id} className="px-3 py-2">
              <p className="text-xs text-zinc-500">
                {when(r.createdAt)} · {REPORT_KIND[r.kind] ?? r.kind} · <span className="font-medium">{REPORT_STATUS[r.status]}</span>
              </p>
              {r.article && (
                <Link href={`/article/${r.article.id}/`} className="hover:underline">
                  【{r.article.mediaTitle}】{r.article.title}
                </Link>
              )}
              {r.tags && <p className="text-xs text-zinc-600 dark:text-zinc-400">建議標籤：{r.tags.join('、')}</p>}
              {r.message && <p className="text-xs text-zinc-600 dark:text-zinc-400">{r.message}</p>}
              {r.resolution && <p className="text-xs text-zinc-700 dark:text-zinc-300">管理員：{r.resolution}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
