'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import AdminGate, { adminFetch } from '../AdminGate';

type Status = 'pending' | 'approved' | 'rejected';
type Submission = {
  id: number | string;
  kind: 'relation' | 'picture';
  tag: string;
  type?: 'is-a' | 'related' | 'alias';
  target?: string;
  reason?: string | null;
  createdAt: string;
  createdBy: string | null;
  status: Status;
  imageUrl?: string | null;
  rightsConfirmed?: boolean;
  reviewReason?: string | null;
};
type Result = { items: Submission[]; next: number | string | null };
const STATUS: Record<Status, string> = { pending: '待審核', approved: '已通過', rejected: '未採納' };
const TYPES = { 'is-a': '上位分類', related: '相關詞', alias: '同義或別名' };
const button =
  'inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-3 text-sm hover:border-brand-600 disabled:opacity-50 dark:border-zinc-700';

export default function TagSubmissions() {
  return (
    <AdminGate next="/admin/tags/?view=submissions">
      <Queue />
    </AdminGate>
  );
}

function Queue() {
  const [status, setStatus] = useState<Status>('pending');
  const [before, setBefore] = useState<Result['next']>(null);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    // A completed review or explicit retry refreshes the current page.
    void revision;
    let current = true;
    setData(null);
    setError('');
    const query = new URLSearchParams({ status, ...(before === null ? {} : { before: String(before) }) });
    adminFetch<Result>(`/auth/admin/tag-submissions?${query}`).then(
      (result) => {
        if (current) setData(result);
      },
      (err: Error) => {
        if (current) setError(err.message);
      },
    );
    return () => {
      current = false;
    };
  }, [status, before, revision]);
  return (
    <section className="mt-6" aria-labelledby="tag-submissions-title">
      <h2 id="tag-submissions-title" className="text-lg font-semibold">
        標籤投稿審核
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        關鍵字關係與讀者圖片須通過審核才公開。請核對語義、來源與圖片授權，並留下處理理由。
      </p>
      <fieldset className="mt-3 flex flex-wrap gap-2">
        <legend className="sr-only">投稿狀態</legend>
        {(Object.keys(STATUS) as Status[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={value === status}
            onClick={() => {
              setStatus(value);
              setBefore(null);
            }}
            className={`${button} ${value === status ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200' : ''}`}
          >
            {STATUS[value]}
          </button>
        ))}
      </fieldset>
      {error ? (
        <div className="mt-4">
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
          <button type="button" className={`${button} mt-2`} onClick={() => setRevision((v) => v + 1)}>
            重新載入
          </button>
        </div>
      ) : !data ? (
        <p role="status" className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          載入中…
        </p>
      ) : data.items.length ? (
        <ul className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-300 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {data.items.map((item) => (
            <Row key={item.id} item={item} onDone={() => setRevision((v) => v + 1)} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">沒有{STATUS[status]}的投稿。</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {data?.next != null && (
          <button type="button" className={button} onClick={() => setBefore(data.next)}>
            更早的投稿
          </button>
        )}
        {before !== null && (
          <button type="button" className={button} onClick={() => setBefore(null)}>
            回到最新
          </button>
        )}
      </div>
    </section>
  );
}

function Row({ item, onDone }: { item: Submission; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const review = async (status: 'approved' | 'rejected') => {
    if (pending.current || !reason.trim() || (status === 'approved' && item.kind === 'picture' && !item.rightsConfirmed)) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await adminFetch(`/auth/admin/tag-submissions/${encodeURIComponent(String(item.id))}`, {
        method: 'PUT',
        body: { status, reason: reason.trim() },
      });
      if (live.current) onDone();
    } catch (err) {
      if (live.current) setError((err as Error).message);
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  return (
    <li aria-busy={busy} className="space-y-3 break-words p-4 text-sm">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        #{item.id} · {item.kind === 'picture' ? '圖片投稿' : '關係投稿'} · {item.createdBy ?? '帳號已移除'} ·{' '}
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</time>
      </p>
      <p className="font-medium">
        <Link className="text-brand-700 underline dark:text-brand-400" href={`/tag/${encodeURIComponent(item.tag)}/`}>
          #{item.tag}
        </Link>
        {item.type && ` → ${TYPES[item.type]}：${item.target}`}
      </p>
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt={`${item.tag}的待審圖片`}
          width={160}
          height={160}
          loading="lazy"
          className="max-h-40 max-w-full rounded object-contain"
        />
      )}
      {item.kind === 'picture' && (
        <p className="text-zinc-600 dark:text-zinc-400">
          {item.rightsConfirmed ? '上傳者已確認具有使用與改作權利。' : '缺少上傳者的授權確認，請勿核准。'}
        </p>
      )}
      {item.reason && <p className="whitespace-pre-wrap">{item.reason}</p>}
      {item.status === 'pending' ? (
        <div className="space-y-2">
          <label className="block">
            審核理由
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={2}
              disabled={busy}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              placeholder="記錄查證依據或未採納原因"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              disabled={busy || !reason.trim() || (item.kind === 'picture' && !item.rightsConfirmed)}
              onClick={() => review('approved')}
            >
              {busy ? '處理中…' : '通過並公開'}
            </button>
            <button type="button" className={button} disabled={busy || !reason.trim()} onClick={() => review('rejected')}>
              不採納
            </button>
          </div>
        </div>
      ) : (
        <p className="text-zinc-600 dark:text-zinc-400">
          {STATUS[item.status]}
          {item.reviewReason && `：${item.reviewReason}`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}
