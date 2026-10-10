'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SourceLink from '@/components/SourceLink';
import { adminFetch, note } from './AdminGate';

// Readers' corrections (POST /auth/me/reports), newest open ones first.
// 套用 writes the suggested tags through the same endpoint as /admin/media/,
// so the change is logged and protected from later crawls.

type Status = 'open' | 'accepted' | 'rejected';
type Report = {
  id: number;
  kind: 'tags' | 'byline' | 'media' | 'other';
  tags: string[] | null;
  currentTags: string[];
  message: string;
  status: Status;
  createdAt: string;
  resolution: string | null;
  reporter: { email: string | null; name: string | null };
  article: { id: number; title: string; media: string; mediaTitle: string; url: string | null } | null;
};
const KIND: Record<Report['kind'], string> = { tags: '標籤', byline: '署名', media: '媒體歸屬', other: '其他' };
const STATUS: Record<Status, string> = { open: '待處理', accepted: '已採納', rejected: '未採納' };
const when = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short' });
const button = 'min-h-8 rounded-full border border-zinc-300 px-3 text-xs hover:border-brand-600 disabled:opacity-50 dark:border-zinc-700';

export default function Reports() {
  const [status, setStatus] = useState<Status>('open');
  const [data, setData] = useState<{ open: number; reports: Report[] } | null>(null);
  const [error, setError] = useState('');
  const load = (s: Status) =>
    adminFetch<{ open: number; reports: Report[] }>(`/auth/admin/reports?status=${s}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    load(status);
  }, [status]);
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">讀者回報{data ? `（待處理 ${data.open}）` : ''}</h2>
      <div className="mt-2 flex gap-1 text-sm">
        {(Object.keys(STATUS) as Status[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === status}
            onClick={() => setStatus(s)}
            className={`rounded-md px-3 py-1 ${s === status ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800'}`}
          >
            {STATUS[s]}
          </button>
        ))}
      </div>
      {error ? (
        <p className={note}>{error}</p>
      ) : !data ? (
        <p className={note}>載入中…</p>
      ) : !data.reports.length ? (
        <p className={note}>沒有{STATUS[status]}的回報。</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {data.reports.map((r) => (
            <ReportRow key={r.id} report={r} onDone={() => load(status)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportRow({ report: r, onDone }: { report: Report; onDone: () => void }) {
  const [reply, setReply] = useState(r.resolution ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resolve = async (status: Status, applyTags = false) => {
    setBusy(true);
    setError('');
    try {
      if (applyTags && r.article && r.tags)
        await adminFetch(`/auth/admin/articles/${r.article.id}/tags`, { method: 'PUT', body: { tags: r.tags } });
      await adminFetch(`/auth/admin/reports/${r.id}`, { method: 'PUT', body: { status, resolution: reply } });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const current = new Set(r.currentTags);
  const suggested = new Set(r.tags ?? []);
  return (
    <li className="space-y-1.5 px-3 py-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        #{r.id} · {KIND[r.kind]} · {r.reporter.name ?? r.reporter.email ?? '已刪除帳號'} · {when(r.createdAt)}
      </p>
      {r.article ? (
        <div>
          <Link href={`/article/${r.article.id}/`} className="block font-medium hover:underline">
            【{r.article.mediaTitle}】{r.article.title}
          </Link>
          <SourceLink url={r.article.url} showUrl className="!min-h-5 !text-[11px]" />
        </div>
      ) : (
        <p className="text-zinc-500">文章已不在本站。</p>
      )}
      {r.tags && (
        <p className="flex flex-wrap gap-1 text-xs">
          {[...new Set([...r.currentTags, ...r.tags])].map((t) => (
            <span
              key={t}
              className={`rounded px-1.5 py-px ${!current.has(t) ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : !suggested.has(t) ? 'bg-red-100 text-red-900 line-through dark:bg-red-950 dark:text-red-200' : 'bg-zinc-100 dark:bg-zinc-800'}`}
              title={!current.has(t) ? '建議新增' : !suggested.has(t) ? '建議移除' : '不變'}
            >
              {t}
            </span>
          ))}
        </p>
      )}
      {r.message && <p className="whitespace-pre-wrap">{r.message}</p>}
      {r.status === 'open' ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={255}
            placeholder="給讀者的說明（選填）"
            className="min-w-48 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
          />
          {r.tags && r.article && (
            <button type="button" className={button} disabled={busy} onClick={() => resolve('accepted', true)}>
              套用建議標籤並採納
            </button>
          )}
          <button type="button" className={button} disabled={busy} onClick={() => resolve('accepted')}>
            採納
          </button>
          <button type="button" className={button} disabled={busy} onClick={() => resolve('rejected')}>
            不採納
          </button>
          {r.article?.url && (
            <Link href={`/admin/media/?url=${encodeURIComponent(r.article.url)}`} className={`${button} inline-flex items-center`}>
              在媒體設定頁處理
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {STATUS[r.status]}
          {r.resolution && `：${r.resolution}`}
          <button type="button" className={button} disabled={busy} onClick={() => resolve('open')}>
            改回待處理
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
    </li>
  );
}
