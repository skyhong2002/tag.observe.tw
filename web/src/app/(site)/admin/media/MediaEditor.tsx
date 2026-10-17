'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import AdminGate, { adminFetch, note } from '../AdminGate';
import {
  type Definition,
  LabelToggle,
  type Outlet,
  OutletIcon,
  ROBOTS,
  type RobotsStatus,
  type RuleTrigger,
  robotsLabel,
  TRIGGERS,
} from './labels';
import { Bookmarklet, Outlets } from './Outlets';

type Article = {
  id: number;
  media: string;
  url: string;
  title: string;
  tags: string[];
  fetchStatus: string | null;
  fetchedAt: string | null;
  publishedAt: string;
  editedAt: string | null;
  editedBy: string | null;
  log: Array<{ id: number; tag: string; action: 'add' | 'remove'; email: string; at: string }>;
  authors: string[];
  bylineEditedAt: string | null;
  bylineEditedBy: string | null;
  bylineLog: Array<{ id: number; before: string[]; after: string[]; email: string; at: string }>;
};
type Lookup = { url: string; candidates: Array<Omit<Outlet, 'categories'>>; article: Article | null };
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
type Detail = Outlet & {
  definitions: Definition[];
  crawler: { group: string; disabled: boolean; aggregator: boolean } | null;
  runs: Run[];
  log: Array<{ id: number; category: string; action: 'add' | 'remove'; email: string; at: string }>;
  robots: Array<{
    host: string;
    status: RobotsStatus | null;
    googleOnly?: boolean;
    httpStatus?: number | null;
    disallow?: string[];
    error?: string | null;
    checkedAt?: string;
    lastOkAt?: string | null;
  }>;
  generatedRules: {
    active: { revision: number; trigger: RuleTrigger; createdAt: string; model: string; rules: unknown; validation: unknown } | null;
    history: Array<{
      revision: number;
      status: 'active' | 'superseded' | 'rejected';
      trigger: RuleTrigger;
      createdAt: string;
      rejectedAt: string | null;
      rejectedBy: string | null;
    }>;
    attempts: Array<{ at: string; trigger: RuleTrigger; status: string; rounds: number; reason: string | null }>;
  };
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
  const report = Number(params.get('report')) || null;
  const query = params.toString();
  return (
    <AdminGate next={`/admin/media/${query ? `?${query}` : ''}`}>
      <Resolver url={url} media={media} report={report} />
    </AdminGate>
  );
}

