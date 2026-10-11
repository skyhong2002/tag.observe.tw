'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VisualPicture } from '@/components/TagVisual';
import type { TagVisual } from '@/lib/api';
import AdminGate, { adminFetch, note } from '../AdminGate';

// Pictures for non-person tags (docs/tag-visuals.md), reviewed like the
// person avatars (/admin/avatars/): each tag shows its candidates — the
// Wikidata place or logo and the AI's exact emoji — and
// clicking one puts it in use. Places and logos the AI agreed with show by
// themselves; everything else waits here. Filter by status and by kind of
// picture to review one kind at a time. Chosen and hidden tags survive re-runs.

type Status = 'review' | 'auto' | 'voted' | 'chosen' | 'hidden' | 'none';
type Kind = TagVisual['kind'];
type Candidate = {
  rank: number;
  kind: Kind;
  value: string | null;
  label: string | null;
  note: string | null;
  pageUrl: string | null;
  license: string | null;
  image: string | null;
  large: string | null;
};
type Row = {
  tag: string;
  kind: Kind | null;
  status: Status | null;
  value?: string | null;
  wikidataId?: string | null;
  label?: string | null;
  note?: string | null;
  shownRank?: number | null;
  reviewedBy?: string | null;
  image: string | null;
  large: string | null;
  candidates: Candidate[];
};
type Page = {
  status: Status;
  kind: Kind | 'none' | null;
  counts: Record<string, number>;
  kinds: Record<string, number>;
  offset: number;
  next: number | null;
  visuals: Row[];
};

const TABS: [Status, string][] = [
  ['review', '待確認'],
  ['auto', '自動'],
  ['voted', '投票決定'],
  ['chosen', '已選定'],
  ['hidden', '已隱藏'],
  ['none', '沒有合適的'],
];
const KINDS: [Kind | 'none' | null, string][] = [
  [null, '全部'],
  ['place', '地方'],
  ['flag', '國旗'],
  ['logo', '標誌'],
  ['emoji', 'emoji'],
  ['none', '沒有圖'],
];
const KIND_LABEL: Record<Kind, string> = { place: '地方', flag: '國旗', logo: '標誌', emoji: 'emoji' };
const pill = (on: boolean) =>
  `min-h-9 rounded-full px-3 ${on ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-zinc-300 dark:border-zinc-700'}`;
const button = 'min-h-9 rounded-full border border-zinc-300 px-3 text-sm hover:border-brand-600 dark:border-zinc-700';
const input = 'min-h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900';

export default function TagVisualReview() {
  return (
    <AdminGate next="/admin/tag-visuals/">
      <p className={note}>點一張候選就改用並鎖定；讀者的投票與上傳在各標籤的「換圖」頁。做法見頁尾「本頁的資料來源與計算方式」。</p>
      <Review />
    </AdminGate>
  );
}

