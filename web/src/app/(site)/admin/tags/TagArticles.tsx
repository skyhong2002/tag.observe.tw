'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { taipei } from '@/lib/api';
import AdminGate, { adminFetch, note } from '../AdminGate';

type Article = {
  id: number;
  title: string;
  url: string;
  mediaName: string;
  publishedAt: string;
  relations: { kind: 'tagged' | 'retold'; label: string; evidence: string | null; version: string | null; platform: string | null }[];
};
type Result = { articles: Article[]; next: number | null };

export default function TagArticles({ initialTag }: { initialTag: string }) {
  return (
    <AdminGate next={`/admin/tags/?${new URLSearchParams({ view: 'relations', tag: initialTag })}`}>
      <Browser key={initialTag} tag={initialTag} />
    </AdminGate>
  );
}

function Browser({ tag }: { tag: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [before, setBefore] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!tag) return;
    let live = true;
    setData(null);
    setError('');
    adminFetch<Result>(`/auth/admin/tags/${encodeURIComponent(tag)}/articles${before ? `?before=${before}` : ''}`).then(
      (r) => {
        if (live) setData(r);
      },
      (e: Error) => {
        if (live) setError(e.message);
      },
    );
    return () => {
      live = false;
    };
  }, [tag, before]);
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">標籤與文章的關係</h2>
      <p className={note}>
        「文章標籤」表示文章附有這個標籤；「被轉述」表示開頭轉述此對象的貼文或節目內容，並列出判斷依據。單有標籤不代表此對象曾發言，也不代表是作者。
      </p>
      <form action="/admin/tags/" className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="view" value="relations" />
        <input
          name="tag"
          aria-label="查詢文章關係的標籤"
          defaultValue={tag}
          maxLength={60}
          required
          placeholder="例如 台積電、沈政男"
          className="min-h-9 rounded border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button className="min-h-9 rounded-full border border-zinc-300 px-3 dark:border-zinc-700" type="submit">
          查詢
        </button>
      </form>
      {tag && (
        <p className={note}>
          目前標籤：{tag} ·{' '}
          <Link className="text-brand-700 underline dark:text-brand-400" href={`/admin/tags/?tag=${encodeURIComponent(tag)}`}>
            編輯共用分類
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {tag && !data && !error && <p className={note}>載入中…</p>}
      {data && !data.articles.length && <p className={note}>沒有符合的文章關係。</p>}
      <ol className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
        {data?.articles.map((a) => (
          <li key={a.id} className="py-3 text-sm">
            <Link className="font-medium hover:underline" href={`/article/${a.id}/`}>
              {a.title}
            </Link>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {a.mediaName} · {taipei(a.publishedAt)} ·{' '}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="underline">
                原文
              </a>
            </p>
            <ul className="mt-2 space-y-2">
              {a.relations.map((r) => (
                <li key={r.kind}>
                  <span className="mr-2 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{r.label}</span>
                  {r.platform && <span className="mr-2 text-xs text-zinc-500 dark:text-zinc-400">{r.platform}</span>}
                  <span className="break-words text-zinc-600 dark:text-zinc-400">{r.evidence ?? '未保留判斷句'}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {data?.next && (
        <button type="button" onClick={() => setBefore(data.next)} className="mt-3 min-h-9 rounded-full border px-3 text-sm">
          更早的文章
        </button>
      )}
      {before && (
        <button type="button" onClick={() => setBefore(null)} className="ml-3 mt-3 min-h-9 text-sm underline">
          回到最新
        </button>
      )}
    </section>
  );
}
