'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminGate, { adminFetch, note } from '../AdminGate';

// Person tags matched to Wikidata, each with up to three sketch candidates
// scored from Commons photos (docs/tag-avatars.md). The best is shown
// automatically; an admin can switch to another or hide the avatar.

type Status = 'review' | 'auto' | 'chosen' | 'hidden' | 'nophoto';
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
  ['chosen', '已選定'],
  ['hidden', '已隱藏'],
  ['nophoto', '沒有可用照片'],
];
const SCORE_LABEL: Record<string, string> = { size: '臉大小', front: '正面', sharp: '清晰', light: '光線', same: '像本人', det: '偵測' };

export default function AvatarReview() {
  return (
    <AdminGate next="/admin/avatars/">
      <p className={note}>
        標籤名稱正好是 Wikidata 上某位人物時，從 Wikimedia Commons 找照片、去背、轉成素描，自動用分數最高的一張，另外保留兩張候選。
        「待確認」是分數偏低或有同名人物的標籤。點候選圖就會改用那一張；選定或隱藏後，之後重跑也不會覆蓋。
      </p>
      <Review />
    </AdminGate>
  );
}

function Review() {
  const [status, setStatus] = useState<Status>('review');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    adminFetch<Page>(`/auth/admin/avatars?status=${status}&offset=${offset}`)
      .then((p) => {
        setPage(p);
        setError('');
      })
      .catch((e: Error) => setError(e.message));
  }, [status, offset]);
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
            }}
            className={`min-h-9 rounded-full px-3 ${key === status ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-zinc-300 dark:border-zinc-700'}`}
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
            <PersonRow key={p.tag} person={p} onChoose={choose} />
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

function PersonRow({ person: p, onChoose }: { person: Person; onChoose: (tag: string, rank: number | null) => void }) {
  const shown = p.status === 'hidden' || p.status === 'nophoto' ? null : p.shownRank;
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a href={`/tag/${encodeURIComponent(p.tag)}/`} className="font-medium underline">
          {p.tag}
        </a>
        {p.wikidataId && (
          <a
            href={`https://www.wikidata.org/wiki/${p.wikidataId}`}
            className="text-xs text-zinc-500 underline"
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
        {p.reviewedBy && <span className="text-xs text-zinc-500">{p.reviewedBy}</span>}
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
              <img src={c.image} alt={`${p.tag} 候選 ${c.rank}`} width={120} height={120} className="rounded-md bg-white" />
              <span className="mt-1 block tabular-nums">
                #{c.rank} · {c.score.toFixed(2)}
                {c.verdict === 'bystander' && ' · 旁有他人'}
                {shown === c.rank && ' · 使用中'}
              </span>
              <a
                href={c.pageUrl}
                className="block truncate text-zinc-500 underline"
                rel="noopener noreferrer"
                target="_blank"
                onClick={(e) => e.stopPropagation()}
              >
                {c.license ?? '原圖'}
                {c.artist ? ` · ${c.artist}` : ''}
              </a>
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
    </li>
  );
}
