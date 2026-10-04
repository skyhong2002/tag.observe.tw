import type { Metadata } from 'next';
import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import MethodLink from '@/components/MethodLink';
import PendingLabel from '@/components/PendingLabel';
import SourceLink from '@/components/SourceLink';
import { API_ORIGIN, fetchMedia, type MediaInfo, taipei } from '@/lib/api';
import { clipHeadline, selectEventLead } from '@/lib/event-presentation.mts';
import { fetchEvents } from '@/lib/pages';
import { articleHref } from '@/lib/reading.mts';

// Site search over every stored article: title, summary and exact tag (we do
// not search article bodies), via /api/v1/articles. The scope and what the
// camp bar counts are in the footer's 資料來源與計算方式 (SearchMethod).

type Camp = 'green' | 'other' | 'blue';
const CAMPS: Array<{ key: Camp; label: string; bar: string; badge: string | null }> = [
  {
    key: 'green',
    label: '綠營傾向',
    bar: 'bg-emerald-700 text-white',
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800',
  },
  { key: 'other', label: '其他', bar: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-400 dark:text-zinc-950', badge: null },
  {
    key: 'blue',
    label: '藍營傾向',
    bar: 'bg-blue-700 text-white',
    badge: 'bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800',
  },
];
const RANGES = [
  { days: 1, label: '1 天' },
  { days: 7, label: '7 天' },
  { days: 31, label: '31 天' },
];
const PAGE = 30;

interface Hit {
  id: number;
  media: string;
  mediaTitle: string;
  camp: Camp;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  datePending: boolean;
  tags: string[];
}
interface Facets {
  total: number;
  camps: Record<Camp, number>;
  media: Array<{ media: string; count: number }>;
}
interface SearchResult {
  count: number;
  nextCursor: string | null;
  facets?: Facets;
  articles: Hit[];
}
type Search = { q?: string; days?: string; camp?: string; cursor?: string };

async function search(params: Record<string, string>): Promise<SearchResult | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/articles?${new URLSearchParams(params)}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? ((await res.json()) as SearchResult) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const q = (await searchParams).q?.trim();
  return { title: q ? `搜尋：${q}` : '搜尋新聞', robots: { index: false } };
}

