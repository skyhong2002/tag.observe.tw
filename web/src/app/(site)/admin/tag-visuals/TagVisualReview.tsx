'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { VisualPicture } from '@/components/TagVisual';
import type { TagVisual } from '@/lib/api';
import AdminGate, { adminFetch, note } from '../AdminGate';

// Pictures for non-person tags (docs/tag-visuals.md): place outlines and
// Commons logos are shown automatically; the AI's emoji and icon picks wait
// here until an admin confirms them. An admin can also set another emoji or
// icon, upload a logo, or hide the picture; re-runs leave those alone.

type Status = 'review' | 'auto' | 'chosen' | 'hidden' | 'none';
type Row = {
  tag: string;
  kind: TagVisual['kind'] | null;
  status: Status | null;
  value?: string | null;
  wikidataId?: string | null;
  label?: string | null;
  note?: string | null;
  pageUrl?: string | null;
  license?: string | null;
  reviewedBy?: string | null;
  image: string | null;
  large: string | null;
};
type Page = { status: Status; counts: Record<string, number>; offset: number; next: number | null; visuals: Row[] };

const TABS: [Status, string][] = [
  ['review', '待確認'],
  ['auto', '自動'],
  ['chosen', '已選定'],
  ['hidden', '已隱藏'],
  ['none', '沒有合適的'],
];
const KIND: Record<TagVisual['kind'], string> = { place: '地方', logo: '標誌', emoji: 'emoji', icon: '圖示' };
const button = 'min-h-9 rounded-full border border-zinc-300 px-3 text-sm hover:border-brand-600 dark:border-zinc-700';
const input = 'min-h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900';

export default function TagVisualReview() {
  return (
    <AdminGate next="/admin/tag-visuals/">
      <p className={note}>
        非人物標籤的小圖：縣市、鄉鎮、國家和城市畫輪廓或定位點，組織和作品用 Wikidata 的標誌（轉成網站橘的單色），這兩種自動顯示。 其餘由 AI
        挑：只有完全就是那個東西時才給 emoji，否則挑一個 Lucide 線條圖示，放在「待確認」，按「採用」後才顯示。
        改過或隱藏的標籤，之後重跑不會覆蓋。
      </p>
      <Review />
    </AdminGate>
  );
}

function Review() {
  const [status, setStatus] = useState<Status>('review');
  const [offset, setOffset] = useState(0);
  const [lookup, setLookup] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    const q = query ? `tag=${encodeURIComponent(query)}` : `status=${status}&offset=${offset}`;
    adminFetch<Page>(`/auth/admin/tag-visuals?${q}`)
      .then((p) => {
        setPage(p);
        setError('');
      })
      .catch((e: Error) => setError(e.message));
  }, [status, offset, query]);
  useEffect(load, [load]);
  const act = async (call: () => Promise<unknown>) => {
    try {
      await call();
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-1 text-sm">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setStatus(key);
              setOffset(0);
              setQuery('');
            }}
            className={`min-h-9 rounded-full px-3 ${key === status && !query ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-zinc-300 dark:border-zinc-700'}`}
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
      {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!page ? (
        <p className={note}>載入中…</p>
      ) : !page.visuals.length ? (
        <p className={note}>沒有標籤。</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
          {page.visuals.map((v) => (
            <VisualRow key={v.tag} row={v} act={act} />
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

const asVisual = (r: Row): TagVisual | null =>
  r.kind
    ? {
        kind: r.kind,
        emoji: r.kind === 'emoji' ? (r.value ?? null) : null,
        icon: r.kind === 'icon' ? (r.value ?? null) : null,
        label: r.label ?? null,
        wikidataId: r.wikidataId ?? null,
        image: r.image,
        large: r.large,
        source: null,
      }
    : null;

function VisualRow({ row: r, act }: { row: Row; act: (call: () => Promise<unknown>) => void }) {
  const [emoji, setEmoji] = useState('');
  const [iconQuery, setIconQuery] = useState('');
  const [icons, setIcons] = useState<string[] | null>(null);
  const path = `/auth/admin/tag-visuals/${encodeURIComponent(r.tag)}`;
  const put = (body: object) => act(() => adminFetch(path, { method: 'PUT', body }));
  const visual = asVisual(r);
  const upload = (file: File) =>
    act(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      await adminFetch(`${path}/logo`, { method: 'POST', body: { image: btoa(binary) } });
    });
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a href={`/tag/${encodeURIComponent(r.tag)}/`} className="font-medium underline">
          {r.tag}
        </a>
        {r.kind && <span className="text-xs text-zinc-500">{KIND[r.kind]}</span>}
        {r.label && <span className="text-sm text-zinc-600 dark:text-zinc-400">{r.label}</span>}
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
        {r.note && (
          <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">{r.note}</span>
        )}
        {r.pageUrl && (
          <a href={r.pageUrl} className="text-xs text-zinc-500 underline" rel="noopener noreferrer" target="_blank">
            {r.license ?? '原檔'}
          </a>
        )}
        {r.reviewedBy && <span className="text-xs text-zinc-500">{r.reviewedBy}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {visual ? <VisualPicture visual={visual} size={64} /> : <span className="text-sm text-zinc-500">（沒有圖）</span>}
        {visual?.kind === 'place' && r.image && <VisualPicture visual={{ ...visual, large: null }} size={40} />}
        {visual && r.status !== 'chosen' && r.status !== 'auto' && (
          <button type="button" className={button} onClick={() => put({ action: 'confirm' })}>
            採用
          </button>
        )}
        {visual && r.status !== 'hidden' && (
          <button type="button" className={`${button} hover:border-red-600`} onClick={() => put({ action: 'hide' })}>
            不顯示
          </button>
        )}
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
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () =>
              setIcons((await adminFetch<{ icons: string[] }>(`/auth/admin/tag-visuals/icons?q=${encodeURIComponent(iconQuery)}`)).icons),
            );
          }}
        >
          <input
            value={iconQuery}
            onChange={(e) => setIconQuery(e.target.value)}
            placeholder="找圖示（英文，如 fire）"
            className={`${input} w-44`}
            aria-label="找圖示"
          />
          <button type="submit" className={button}>
            找
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
      {icons && (
        <div className="mt-2 flex flex-wrap gap-1">
          {!icons.length && <span className="text-sm text-zinc-500">找不到圖示。</span>}
          {icons.map((name) => (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => {
                setIcons(null);
                put({ icon: name });
              }}
              className="rounded-md border border-transparent p-1 hover:border-brand-600"
            >
              <span
                aria-hidden="true"
                className="block h-7 w-7 bg-brand-600 [mask-image:var(--icon)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
                style={{ '--icon': `url("/auth/admin/tag-visuals/icons/${name}")` } as React.CSSProperties}
              />
              <span className="sr-only">{name}</span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