function Review() {
  const [status, setStatus] = useState<Status>('review');
  const [kind, setKind] = useState<Kind | 'none' | null>(null);
  const [offset, setOffset] = useState(0);
  const [lookup, setLookup] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState('');
  // /admin/tag-visuals/?tag=… (the tag page's 「換圖」 link) opens that one tag.
  useEffect(() => {
    const tag = new URLSearchParams(window.location.search).get('tag')?.trim();
    if (tag) {
      setLookup(tag);
      setQuery(tag);
    }
  }, []);
  // Keep the address in step, so a looked-up tag can be bookmarked or shared.
  useEffect(() => {
    const url = query ? `?tag=${encodeURIComponent(query)}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [query]);
  // Only the latest request may fill the page: on ?tag=… the default list's
  // request can come back after the one tag's and would cover it.
  const latest = useRef(0);
  const load = useCallback(() => {
    const q = query ? `tag=${encodeURIComponent(query)}` : `status=${status}${kind ? `&kind=${kind}` : ''}&offset=${offset}`;
    const id = ++latest.current;
    adminFetch<Page>(`/auth/admin/tag-visuals?${q}`)
      .then((p) => {
        if (id !== latest.current) return;
        setPage(p);
        setError('');
      })
      .catch((e: Error) => setError(e.message));
  }, [status, kind, offset, query]);
  useEffect(load, [load]);
  const act = async (call: () => Promise<unknown>) => {
    try {
      await call();
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const total = page ? Object.values(page.kinds).reduce((a, b) => a + b, 0) : 0;
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-1 text-sm">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setStatus(key);
              setKind(null);
              setOffset(0);
              setQuery('');
            }}
            className={pill(key === status && !query)}
          >
            {label}
            <span className="ml-1 tabular-nums opacity-70">{page?.counts[key] ?? 0}</span>
          </button>
        ))}
        <form
          className="ml-auto flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(lookup.trim());
          }}
        >
          <input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="查一個標籤" className={input} aria-label="標籤" />
          <button type="submit" className={button}>
            查詢
          </button>
        </form>
      </div>
      {!query && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
          <span className="mr-1 text-zinc-500">種類</span>
          {KINDS.map(([key, label]) => {
            const n = key === null ? total : (page?.kinds[key] ?? 0);
            if (key !== null && !n) return null;
            return (
              <button
                key={key ?? 'all'}
                type="button"
                onClick={() => {
                  setKind(key);
                  setOffset(0);
                }}
                className={pill(key === kind)}
              >
                {label}
                <span className="ml-1 tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!page ? (
        <p className={note}>載入中…</p>
      ) : !page.visuals.length ? (
        <p className={note}>沒有標籤。</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
          {page.visuals.map((v) => (
            <VisualRow key={v.tag} row={v} act={act} single={!!query} />
          ))}
        </ul>
      )}
      {page && !query && (page.offset > 0 || page.next !== null) && (
        <div className="mt-4 flex gap-2 text-sm">
          <button
            type="button"
            disabled={page.offset === 0}
            onClick={() => setOffset(Math.max(0, page.offset - 60))}
            className={`${button} disabled:opacity-40`}
          >
            上一頁
          </button>
          <button
            type="button"
            disabled={page.next === null}
            onClick={() => page.next !== null && setOffset(page.next)}
            className={`${button} disabled:opacity-40`}
          >
            下一頁
          </button>
        </div>
      )}
    </>
  );
}

const asVisual = (c: {
  kind: Kind;
  value?: string | null;
  label?: string | null;
  image: string | null;
  large: string | null;
}): TagVisual => ({
  kind: c.kind,
  emoji: c.kind === 'emoji' ? (c.value ?? null) : null,
  label: c.label ?? null,
  wikidataId: null,
  image: c.image,
  large: c.large,
  source: null,
});

function VisualRow({ row: r, act, single }: { row: Row; act: (call: () => Promise<unknown>) => void; single: boolean }) {
  const path = `/auth/admin/tag-visuals/${encodeURIComponent(r.tag)}`;
  const put = (body: object) => act(() => adminFetch(path, { method: 'PUT', body }));
  // In use and public: chosen or automatic. A review row's first candidate waits.
  const live = r.status === 'auto' || r.status === 'chosen' || r.status === 'voted';
  const own = live && r.kind && !r.shownRank;
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a href={`/tag/${encodeURIComponent(r.tag)}/`} className="font-medium underline">
          {r.tag}
        </a>
        <a href={`/tag/${encodeURIComponent(r.tag)}/picture/`} className="text-xs text-zinc-500 underline">
          票數
        </a>
        {r.wikidataId && (
          <a
            href={`https://www.wikidata.org/wiki/${r.wikidataId}`}
            className="text-xs text-zinc-500 underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            {r.wikidataId}
          </a>
        )}
        {r.label && <span className="text-sm text-zinc-600 dark:text-zinc-400">{r.label}</span>}
        {r.reviewedBy && <span className="text-xs text-zinc-500">{r.reviewedBy}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        {r.candidates.map((c) => {
          const inUse = live && r.shownRank === c.rank;
          return (
            <button
              key={c.rank}
              type="button"
              onClick={() => put({ rank: c.rank })}
              aria-pressed={inUse}
              title={c.note ?? undefined}
              className={`w-32 rounded-lg border-2 p-1 text-left text-xs ${inUse ? 'border-brand-600' : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'}`}
            >
              <span className="flex h-[120px] items-center justify-center overflow-hidden [&_img]:!max-w-full">
                <VisualPicture visual={asVisual(c)} size={96} />
              </span>
              <span className="mt-1 block">
                #{c.rank} · {KIND_LABEL[c.kind]}
                {inUse && ' · 使用中'}
              </span>
              {c.note && <span className="block truncate text-zinc-500">{c.note}</span>}
              {c.pageUrl && (
                <a
                  href={c.pageUrl}
                  className="block truncate text-zinc-500 underline"
                  rel="noopener noreferrer"
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.license ?? '原檔'}
                </a>
              )}
            </button>
          );
        })}
        {own && (
          <div className="w-32 rounded-lg border-2 border-brand-600 p-1 text-xs">
            <span className="flex h-[120px] items-center justify-center overflow-hidden [&_img]:!max-w-full">
              <VisualPicture visual={asVisual({ ...r, kind: r.kind as Kind })} size={96} />
            </span>
            <span className="mt-1 block">管理員指定 · 使用中</span>
          </div>
        )}
        {!r.candidates.length && !own && <span className="self-center text-sm text-zinc-500">沒有候選{r.note ? `：${r.note}` : ''}</span>}
        {live && (
          <button type="button" onClick={() => put({ action: 'hide' })} className={`${button} self-center hover:border-red-600`}>
            不顯示圖
          </button>
        )}
      </div>
      <OwnPicture path={path} act={act} put={put} open={single} />
    </li>
  );
}

/** The admin's own emoji or logo, for when no candidate fits. */
function OwnPicture({
  path,
  act,
  put,
  open,
}: {
  path: string;
  act: (call: () => Promise<unknown>) => void;
  put: (body: object) => void;
  /** Opened already when the page shows one looked-up tag. */
  open: boolean;
}) {
  const [emoji, setEmoji] = useState('');
  const upload = (file: File) =>
    act(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      await adminFetch(`${path}/logo`, { method: 'POST', body: { image: btoa(binary) } });
    });
  return (
    <details className="mt-2 text-sm" open={open}>
      <summary className="cursor-pointer text-zinc-500">都不合適：自己指定</summary>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (emoji.trim()) put({ emoji: emoji.trim() });
          }}
        >
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="emoji"
            className={`${input} w-20`}
            aria-label="emoji"
          />
          <button type="submit" className={button}>
            改用
          </button>
        </form>
        <label className={`${button} inline-flex cursor-pointer items-center`}>
          上傳標誌
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </details>
  );
}