function Highlight({ text, q }: { text: string; q: string }) {
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: split parts have no identity
          <mark key={i} className="rounded-sm bg-amber-100 px-0.5 text-inherit dark:bg-amber-900/60">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 60);
  const days = RANGES.some((r) => String(r.days) === sp.days) ? Number(sp.days) : 31;
  const camp = CAMPS.some((c) => c.key === sp.camp) ? (sp.camp as Camp) : null;
  const cursor = sp.cursor && /^\d+_\d+$/.test(sp.cursor) ? sp.cursor : null;
  const link = (patch: Partial<Record<keyof Search, string | null>>) => {
    const next: Record<string, string | null> = { q, days: days === 31 ? null : String(days), camp, ...patch };
    const params = new URLSearchParams(Object.entries(next).filter((kv): kv is [string, string] => Boolean(kv[1])));
    return `/search/?${params}`;
  };

  const base = { q, hours: String(days * 24) };
  const [page, overall, media, events] = q
    ? await Promise.all([
        search({
          ...base,
          limit: String(PAGE),
          ...(camp ? { camp } : {}),
          ...(cursor ? { cursor } : {}),
          ...(camp ? {} : { facets: '1' }),
        }),
        // The camp split always describes the whole match, also while one camp is filtered.
        camp ? search({ ...base, limit: '1', facets: '1' }) : Promise.resolve(null),
        fetchMedia().catch((): MediaInfo => ({})),
        cursor ? Promise.resolve(null) : fetchEvents(30).catch(() => null),
      ])
    : [null, null, {} as MediaInfo, null];
  const facets = (camp ? overall : page)?.facets;
  const needle = q.toLocaleLowerCase('zh-TW');
  const relatedEvents = (events?.events ?? [])
    .filter(
      (e) =>
        e.relatedEventPk &&
        [...e.major, ...e.tags.map((t) => t.tag), ...e.news.map((n) => n.title)].some((s) => s.toLocaleLowerCase('zh-TW').includes(needle)),
    )
    .slice(0, 3);
  const isTag = page?.articles.some((a) => a.tags.includes(q)) ?? false;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">搜尋新聞</h1>
        <form action="/search/" className="flex max-w-2xl gap-2">
          <input
            name="q"
            defaultValue={q}
            maxLength={60}
            placeholder="搜尋標題、摘要與標籤"
            aria-label="搜尋標題、摘要與標籤"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {days !== 31 && <input type="hidden" name="days" value={days} />}
          <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
            搜尋
          </button>
        </form>
        <p className="text-xs">
          <MethodLink />
        </p>
      </div>

      {!q ? null : !page ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600">搜尋暫時無法使用，請稍後再試。</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r.days}
                href={link({ days: r.days === 31 ? null : String(r.days) })}
                scroll={false}
                className={`whitespace-nowrap rounded-full px-3 py-1 ${r.days === days ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`}
              >
                {r.label}
              </Link>
            ))}
            {isTag && (
              <Link href={`/tag/${encodeURIComponent(q)}/`} className="ml-auto text-brand-700 hover:underline dark:text-brand-400">
                #{q} 標籤頁 →
              </Link>
            )}
          </div>

          {facets && facets.total > 0 && (
            <section
              className="space-y-3 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              aria-label="搜尋結果的媒體分布"
            >
              <p className="text-sm">
                「{q}」過去 {days} 天共 <strong className="tabular-nums">{facets.total.toLocaleString()}</strong> 篇，來自{' '}
                {facets.media.length} 家媒體
              </p>
              <div className="flex h-7 w-full gap-px overflow-hidden rounded text-[11px] font-medium">
                {CAMPS.filter((c) => facets.camps[c.key] > 0).map((c) => {
                  const n = facets.camps[c.key];
                  const pct = Math.round((n / facets.total) * 100);
                  return (
                    <Link
                      key={c.key}
                      href={link({ camp: camp === c.key ? null : c.key, cursor: null })}
                      scroll={false}
                      title={`${c.label} ${n.toLocaleString()} 篇（${pct}%）`}
                      className={`flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap ${c.bar} ${camp && camp !== c.key ? 'opacity-40' : ''}`}
                      style={{ flexGrow: n, flexBasis: 0 }}
                    >
                      {c.label} {pct}%
                    </Link>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <Link
                  href={link({ camp: null, cursor: null })}
                  scroll={false}
                  className={`rounded-full px-3 py-1 ${!camp ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`}
                >
                  全部 {facets.total.toLocaleString()}
                </Link>
                {CAMPS.map((c) => (
                  <Link
                    key={c.key}
                    href={link({ camp: c.key, cursor: null })}
                    scroll={false}
                    className={`rounded-full px-3 py-1 ${camp === c.key ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`}
                  >
                    {c.label} {facets.camps[c.key].toLocaleString()}
                  </Link>
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-zinc-600">
                {facets.media.slice(0, 16).map((m) => (
                  <li key={m.media} className="flex items-center gap-1">
                    <MediaIcon media={m.media} title={media[m.media]?.title} />
                    {media[m.media]?.title ?? m.media}
                    <span className="tabular-nums text-zinc-500">{m.count.toLocaleString()}</span>
                  </li>
                ))}
                {facets.media.length > 16 && <li className="text-zinc-500">另 {facets.media.length - 16} 家</li>}
              </ul>
            </section>
          )}

          {relatedEvents.length > 0 && (
            <section className="space-y-2" aria-label="相關焦點事件">
              <h2 className="text-sm font-medium text-zinc-600">相關焦點事件</h2>
              <ul className="grid gap-2 md:grid-cols-3">
                {relatedEvents.map((e) => {
                  const lead = selectEventLead(e.news, e.major);
                  return (
                    <li key={e.relatedEventPk}>
                      <Link
                        href={`/eve/${e.relatedEventPk}/`}
                        className="block h-full rounded-xl border border-zinc-300 bg-white p-3 text-sm hover:border-brand-700 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <span className="text-xs text-zinc-500">{e.major.slice(0, 3).join(' · ')}</span>
                        <span className="mt-1 line-clamp-2 block font-medium">{lead ? clipHeadline(lead.title) : e.major.join('、')}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {page.articles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600">
              過去 {days} 天沒有符合「{q}」的文章{camp ? '（目前只看單一傾向）' : ''}。
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-300 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {page.articles.map((a) => {
                const badge = CAMPS.find((c) => c.key === a.camp);
                return (
                  <li key={a.id} className="p-3">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-600">
                      <MediaHoverLink media={a.media} className="hover:underline">
                        {a.mediaTitle}
                      </MediaHoverLink>
                      {badge?.badge && (
                        <span className={`rounded px-1 text-[10px] font-medium ring-1 ring-inset ${badge.badge}`}>
                          {a.camp === 'blue' ? '偏藍' : '偏綠'}
                        </span>
                      )}
                      <span>·</span>
                      <span>
                        {taipei(a.publishedAt)}
                        {a.datePending && ' *'}
                      </span>
                    </p>
                    <Link href={articleHref(a)} className="mt-1 line-clamp-2 font-medium hover:underline">
                      <Highlight text={a.title} q={q} />
                    </Link>
                    <SourceLink url={a.url} className="ml-2" />
                    {a.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                        <Highlight text={a.description} q={q} />
                      </p>
                    )}
                    {a.tags.length > 0 && (
                      <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                        {a.tags.slice(0, 8).map((t) => (
                          <Link
                            key={t}
                            href={`/tag/${encodeURIComponent(t)}/`}
                            className={`mr-1.5 hover:text-brand-700 ${t === q ? 'font-medium text-brand-700 dark:text-brand-400' : ''}`}
                          >
                            #{t}
                          </Link>
                        ))}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex justify-between text-sm">
            {cursor ? (
              <Link href={link({ cursor: null })} scroll={false} className="text-brand-700 hover:underline dark:text-brand-400">
                ← 回到最新
              </Link>
            ) : (
              <span />
            )}
            {page.nextCursor && (
              <Link href={link({ cursor: page.nextCursor })} scroll={false} className="text-brand-700 hover:underline dark:text-brand-400">
                <PendingLabel>更早的結果 →</PendingLabel>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
