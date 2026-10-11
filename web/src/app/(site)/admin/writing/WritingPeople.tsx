'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROLE_LABEL, ROLES, type Role } from '@/lib/writing';
import AdminGate, { adminFetch, note } from '../AdminGate';

// Corrections for /writing/: the role a poster name carries. A correction
// applies to every analysed article naming that poster and is logged
// (app/src/writing/admin.ts).

type Poster = {
  name: string;
  /** The most common role among the poster's articles; roles has the split. */
  role: Role;
  roles: Array<{ role: Role; n: number }>;
  /** What decided most of them: clause = the article's own words, people = the name list. */
  basis: 'clause' | 'people' | null;
  articles: number;
  outlets: number;
  source: 'auto' | 'admin' | null;
  note: string | null;
};
type LogRow = { id: number; name: string; before: Role | null; after: Role | null; note: string; email: string; at: string };
const EDITABLE = ROLES.filter((r) => r !== '未知');
const when = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'short' });
const sourceLabel = (p: Poster) =>
  p.source === 'admin' ? '管理員修正' : p.basis === 'clause' ? '文中頭銜' : p.basis === 'people' ? '名字對照' : '—';

export default function WritingPeople() {
  return (
    <AdminGate next="/admin/writing/">
      <Editor />
    </AdminGate>
  );
}

function Editor() {
  const [q, setQ] = useState('');
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [data, setData] = useState<{ since: string; posters: Poster[]; log: LogRow[] } | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(
    () =>
      adminFetch<{ since: string; posters: Poster[]; log: LogRow[] }>(`/auth/admin/writing/people${q ? `?q=${encodeURIComponent(q)}` : ''}`)
        .then(setData)
        .catch((e: Error) => setError(e.message)),
    [q],
  );
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  const posters = (data?.posters ?? []).filter((p) => !onlyUnknown || p.role === '未知');
  return (
    <>
      <p className={note}>
        近 30 天被轉述最多的發文者（不含網友民眾）。改身分要寫原因，會套用到所有提到這個名字的報導；清除修正後交回每日的名字對照重新判斷。
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋名字"
          className="min-h-9 rounded border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={onlyUnknown} onChange={(e) => setOnlyUnknown(e.target.checked)} />
          只看身分未標明
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!data ? (
        <p className={note}>載入中…</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-3 font-medium">發文者</th>
              <th className="py-2 pr-3 text-right font-medium">報導</th>
              <th className="py-2 pr-3 font-medium">目前身分</th>
              <th className="py-2 font-medium">修正</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {posters.map((p) => (
              <Row key={p.name} poster={p} onSaved={load} />
            ))}
          </tbody>
        </table>
      )}
      {data && data.log.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">修正紀錄</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.log.map((l) => (
              <li key={l.id}>
                <span className="text-zinc-500">{when(l.at)}</span> {l.name}：{l.before ? ROLE_LABEL[l.before] : '（無）'} →{' '}
                {l.after ? ROLE_LABEL[l.after] : '清除'} · {l.note || '—'} <span className="text-zinc-500">{l.email}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Row({ poster, onSaved }: { poster: Poster; onSaved: () => void }) {
  const [role, setRole] = useState<Role | ''>('');
  const [reason, setReason] = useState('');
  const [state, setState] = useState('');
  const save = async (value: Role | null) => {
    setState('儲存中…');
    try {
      const r = await adminFetch<{ relabelled: number }>(`/auth/admin/writing/people/${encodeURIComponent(poster.name)}`, {
        method: 'PUT',
        body: { role: value, note: reason },
      });
      setState(`已更新 ${r.relabelled} 篇`);
      setRole('');
      setReason('');
      onSaved();
    } catch (e) {
      setState((e as Error).message);
    }
  };
  return (
    <tr className="align-top">
      <td className="py-2 pr-3">
        <a href={`/writing/?poster=${encodeURIComponent(poster.name)}`} className="text-brand-700 hover:underline dark:text-brand-400">
          {poster.name}
        </a>
        <span className="ml-1 text-xs text-zinc-500">{poster.outlets} 家</span>
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">{poster.articles}</td>
      <td className="py-2 pr-3">
        {ROLE_LABEL[poster.role] ?? poster.role}
        {poster.roles.length > 1 && (
          <span className="block text-xs text-zinc-500">
            {poster.roles.map((r) => `${ROLE_LABEL[r.role] ?? r.role} ${r.n}`).join('・')}
          </span>
        )}
        <span className="block text-xs text-zinc-500">
          {sourceLabel(poster)}
          {poster.note ? `：${poster.note}` : ''}
        </span>
      </td>
      <td className="py-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="min-h-8 rounded border border-zinc-300 px-2 dark:border-zinc-700 dark:bg-zinc-900"
            aria-label={`${poster.name} 的身分`}
          >
            <option value="">選擇身分</option>
            {EDITABLE.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="原因"
            className="min-h-8 w-40 rounded border border-zinc-300 px-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            disabled={!role || !reason.trim()}
            onClick={() => save(role as Role)}
            className="min-h-8 rounded-full border border-zinc-300 px-3 hover:border-brand-600 disabled:opacity-40 dark:border-zinc-700"
          >
            儲存
          </button>
          {poster.source === 'admin' && (
            <button type="button" onClick={() => save(null)} className="min-h-8 px-2 text-xs text-zinc-600 underline dark:text-zinc-400">
              清除修正
            </button>
          )}
          {state && <span className="text-xs text-zinc-500">{state}</span>}
        </div>
      </td>
    </tr>
  );
}
