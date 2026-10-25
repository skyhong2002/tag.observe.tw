'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TagAvatar } from '@/components/TagPerson';
import AdminGate, { adminFetch, note } from '../AdminGate';

// Person tags matched to Wikidata, each with up to three sketch candidates
// scored from Commons photos (docs/tag-avatars.md). The best is shown
// automatically; an admin can switch to another or hide the avatar.

type Status = 'review' | 'auto' | 'voted' | 'chosen' | 'hidden' | 'nophoto';
type Candidate = {
  rank: number;
  file: string;
  pageUrl: string;
  license: string | null;
  artist: string | null;
  score: number;
  scores: Record<string, number>;
  verdict: string;
  image: string;
};
type Person = {
  tag: string;
  wikidataId: string | null;
  label: string | null;
  description: string | null;
  status: Status;
  note: string | null;
  shownRank: number | null;
  checkedAt: string;
  reviewedBy: string | null;
  candidates: Candidate[];
};
type Page = { status: Status; counts: Record<string, number>; offset: number; next: number | null; people: Person[] };

const TABS: [Status, string][] = [
  ['review', '待確認'],
  ['auto', '自動'],
  ['voted', '投票決定'],
  ['chosen', '已選定'],
  ['hidden', '已隱藏'],
  ['nophoto', '沒有可用照片'],
];
const SCORE_LABEL: Record<string, string> = { size: '臉大小', front: '正面', sharp: '清晰', light: '光線', same: '像本人', det: '偵測' };

export default function AvatarReview() {
  return (
    <AdminGate next="/admin/tags/?view=pictures">
      <p className={note}>點一張候選就改用並鎖定；沒有可用照片的人可以上傳照片。做法見頁尾「本頁的資料來源與計算方式」。</p>
      <Review />
    </AdminGate>
  );
}

function Review() {
  const [status, setStatus] = useState<Status>('review');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState('');
  // /admin/avatars/?tag=… (the tag page's 「換圖」 link) shows that one person.
  const [only, setOnly] = useState('');
  useEffect(() => {
    setOnly(new URLSearchParams(window.location.search).get('tag')?.trim() ?? '');
  }, []);
  // Only the latest request may fill the page.
  const latest = useRef(0);
  const load = useCallback(() => {
    const id = ++latest.current;
    const q = only ? `tag=${encodeURIComponent(only)}` : `status=${status}&offset=${offset}`;
    adminFetch<Page>(`/auth/admin/avatars?${q}`)
      .then((p) => {
        if (id !== latest.current) return;
        setPage(p);
        setError('');
      })
      .catch((e: Error) => setError(e.message));
  }, [status, offset, only]);
  useEffect(load, [load]);
  const choose = async (tag: string, rank: number | null) => {
    try {
      await adminFetch(`/auth/admin/avatars/${encodeURIComponent(tag)}`, { method: 'PUT', body: { rank } });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="mt-4 flex flex-wrap gap-1 text-sm">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setStatus(key);
              setOffset(0);
              setOnly('');
              window.history.replaceState(null, '', window.location.pathname);
            }}
            className={`min-h-9 rounded-full px-3 ${key === status && !only ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-zinc-300 dark:border-zinc-700'}`}
          >
            {label}
            <span className="ml-1 tabular-nums opacity-70">{page?.counts[key] ?? 0}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!page ? (
        <p className={note}>載入中…</p>
      ) : !page.people.length ? (
        <p className={note}>沒有標籤。</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
          {page.people.map((p) => (
            <PersonRow key={p.tag} person={p} onChoose={choose} onUploaded={load} />
          ))}
        </ul>
      )}
      {page && (page.offset > 0 || page.next !== null) && (
        <div className="mt-4 flex gap-2 text-sm">
          <button
            type="button"
            disabled={page.offset === 0}
            onClick={() => setOffset(Math.max(0, page.offset - 60))}
            className="min-h-9 rounded-full border border-zinc-300 px-3 disabled:opacity-40 dark:border-zinc-700"
          >
            上一頁
          </button>
          <button
            type="button"
            disabled={page.next === null}
            onClick={() => page.next !== null && setOffset(page.next)}
            className="min-h-9 rounded-full border border-zinc-300 px-3 disabled:opacity-40 dark:border-zinc-700"
          >
            下一頁
          </button>
        </div>
      )}
    </>
  );
}