// Works out the outlet from ?media= or the bookmarklet's ?url=; with
// neither, lists every outlet and offers the bookmarklet.
function Resolver({ url, media, report }: { url: string; media: string; report: number | null }) {
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
  const choose = (next: string) =>
    router.replace(`/admin/media/?media=${next}${url ? `&url=${encodeURIComponent(url)}` : ''}${report ? `&report=${report}` : ''}`);
  const chosen = media || lookup?.article?.media || lookup?.candidates[0]?.media || '';
  if (!url && !media)
    return (
      <>
        <Outlets />
        <Bookmarklet />
      </>
    );
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
      {chosen && (
        <Editor key={chosen} media={chosen} url={url} report={report} article={lookup?.article?.media === chosen ? lookup.article : null} />
      )}
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

function Editor({ media, url, report, article }: { media: string; url: string; report: number | null; article: Article | null }) {
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
      {url && (
        <ThisArticle
          media={media}
          url={url}
          report={report}
          initial={article}
          canFetch={Boolean(detail.crawler && !detail.crawler.aggregator)}
        />
      )}
      <Crawl detail={detail} onDone={load} />
      <GeneratedRules detail={detail} onChanged={load} />
      <Robots detail={detail} />
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
      <p className={note}>
        點一下切換。可以複選；同時勾了藍營和綠營時，陣營分析會算成藍營。通訊社、平台代刊、新聞合作這類也是標籤：平台代刊是轉載其他媒體新聞的平台（Yahoo
        新聞、LINE TODAY），新聞合作是刊登公關稿、合作稿的網站。
      </p>
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

/** runArticles errors read `<url> -> <message>`; say it in plain words. */
function failureReason(error: string | undefined) {
  const message = error?.split(' -> ').pop() ?? '';
  if (/timeout|aborted/i.test(message)) return '原站 15 秒內沒有回應';
  const http = /HTTP (\d{3})/.exec(message);
  if (http) return http[1] === '404' ? '原站找不到這篇（HTTP 404）' : `原站回應 HTTP ${http[1]}`;
  return message || '原因不明';
}

function ThisArticle({
  media,
  url,
  report,
  initial,
  canFetch,
}: {
  media: string;
  url: string;
  report: number | null;
  initial: Article | null;
  canFetch: boolean;
}) {
  const [article, setArticle] = useState(initial);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  // Opened for one article (its page, a report): bring its section into view.
  const [scrolled, setScrolled] = useState(false);
  const scrollOnce = (node: HTMLElement | null) => {
    if (!node || scrolled || !initial) return;
    setScrolled(true);
    requestAnimationFrame(() => node.scrollIntoView({ block: 'start' }));
  };
  // From this site's own /article/<id>/ page, fetch the outlet's original.
  const source = article?.url ?? url;
  async function refetch() {
    const edited = [article?.editedAt && '標籤', article?.bylineEditedAt && '署名'].filter(Boolean).join('和');
    if (edited && !window.confirm(`這篇的${edited}有手動修改過。重抓會改用網頁上的內容，手動修改會被取代。確定要重抓嗎？`)) return;
    setBusy(true);
    const started = Date.now();
    const tick = () => setStatus(`正在抓取…已 ${Math.round((Date.now() - started) / 1000)} 秒（原站 15 秒內沒回應就放棄）`);
    tick();
    const timer = setInterval(tick, 1000);
    try {
      const body = await adminFetch<{
        added: boolean;
        article: Article | null;
        result: { failed: number; rejected: number; errors?: string[] };
      }>(`/auth/admin/media/${media}/refetch`, { method: 'POST', body: { url: source } });
      setArticle(body.article);
      setStatus(
        body.result.rejected
          ? '這篇不是這家媒體自己的報導，已排除。'
          : body.result.failed
            ? `抓取失敗：${failureReason(body.result.errors?.[0])}。稍後可以再試一次。`
            : body.added
              ? '已新增並抓取完成。'
              : '已重新抓取。',
      );
    } catch (e) {
      setStatus(`失敗：${(e as Error).message}`);
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }
  return (
    <section className={section} id="article" ref={(node) => scrollOnce(node)}>
      <h3 className={heading}>這篇文章</h3>
      {report && article && <ReportPanel id={report} article={article} onTagsApplied={setArticle} />}
      {article ? (
        <>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-zinc-500">標題</dt>
            <dd>
              {article.title || '（尚未取得）'}
              <Link href={`/article/${article.id}/`} className="ml-2 text-brand-700 underline dark:text-brand-400">
                本站頁面
              </Link>
            </dd>
            <dt className="text-zinc-500">狀態</dt>
            <dd>{article.fetchStatus ? (STATUS[article.fetchStatus] ?? article.fetchStatus) : '等待抓取'}</dd>
            <dt className="text-zinc-500">上次抓取</dt>
            <dd className="tabular-nums">{when(article.fetchedAt)}</dd>
          </dl>
          <ArticleByline key={`by-${article.id}-${article.fetchedAt}-${article.bylineEditedAt}`} article={article} onSaved={setArticle} />
          <ArticleTags key={`${article.id}-${article.fetchedAt}-${article.editedAt}`} article={article} onSaved={setArticle} />
        </>
      ) : (
        <p className={note}>本站還沒有收錄這篇。</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
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

// 單篇標籤增減: remove with ×, add by typing (several at once with 、 or ,).
type Report = {
  id: number;
  kind: 'tags' | 'byline' | 'media' | 'other';
  tags: string[] | null;
  message: string;
  status: 'open' | 'accepted' | 'rejected';
  createdAt: string;
  resolution: string | null;
  reporter: { email: string | null; name: string | null };
  article: { id: number } | null;
};
const REPORT_KIND: Record<Report['kind'], string> = {
  tags: '標籤不對',
  byline: '署名或記者不對',
  media: '媒體或來源歸屬不對',
  other: '其他問題',
};
const REPORT_STATUS: Record<Report['status'], string> = { open: '待處理', accepted: '已採納', rejected: '未採納' };

// The reader report this page was opened from (/admin/?report list): what
// they said, the suggested tags, and the decision, next to the editors.
function ReportPanel({ id, article, onTagsApplied }: { id: number; article: Article; onTagsApplied: (article: Article) => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    adminFetch<Report>(`/auth/admin/reports/${id}`)
      .then((r) => {
        setReport(r);
        setReply(r.resolution ?? '');
      })
      .catch((e: Error) => setStatus(e.message));
  }, [id]);
  if (!report)
    return status ? (
      <p className={note}>
        回報 #{id}：{status}
      </p>
    ) : null;
  if (report.article?.id !== article.id) return <p className={note}>回報 #{id} 是另一篇文章的回報。</p>;
  const current = new Set(article.tags);
  const suggested = new Set(report.tags ?? []);
  const sameTags = suggested.size === current.size && [...suggested].every((t) => current.has(t));
  async function applyTags() {
    setBusy(true);
    try {
      const body = await adminFetch<{ article: Article }>(`/auth/admin/articles/${article.id}/tags`, {
        method: 'PUT',
        body: { tags: report?.tags },
      });
      onTagsApplied(body.article);
      setStatus('已套用建議標籤。');
    } catch (e) {
      setStatus(`套用失敗：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  async function resolve(next: Report['status']) {
    setBusy(true);
    try {
      await adminFetch(`/auth/admin/reports/${id}`, { method: 'PUT', body: { status: next, resolution: reply } });
      setReport((r) => (r ? { ...r, status: next, resolution: next === 'open' ? null : reply || null } : r));
      setStatus(next === 'open' ? '已改回待處理。' : `已標記為${REPORT_STATUS[next]}，讀者會在自己的回報紀錄看到。`);
    } catch (e) {
      setStatus(`失敗：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        讀者回報 #{report.id} · {REPORT_KIND[report.kind]} · {report.reporter.name ?? report.reporter.email ?? '已刪除帳號'} ·{' '}
        {when(report.createdAt)} · {REPORT_STATUS[report.status]}
      </p>
      {report.tags && (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-xs">
          <span className="text-zinc-600 dark:text-zinc-400">建議標籤：</span>
          {[...new Set([...article.tags, ...report.tags])].map((t) => (
            <span
              key={t}
              className={`rounded px-1.5 py-px ${!current.has(t) ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : !suggested.has(t) ? 'bg-red-100 text-red-900 line-through dark:bg-red-950 dark:text-red-200' : 'bg-white dark:bg-zinc-900'}`}
              title={!current.has(t) ? '建議新增' : !suggested.has(t) ? '建議移除' : '不變'}
            >
              {t}
            </span>
          ))}
        </p>
      )}
      {report.message && <p className="mt-2 whitespace-pre-wrap">{report.message}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {report.tags && !sameTags && (
          <button type="button" className={button} disabled={busy} onClick={applyTags}>
            套用建議標籤
          </button>
        )}
        {report.status === 'open' ? (
          <>
            <input
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              maxLength={255}
              placeholder="給讀者的說明（選填）"
              className="min-w-48 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button type="button" className={primary} disabled={busy} onClick={() => resolve('accepted')}>
              採納
            </button>
            <button type="button" className={button} disabled={busy} onClick={() => resolve('rejected')}>
              不採納
            </button>
          </>
        ) : (
          <button type="button" className={button} disabled={busy} onClick={() => resolve('open')}>
            改回待處理
          </button>
        )}
        <Link href="/admin/" className="text-brand-700 underline dark:text-brand-400">
          回到回報列表
        </Link>
      </div>
      {status && (
        <p role="status" className="mt-2 text-zinc-600 dark:text-zinc-400">
          {status}
        </p>
      )}
    </div>
  );
}

// 手動改署名: one name per line or separated by 、; empty means 未署名.
function ArticleByline({ article, onSaved }: { article: Article; onSaved: (article: Article) => void }) {
  const [text, setText] = useState(article.authors.join('、'));
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const authors = [
    ...new Set(
      text
        .split(/[、,，;；\n]/)
        .map((a) => a.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    ),
  ];
  const dirty = authors.join('、') !== article.authors.join('、');
  async function save() {
    setBusy(true);
    setStatus('');
    try {
      const body = await adminFetch<{ article: Article }>(`/auth/admin/articles/${article.id}/authors`, {
        method: 'PUT',
        body: { authors },
      });
      onSaved(body.article);
      setStatus('已儲存。之後的自動抓取和署名修復都不會再改這篇的署名。');
    } catch (e) {
      setStatus(`儲存失敗：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4">
      <p className="text-sm text-zinc-500">
        署名
        {article.bylineEditedAt && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {article.bylineEditedBy} 於 {when(article.bylineEditedAt)} 手動修改
          </span>
        )}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="記者姓名，多位用、分隔；留空為未署名"
          aria-label="署名"
          className="w-72 max-w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button type="button" className={primary} disabled={!dirty || busy} onClick={save}>
          儲存署名
        </button>
        {dirty && (
          <button type="button" className={button} disabled={busy} onClick={() => setText(article.authors.join('、'))}>
            還原
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {authors.length ? `會顯示為：${authors.join('、')}` : '會顯示為：未署名'}。只填記者本人，不填「政治中心」這類單位。
      </p>
      {status && (
        <p role="status" className={note}>
          {status}
        </p>
      )}
      {article.bylineLog.length > 0 && (
        <details className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <summary className="cursor-pointer">署名修改紀錄（{article.bylineLog.length}）</summary>
          <ul className="mt-2 space-y-1">
            {article.bylineLog.map((entry) => (
              <li key={entry.id}>
                <span className="tabular-nums">{when(entry.at)}</span> {entry.email}：{entry.before.join('、') || '未署名'} →{' '}
                {entry.after.join('、') || '未署名'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ArticleTags({ article, onSaved }: { article: Article; onSaved: (article: Article) => void }) {
  const [tags, setTags] = useState(article.tags);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = tags.length !== article.tags.length || tags.some((t, i) => t !== article.tags[i]);
  const add = () => {
    const more = text
      .split(/[、,，;；#\n]/)
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    setTags((now) => [...new Set([...now, ...more])]);
    setText('');
  };
  async function save() {
    setBusy(true);
    setStatus('');
    try {
      const body = await adminFetch<{ article: Article }>(`/auth/admin/articles/${article.id}/tags`, { method: 'PUT', body: { tags } });
      onSaved(body.article);
      setStatus('已儲存。之後的自動抓取不會再改這篇的標籤；排行與事件下一輪更新時會用新標籤。');
    } catch (e) {
      setStatus(`儲存失敗：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  const removed = article.tags.filter((t) => !tags.includes(t));
  return (
    <div className="mt-4">
      <p className="text-sm text-zinc-500">
        標籤
        {article.editedAt && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {article.editedBy} 於 {when(article.editedAt)} 手動修改
          </span>
        )}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li
            key={tag}
            className={`inline-flex min-h-9 items-center gap-1 rounded-full border pl-3 text-sm ${
              article.tags.includes(tag)
                ? 'border-zinc-300 dark:border-zinc-700'
                : 'border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-950 dark:text-brand-200'
            }`}
          >
            {tag}
            <button
              type="button"
              aria-label={`移除「${tag}」`}
              onClick={() => setTags((now) => now.filter((t) => t !== tag))}
              className="flex h-9 w-8 items-center justify-center rounded-full text-zinc-500 hover:text-red-700 dark:hover:text-red-400"
            >
              ×
            </button>
          </li>
        ))}
        {!tags.length && <li className="text-sm text-zinc-500">（沒有標籤）</li>}
      </ul>
      {removed.length > 0 && <p className="mt-2 text-sm text-red-700 line-through dark:text-red-400">{removed.join('、')}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="新增標籤，可用、分隔"
            className="w-56 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button type="submit" className={button} disabled={!text.trim()}>
            加入
          </button>
        </form>
        <button type="button" className={primary} disabled={!dirty || busy} onClick={save}>
          儲存標籤
        </button>
        {dirty && (
          <button type="button" className={button} disabled={busy} onClick={() => setTags(article.tags)}>
            還原
          </button>
        )}
      </div>
      {status && (
        <p role="status" className={note}>
          {status}
        </p>
      )}
      {article.log.length > 0 && (
        <details className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          <summary className="cursor-pointer">標籤修改紀錄（{article.log.length}）</summary>
          <ul className="mt-2 space-y-1">
            {article.log.map((entry) => (
              <li key={entry.id}>
                <span className="tabular-nums">{when(entry.at)}</span> {entry.email} {entry.action === 'add' ? '加上' : '移除'}「{entry.tag}
                」
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
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

const ATTEMPT: Record<string, string> = { activated: '通過並上線', failed: '沒通過', 'dry-run': '試跑通過（未上線）' };
const REVISION: Record<string, string> = { active: '使用中', superseded: '已被新版取代', rejected: '已停用' };

// Crawl rules written by the gateway's model when this outlet's own rules
// stopped working (docs/generated-crawl-rules.md). They are data, kept in
// files outside the database; turning them off restores the hand-written rules.
function GeneratedRules({ detail, onChanged }: { detail: Detail; onChanged: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { active, history, attempts } = detail.generatedRules;
  if (!active && !history.length && !attempts.length) return null;
  async function reject() {
    setBusy(true);
    setError('');
    try {
      await adminFetch(`/auth/admin/media/${detail.media}/generated-rules/reject`, { method: 'POST', body: {} });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={section}>
      <h3 className={heading}>AI 爬取規則</h3>
      {active ? (
        <>
          <p className={note}>
            第 {active.revision} 版使用中（{TRIGGERS[active.trigger]}，{when(active.createdAt)}，{active.model}
            ）。這份規則已用真實頁面驗證過；停用後一分鐘內會回到原本的規則。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={button} disabled={busy} onClick={reject}>
              停用 AI 規則
            </button>
            {error && <span className="text-sm text-red-700 dark:text-red-400">{error}</span>}
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">規則內容與驗證結果</summary>
            <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
              {JSON.stringify({ rules: active.rules, validation: active.validation }, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <p className={note}>目前沒有使用中的 AI 規則。</p>
      )}
      {history.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
          {history.map((r) => (
            <li key={r.revision}>
              第 {r.revision} 版 · {TRIGGERS[r.trigger]} · {when(r.createdAt)} · {REVISION[r.status]}
              {r.rejectedBy && `（${r.rejectedBy}，${when(r.rejectedAt)}）`}
            </li>
          ))}
        </ul>
      )}
      {attempts.length > 0 && (
        <>
          <h4 className="mt-4 text-sm font-medium">最近的產生紀錄</h4>
          <ul className="mt-1 space-y-1 text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
            {attempts.map((a) => (
              <li key={a.at}>
                {when(a.at)} · {TRIGGERS[a.trigger]} · {ATTEMPT[a.status] ?? a.status} · {a.rounds} 輪{a.reason && ` · ${a.reason}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// robots.txt as last read each day. Recorded and shown only: the crawler does not obey it.
function Robots({ detail }: { detail: Detail }) {
  if (!detail.robots.length) return null;
  return (
    <section className={section}>
      <h3 className={heading}>robots.txt</h3>
      <p className={note}>每天讀一次，只記錄、顯示，爬蟲不會照它停下。</p>
      <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        {detail.robots.map((r) => (
          <li key={r.host}>
            <a href={`https://${r.host}/robots.txt`} className="underline" target="_blank" rel="noreferrer">
              {r.host}
            </a>
            ：
            {r.status ? (
              <span className={ROBOTS[r.status].className}>
                {robotsLabel({ status: r.status, googleOnly: !!r.googleOnly })}
                {r.status === 'unreachable' && r.error && `（${r.error}）`}
              </span>
            ) : (
              '尚未讀取'
            )}
            {r.disallow && r.disallow.length > 0 && <span className="text-zinc-500">　擋：{r.disallow.join('、')}</span>}
            {r.checkedAt && <span className="tabular-nums">　{when(r.checkedAt)} 讀取</span>}
            {r.status === 'unreachable' && <span className="tabular-nums">　上次讀到：{when(r.lastOkAt ?? null)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChangeLog({ detail }: { detail: Detail }) {
  if (!detail.log.length) return null;
  // Edits from before 性質 merged into the labels are logged as `role:<key>`.
  const label = new Map(detail.definitions.flatMap((d) => [[d.key, d.label] as const, [`role:${d.key}`, d.label] as const]));
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
