'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CAMP_FILL, CAMP_LABEL } from '@/components/CampBar';
import { prefs, readerFetch, savePrefs, when } from '@/lib/reader';
import { button, card, note, primary } from '../ReaderGate';

type Camp = 'blue' | 'green' | 'other';
type Report = {
  enabled: boolean;
  days: number;
  total: number;
  media: Array<{ media: string; title: string; count: number; camp: 'blue' | 'green' | null }>;
  camps: Record<Camp, number>;
  countries: Array<{ country: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
  daily: Array<{ day: string; count: number }>;
  recent: Array<{ id: number; media: string; mediaTitle: string; title: string; url: string; readAt: string }>;
};
const CAMPS: Camp[] = ['blue', 'green', 'other'];
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

// 閱讀報告: opt-in. Only articles opened on this site (/article/<id>/) while
// signed in are counted; turning it off deletes the record (app/src/reader/routes.ts).
export default function Reading() {
  const saved = prefs.useValue();
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = () =>
    readerFetch<Report>('/auth/me/history/report')
      .then(setReport)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const toggle = async (on: boolean) => {
    if (!on && !confirm('關閉後會刪除目前所有閱讀紀錄，確定嗎？')) return;
    setBusy(true);
    try {
      await savePrefs({ history: on });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const clear = async () => {
    if (!confirm('刪除所有閱讀紀錄？閱讀報告會從零開始。')) return;
    await readerFetch('/auth/me/history', { method: 'DELETE' }).catch((e: Error) => setError(e.message));
    await load();
  };
  if (error) return <p className={note}>{error}</p>;
  if (!report || saved === undefined) return <p className={note}>載入中…</p>;
  const on = Boolean(saved?.history);
  const top = report.media[0]?.count ?? 1;
  return (
    <div className="space-y-8">
      <section className={`${card} p-4`}>
        <p className="font-medium">閱讀紀錄：{on ? '開啟' : '關閉'}</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          開啟後，你登入時在本站打開的文章頁會記下來（只有你看得到），用來統計近 {report.days}{' '}
          天讀了哪些媒體、陣營與主題。到原站閱讀不會被記錄。關閉時會一併刪除所有紀錄。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {on ? (
            <>
              <button type="button" className={button} disabled={busy} onClick={() => toggle(false)}>
                關閉並刪除紀錄
              </button>
              <button type="button" className={button} disabled={busy || !report.total} onClick={clear}>
                只清除紀錄
              </button>
            </>
          ) : (
            <button type="button" className={primary} disabled={busy} onClick={() => toggle(true)}>
              開啟閱讀紀錄
            </button>
          )}
        </div>
      </section>

      {on && !report.total && <p className={note}>還沒有紀錄。之後在本站打開文章頁，就會出現在這裡。</p>}
      {report.total > 0 && (
        <>
          <section>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">近 {report.days} 天讀了</p>
            <p className="text-4xl font-semibold tabular-nums">
              {report.total}
              <span className="ml-1 text-base font-normal text-zinc-600 dark:text-zinc-400">篇，來自 {report.media.length} 家媒體</span>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">陣營分布</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">依本站的媒體標籤（藍營／綠營），其餘算「其他」。</p>
            <div
              className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded"
              role="img"
              aria-label={CAMPS.map((c) => `${CAMP_LABEL[c]} ${pct(report.camps[c], report.total)}%`).join('、')}
            >
              {CAMPS.filter((c) => report.camps[c]).map((c) => (
                <span
                  key={c}
                  className={CAMP_FILL[c]}
                  style={{ width: `${pct(report.camps[c], report.total)}%` }}
                  title={`${CAMP_LABEL[c]} ${report.camps[c]} 篇`}
                />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {CAMPS.map((c) => (
                <li key={c} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm ${CAMP_FILL[c]}`} aria-hidden="true" />
                  {CAMP_LABEL[c]}{' '}
                  <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                    {report.camps[c]} 篇（{pct(report.camps[c], report.total)}%）
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-8 md:grid-cols-2">
            <section>
              <h2 className="text-lg font-semibold">媒體</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {report.media.slice(0, 15).map((m) => (
                  <li key={m.media} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2" title={`${m.title} ${m.count} 篇`}>
                    <Link href={`/media/${encodeURIComponent(m.media)}/`} className="truncate hover:underline">
                      {m.title}
                    </Link>
                    <span
                      className="h-2 rounded-r bg-brand-600 dark:bg-brand-500"
                      style={{ width: `${Math.max(4, (m.count / top) * 100)}%` }}
                    />
                    <span className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">{m.count}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold">常讀主題</h2>
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {report.tags.map((t) => (
                  <li key={t.tag}>
                    <Link
                      href={`/tag/${encodeURIComponent(t.tag)}/`}
                      className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 hover:text-brand-700 dark:bg-zinc-800"
                    >
                      #{t.tag}
                      <span className="text-xs tabular-nums text-zinc-500">{t.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <h2 className="mt-6 text-lg font-semibold">來源國家</h2>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                {report.countries.map((c) => `${c.country} ${pct(c.count, report.total)}%`).join('、')}
              </p>
            </section>
          </div>

          <section>
            <h2 className="text-lg font-semibold">最近讀過</h2>
            <ul className={`${card} mt-3 divide-y divide-zinc-200 dark:divide-zinc-800`}>
              {report.recent.map((r) => (
                <li key={r.id} className="px-3 py-2">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.mediaTitle} · {when(r.readAt)} 讀
                  </p>
                  <Link href={`/article/${r.id}/`} className="font-medium hover:underline">
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
