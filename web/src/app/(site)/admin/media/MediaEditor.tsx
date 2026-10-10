'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import AdminGate, { adminFetch, note } from '../AdminGate';
import { type Definition, LabelToggle, type Outlet, OutletIcon } from './labels';

type Article = { id: number; title: string; tags: string[]; fetchStatus: string | null; fetchedAt: string | null; publishedAt: string };
type Lookup = { url: string; candidates: Array<Omit<Outlet, 'categories'>>; article: (Article & { media: string }) | null };
type Run = {
  stage: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  fetched: number | null;
  inserted: number | null;
  updated: number | null;
  failed: number | null;
};
type Detail = Omit<Outlet, 'categories'> & {
  categories: string[];
  definitions: Definition[];
  crawler: { group: string; disabled: boolean; aggregator: boolean } | null;
  runs: Run[];
  log: Array<{ id: number; category: string; action: 'add' | 'remove'; email: string; at: string }>;
};
type Job = { state: string; result: Record<string, unknown> | null; error: string | null };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'short' }) : '—';
const section = 'mt-8';
const heading = 'text-lg font-semibold';
const button =
  'min-h-9 rounded-full border border-zinc-300 bg-white px-4 text-sm hover:border-brand-600 hover:text-brand-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-brand-400 dark:hover:text-brand-400';
const primary = 'min-h-9 rounded-full bg-brand-700 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-brand-600';
const STATUS: Record<string, string> = {
  ok: '有標籤',
  title: '從標題補標籤',
  notags: '頁面沒有標籤',
  'title-none': '頁面和標題都沒有標籤',
  error: '抓取失敗（會重試）',
  failed: '抓取失敗',
};
const STATE: Record<string, string> = {
  waiting: '排隊中',
  delayed: '排隊中',
  active: '執行中',
  completed: '完成',
  failed: '失敗',
  unknown: '找不到工作',
};

export default function MediaEditor() {
  const params = useSearchParams();
  const url = params.get('url') ?? '';
  const media = params.get('media') ?? '';
  const query = params.toString();
  return (
    <AdminGate next={`/admin/media/${query ? `?${query}` : ''}`}>
      <Resolver url={url} media={media} />
    </AdminGate>
  );
}

// Works out the outlet from ?media= or the bookmarklet's ?url=.
function Resolver({ url, media }: { url: string; media: string }) {
  const router = useRouter();
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!url) return;
    setLookup(null);
    adminFetch<Lookup>(`/auth/admin/lookup?url=${encodeURIComponent(url)}`)
      .then(setLookup)
      .catch((e: Error) => setError(e.message));
  }, [url]);
  const choose = (next: string) => router.replace(`/admin/media/?media=${next}${url ? `&url=${encodeURIComponent(url)}` : ''}`);
  const chosen = media || lookup?.article?.media || lookup?.candidates[0]?.media || '';
  if (error) return <p className={note}>{error}</p>;
  if (url && !lookup && !media) return <p className={note}>正在辨認這是哪家媒體…</p>;
  return (
    <>
      {url && (
        <p className="mt-3 text-sm break-all text-zinc-600 dark:text-zinc-400">
          來自：
          <a href={url} target="_blank" rel="noreferrer" className="underline">
            {url}
          </a>
        </p>
      )}
      {url && lookup && !lookup.candidates.length && !media && <p className={note}>認不出這個網址是哪家媒體，請從下面選。</p>}
      <OutletPicker current={chosen} others={lookup?.candidates.filter((c) => c.media !== chosen) ?? []} onPick={choose} />
      {chosen && <Editor key={chosen} media={chosen} url={url} article={lookup?.article?.media === chosen ? lookup.article : null} />}
    </>
  );
}