function PersonRow({
  person: p,
  onChoose,
  onUploaded,
}: {
  person: Person;
  onChoose: (tag: string, rank: number | null) => void;
  onUploaded: () => void;
}) {
  const shown = p.status === 'hidden' || p.status === 'nophoto' ? null : p.shownRank;
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a href={`/tag/${encodeURIComponent(p.tag)}/`} className="font-medium underline">
          {p.tag}
        </a>
        <a href={`/tag/${encodeURIComponent(p.tag)}/picture/`} className="text-xs text-zinc-500 dark:text-zinc-400 underline">
          票數
        </a>
        {p.wikidataId && (
          <a
            href={`https://www.wikidata.org/wiki/${p.wikidataId}`}
            className="text-xs text-zinc-500 dark:text-zinc-400 underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            {p.wikidataId}
          </a>
        )}
        {p.description && <span className="text-sm text-zinc-600 dark:text-zinc-400">{p.description}</span>}
        {p.note && (
          <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">{p.note}</span>
        )}
        {p.reviewedBy && <span className="text-xs text-zinc-500 dark:text-zinc-400">{p.reviewedBy}</span>}
      </div>
      {p.candidates.length > 0 && (
        <div className="mt-2 flex flex-wrap items-start gap-3">
          {p.candidates.map((c) => (
            <button
              key={c.rank}
              type="button"
              onClick={() => onChoose(p.tag, c.rank)}
              aria-pressed={shown === c.rank}
              title={`${c.file}\n${Object.entries(c.scores)
                .map(([k, v]) => `${SCORE_LABEL[k] ?? k} ${v.toFixed(2)}`)
                .join('、')}`}
              className={`w-32 rounded-lg border-2 p-1 text-left text-xs ${shown === c.rank ? 'border-brand-600' : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'}`}
            >
              <TagAvatar url={c.image} size={120} />
              <span className="mt-1 block tabular-nums">
                #{c.rank} · {c.score.toFixed(2)}
                {c.verdict === 'bystander' && ' · 旁有他人'}
                {shown === c.rank && ' · 使用中'}
              </span>
              {c.pageUrl ? (
                <a
                  href={c.pageUrl}
                  className="block truncate text-zinc-500 dark:text-zinc-400 underline"
                  rel="noopener noreferrer"
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.license ?? '原圖'}
                  {c.artist ? ` · ${c.artist}` : ''}
                </a>
              ) : (
                <span className="block truncate text-zinc-500 dark:text-zinc-400">{c.file}</span>
              )}
            </button>
          ))}
          {shown !== null && (
            <button
              type="button"
              onClick={() => onChoose(p.tag, null)}
              className="min-h-9 self-center rounded-full border border-zinc-300 px-3 text-sm hover:border-red-600 dark:border-zinc-700"
            >
              不顯示頭像
            </button>
          )}
        </div>
      )}
      <PhotoUpload tag={p.tag} onDone={onUploaded} />
    </li>
  );
}

type PhotoJob = { state: string; error: string | null };

/**
 * An admin's own photo, for people Commons has no usable photo of: the
 * worker finds the face, cuts the person out and sketches it like a Commons
 * photo, then shows it. Takes a minute or two; this polls until it is done.
 */
function PhotoUpload({ tag, onDone }: { tag: string; onDone: () => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'working'>('idle');
  const [message, setMessage] = useState('');
  const upload = async (file: File) => {
    setState('sending');
    setMessage('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const { jobId } = await adminFetch<{ jobId: string }>(`/auth/admin/avatars/${encodeURIComponent(tag)}/photo`, {
        method: 'POST',
        body: { image: btoa(binary) },
      });
      setState('working');
      for (;;) {
        await new Promise((r) => setTimeout(r, 3000));
        const job = await adminFetch<PhotoJob>(`/auth/admin/avatars/jobs/${encodeURIComponent(jobId)}`);
        if (job.state === 'completed' || job.state === 'failed') {
          setState('idle');
          if (job.error) setMessage(`沒有用上：${job.error}`);
          else {
            setMessage('已轉成素描並改用。');
            onDone();
          }
          return;
        }
      }
    } catch (e) {
      setState('idle');
      setMessage((e as Error).message);
    }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
      <label
        className={`inline-flex min-h-9 items-center rounded-full border border-zinc-300 px-3 hover:border-brand-600 dark:border-zinc-700 ${state === 'idle' ? 'cursor-pointer' : 'pointer-events-none opacity-60'}`}
      >
        {state === 'idle' ? '上傳照片' : state === 'sending' ? '上傳中…' : '轉素描中…（約一兩分鐘）'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={state !== 'idle'}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = '';
          }}
        />
      </label>
      {message && <span className="text-zinc-600 dark:text-zinc-400">{message}</span>}
    </div>
  );
}
