'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminGate, { adminFetch, note } from '../AdminGate';

type Subject = { name: string; articles: number; outlets: number };

export default function WritingPeople() {
  return (
    <AdminGate next="/admin/tags/?view=relations">
      <Subjects />
    </AdminGate>
  );
}

function Subjects() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    adminFetch<{ posters: Subject[] }>('/auth/admin/writing/people').then(
      (r) => {
        if (live) setSubjects(r.posters);
      },
      (e: Error) => {
        if (live) setError(e.message);
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">最近被轉述的對象</h2>
      <p className={note}>近 30 天的轉述對象，可包括人物、機構或帳號。角色與背景在共用分類中管理；此處檢視各篇文章的轉述證據。</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {!subjects && !error && <p className={note}>載入中…</p>}
      <ul className="mt-3 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        {subjects?.map((s) => (
          <li key={s.name} className="flex flex-wrap items-center gap-3 py-2">
            <Link
              href={`/admin/tags/?${new URLSearchParams({ view: 'relations', tag: s.name })}`}
              className="font-medium text-brand-700 underline dark:text-brand-400"
            >
              {s.name}
            </Link>
            <span className="text-xs text-zinc-500">
              {s.articles} 篇 · {s.outlets} 家
            </span>
            <Link href={`/admin/tags/?tag=${encodeURIComponent(s.name)}`} className="ml-auto underline">
              編輯分類
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