function OutletPicker({
  current,
  others,
  onPick,
}: {
  current: string;
  others: Array<Omit<Outlet, 'categories'>>;
  onPick: (media: string) => void;
}) {
  const [all, setAll] = useState<Outlet[] | null>(null);
  const [open, setOpen] = useState(!current);
  const [text, setText] = useState('');
  useEffect(() => {
    if (open && !all)
      adminFetch<{ media: Outlet[] }>('/auth/admin/media')
        .then((body) => setAll(body.media))
        .catch(() => setAll([]));
  }, [open, all]);
  const q = text.trim().toLowerCase();
  const matches = q ? (all ?? []).filter((o) => o.media.includes(q) || o.title.toLowerCase().includes(q)).slice(0, 12) : [];
  return (
    <div className="mt-3 text-sm">
      {others.length > 0 && (
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-zinc-600 dark:text-zinc-400">也可能是：</span>
          {others.map((o) => (
            <button key={o.media} type="button" className={button} onClick={() => onPick(o.media)}>
              {o.title}
            </button>
          ))}
        </p>
      )}
      {current && !open ? (
        <button type="button" className="mt-2 text-brand-700 underline dark:text-brand-400" onClick={() => setOpen(true)}>
          不是這家？選別家媒體
        </button>
      ) : (
        <div className="mt-2">
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="輸入媒體名稱或代碼"
            className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {matches.length > 0 && (
            <ul className="mt-1 max-w-sm divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {matches.map((o) => (
                <li key={o.media}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setText('');
                      onPick(o.media);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <OutletIcon outlet={o} />
                    {o.title}
                    <span className="text-xs text-zinc-500">{o.media}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Editor({ media, url, article }: { media: string; url: string; article: Article | null }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(
    () =>
      adminFetch<Detail>(`/auth/admin/media/${media}`)
        .then(setDetail)
        .catch((e: Error) => setError(e.message)),
    [media],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (error) return <p className={note}>{error}</p>;
  if (!detail) return <p className={note}>載入中…</p>;
  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <OutletIcon outlet={detail} size={32} />
        <h2 className="text-xl font-semibold">{detail.title}</h2>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{detail.media}</span>
        <Link href={`/media/${detail.media}/`} className="text-sm text-brand-700 underline dark:text-brand-400">
          公開頁面
        </Link>
      </div>
      <Labels detail={detail} onSaved={load} />
      {url && <ThisArticle media={media} url={url} initial={article} canFetch={Boolean(detail.crawler && !detail.crawler.aggregator)} />}
      <Crawl detail={detail} onDone={load} />
      <ChangeLog detail={detail} />
    </>
  );
}

function Labels({ detail, onSaved }: { detail: Detail; onSaved: () => void }) {
  const [selected, setSelected] = useState(() => new Set(detail.categories));
  const [definitions, setDefinitions] = useState(detail.definitions);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = selected.size !== detail.categories.length || detail.categories.some((c) => !selected.has(c));
  const toggle = (key: string) =>
    setSelected((now) => {
      const next = new Set(now);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  async function save() {
    setBusy(true);
    setStatus('');
    try {
      await adminFetch(`/auth/admin/media/${detail.media}/categories`, { method: 'PUT', body: { categories: [...selected] } });
      setStatus('已儲存，網站上的分析幾分鐘內會更新。');
      onSaved();
    } catch (e) {
      setStatus(`儲存失敗：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    const label = name.trim();
    if (!label) return;
    setBusy(true);
    try {
      const def = await adminFetch<Definition>('/auth/admin/categories', { method: 'POST', body: { label } });
      setDefinitions((list) => [...list, def]);
      setSelected((now) => new Set(now).add(def.key));
      setName('');
      setStatus(`已新增「${def.label}」並勾選，記得按儲存。`);
    } catch (e) {
      setStatus(`新增失敗：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={section}>
      <h3 className={heading}>標籤</h3>
      <p className={note}>點一下切換。可以複選；同時勾了藍營和綠營時，陣營分析會算成藍營。</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {definitions.map((def) => (
          <LabelToggle key={def.key} def={def} on={selected.has(def.key)} onToggle={() => toggle(def.key)} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className={primary} disabled={!dirty || busy} onClick={save}>
          儲存
        </button>
        {dirty && (
          <button type="button" className={button} disabled={busy} onClick={() => setSelected(new Set(detail.categories))}>
            還原
          </button>
        )}
        <form
          className="flex items-center gap-2 sm:ml-auto"
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
            placeholder="新標籤名稱"
            className="w-36 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button type="submit" className={button} disabled={busy || !name.trim()}>
            新增標籤
          </button>
        </form>
      </div>
      {status && (
        <p role="status" className={note}>
          {status}
        </p>
      )}
    </section>
  );
}

function ThisArticle({ media, url, initial, canFetch }: { media: string; url: string; initial: Article | null; canFetch: boolean }) {
  const [article, setArticle] = useState(initial);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function refetch() {
    setBusy(true);
    setStatus('正在抓取…');
    try {
      const body = await adminFetch<{ added: boolean; article: Article | null; result: { failed: number; rejected: number } }>(
        `/auth/admin/media/${media}/refetch`,
        { method: 'POST', body: { url } },
      );
      setArticle(body.article);
      setStatus(
        body.result.rejected
          ? '這篇不是這家媒體自己的報導，已排除。'
          : body.result.failed
            ? '抓取失敗，請稍後再試。'
            : body.added
              ? '已新增並抓取完成。'
              : '已重新抓取。',
      );
    } catch (e) {
      setStatus(`失敗：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={section}>
      <h3 className={heading}>這篇文章</h3>
      {article ? (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-zinc-500">標題</dt>
          <dd>{article.title || '（尚未取得）'}</dd>
          <dt className="text-zinc-500">標籤</dt>
          <dd>{article.tags.length ? article.tags.join('、') : '（沒有）'}</dd>
          <dt className="text-zinc-500">狀態</dt>
          <dd>{article.fetchStatus ? (STATUS[article.fetchStatus] ?? article.fetchStatus) : '等待抓取'}</dd>
          <dt className="text-zinc-500">上次抓取</dt>
          <dd className="tabular-nums">{when(article.fetchedAt)}</dd>
        </dl>
      ) : (
        <p className={note}>本站還沒有收錄這篇。</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={button} disabled={busy || !canFetch} onClick={refetch}>
          {article ? '重抓這一篇' : '收錄這一篇'}
        </button>
        {!canFetch && <span className="text-sm text-zinc-500">這家媒體沒有可用的爬蟲設定。</span>}
        {status && (
          <span role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
            {status}
          </span>
        )}
      </div>
    </section>
  );
}

function Crawl({ detail, onDone }: { detail: Detail; onDone: () => void }) {
  const [jobs, setJobs] = useState<Record<string, { id: string; job: Job | null }>>({});
  const [error, setError] = useState('');
  const pending = Object.entries(jobs).filter(([, j]) => !j.job || !['completed', 'failed', 'unknown'].includes(j.job.state));
  useEffect(() => {
    if (!pending.length) return;
    const timer = setTimeout(async () => {
      const next = { ...jobs };
      for (const [stage, { id }] of pending) {
        const job = await adminFetch<Job>(`/auth/admin/jobs/${id}`).catch(() => ({ state: 'unknown', result: null, error: null }));
        next[stage] = { id, job };
        if (job.state === 'completed') onDone();
      }
      setJobs(next);
    }, 2000);
    return () => clearTimeout(timer);
  });
  async function start(stage: 'index' | 'articles') {
    setError('');
    try {
      const { jobId } = await adminFetch<{ jobId: string }>(`/auth/admin/media/${detail.media}/crawl`, { method: 'POST', body: { stage } });
      setJobs((now) => ({ ...now, [stage]: { id: jobId, job: null } }));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!detail.crawler)
    return (
      <section className={section}>
        <h3 className={heading}>爬蟲</h3>
        <p className={note}>這家媒體沒有爬蟲設定。</p>
      </section>
    );
  const busy = (stage: string) => pending.some(([s]) => s === stage);
  const summary = (job: Job | null) => {
    if (!job) return '已送出…';
    const r = job.result ?? {};
    const counts =
      job.state === 'completed'
        ? 'items' in r
          ? `：列表 ${r.items} 則、新增 ${r.inserted} 篇`
          : `：抓了 ${r.fetched} 篇、更新 ${r.updated} 篇、失敗 ${r.failed} 篇`
        : '';
    return `${STATE[job.state] ?? job.state}${counts}${job.error ? `（${job.error}）` : ''}`;
  };
  return (
    <section className={section}>
      <h3 className={heading}>爬蟲</h3>
      <p className={note}>
        排程：{detail.crawler.group === 'news' ? '新聞組（約每 10 分鐘）' : detail.crawler.group === 'hourly' ? '每小時組' : '未排程'}
        {detail.crawler.disabled && '，目前停用中（按鈕仍可手動跑）'}。 「跑
        index」會讀這家媒體的列表收錄新文章；「跑內文抓取」會抓還沒抓過的文章內文與標籤。
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {(['index', 'articles'] as const).map((stage) => (
          <div key={stage} className="flex flex-wrap items-center gap-2">
            <button type="button" className={button} disabled={busy(stage)} onClick={() => start(stage)}>
              {stage === 'index' ? '跑 index' : '跑內文抓取'}
            </button>
            {jobs[stage] && (
              <span role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
                {summary(jobs[stage].job)}
              </span>
            )}
          </div>
        ))}
      </div>
      {error && <p className={note}>{error}</p>}
      {detail.runs.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
          {detail.runs.map((run) => (
            <li key={`${run.stage}-${run.startedAt}`}>
              {when(run.startedAt)} {run.stage === 'index' ? 'index' : '內文'} · {run.status}
              {run.stage === 'index'
                ? ` · 新增 ${run.inserted ?? 0}`
                : ` · 抓 ${run.fetched ?? 0}、更新 ${run.updated ?? 0}、失敗 ${run.failed ?? 0}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChangeLog({ detail }: { detail: Detail }) {
  if (!detail.log.length) return null;
  const label = new Map(detail.definitions.map((d) => [d.key, d.label]));
  return (
    <section className={section}>
      <h3 className={heading}>修改紀錄</h3>
      <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        {detail.log.map((entry) => (
          <li key={entry.id}>
            <span className="tabular-nums">{when(entry.at)}</span> {entry.email} {entry.action === 'add' ? '加上' : '移除'}「
            {label.get(entry.category) ?? entry.category}」
          </li>
        ))}
      </ul>
    </section>
  );
}
