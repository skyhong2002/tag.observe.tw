import Link from 'next/link';
import { notFound } from 'next/navigation';
import EventChart, { type EventSeriesPoint } from '@/components/EventChart';
import SafeImage from '@/components/SafeImage';
import { API_ORIGIN, taipei, taipeiHour } from '@/lib/api';
export const revalidate = 120;
interface News {
  title: string;
  url: string;
  image: string | null;
  media: string;
}
interface Hour {
  hourStart: string;
  rank: number;
  score: number;
  major: string[];
  tags: Array<[string, number]>;
  news: News[];
}
interface Thread {
  id: number;
  firstTime: string;
  lastTime: string;
  hours: number;
  allTags: string[];
  majorTags: string[];
  maxTag: string | null;
  maxScore: number;
  hoursTotal: number | null;
  equalFirstTime: string | null;
  equalLastTime: string | null;
}
type Camp = 'blue' | 'green' | 'other';
interface CoverageArticle {
  id: number;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string;
  hits: number;
}
interface Outlet {
  media: string;
  title: string;
  icon: string | null;
  camp: Camp;
  articles: CoverageArticle[];
}
interface Coverage {
  majorTags: string[];
  from: string;
  to: string;
  articles: number;
  outlets: number;
  camps: Array<{ camp: Camp; label: string; outlets: number; articles: number }>;
  blindspot: Camp[];
  byOutlet: Outlet[];
}

const CAMP_STYLE: Record<Camp, { label: string; dot: string; ring: string }> = {
  blue: { label: '藍營傾向媒體', dot: 'bg-blue-600', ring: 'border-blue-200 dark:border-blue-900' },
  green: { label: '綠營傾向媒體', dot: 'bg-emerald-600', ring: 'border-emerald-200 dark:border-emerald-900' },
  other: { label: '其他媒體', dot: 'bg-zinc-400', ring: 'border-zinc-300 dark:border-zinc-800' },
};
const CAMP_ORDER: Camp[] = ['blue', 'green', 'other'];

function OutletBlock({ o }: { o: Outlet }) {
  return (
    <li className="rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        {o.icon ? (
          <SafeImage src={o.icon} alt="" width={16} height={16} className="rounded-sm" loading="lazy" />
        ) : (
          <span className="inline-block h-4 w-4 rounded-sm bg-zinc-300" />
        )}
        <Link href={`/media/${encodeURIComponent(o.media)}/`} className="hover:underline">
          {o.title}
        </Link>
        <span className="ml-auto text-xs text-zinc-600">{o.articles.length} 篇</span>
      </div>
      <ul className="space-y-2">
        {o.articles.map((a) => (
          <li key={a.id} className="flex gap-2">
            {a.image && /^https?:\/\//.test(a.image) && (
              <SafeImage src={a.image} alt="" width={64} height={44} className="h-11 w-16 flex-none rounded object-cover" loading="lazy" />
            )}
            <div className="min-w-0">
              <a href={a.url} target="_blank" rel="noopener" className="text-sm hover:underline">
                {a.title}
              </a>
              <p className="text-[11px] text-zinc-600">{taipei(a.publishedAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}

const clock = (iso: string) => taipei(iso).slice(-5);
const hourKey = (iso: string) => Math.floor(Date.parse(iso) / 3600e3);

/** Every report in time order, full headlines, grouped by hour. */
function Timeline({ cov, hours }: { cov: Coverage; hours: Hour[] }) {
  const rows = cov.byOutlet
    .flatMap((o) => o.articles.map((a) => ({ ...a, outlet: o })))
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const rankAt = new Map(hours.map((h) => [hourKey(h.hourStart), h]));
  const groups: Array<{ key: number; items: typeof rows }> = [];
  for (const r of rows) {
    const key = hourKey(r.publishedAt);
    if (groups.at(-1)?.key !== key) groups.push({ key, items: [] });
    groups.at(-1)?.items.push(r);
  }
  return (
    <ol className="space-y-4">
      {groups.map((g) => {
        const iso = new Date(g.key * 3600e3).toISOString();
        const h = rankAt.get(g.key);
        return (
          <li key={g.key}>
            <h3 className="mb-1 flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
              {taipeiHour(iso)}
              <span className="text-xs font-normal text-zinc-600">{g.items.length} 篇</span>
              {h && (
                <Link
                  href={`/event/?at=${encodeURIComponent(iso)}`}
                  className="text-xs font-normal text-sky-700 hover:underline dark:text-sky-400"
                >
                  事件表第 {h.rank} 名 →
                </Link>
              )}
            </h3>
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {g.items.map((a) => (
                <li key={a.id} className="flex gap-3 px-3 py-2">
                  <span className="w-11 flex-none pt-0.5 text-xs tabular-nums text-zinc-600">{clock(a.publishedAt)}</span>
                  <div className="min-w-0 flex-1">
                    <a href={a.url} target="_blank" rel="noopener" className="font-medium leading-snug hover:underline">
                      {a.title}
                    </a>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-600">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${CAMP_STYLE[a.outlet.camp].dot}`}
                        title={CAMP_STYLE[a.outlet.camp].label}
                      />
                      {a.outlet.icon && (
                        <SafeImage src={a.outlet.icon} alt="" width={12} height={12} className="rounded-sm" loading="lazy" />
                      )}
                      <Link href={`/media/${encodeURIComponent(a.outlet.media)}/`} className="hover:underline">
                        {a.outlet.title}
                      </Link>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** Who reported first, overall and per camp. */
function firstReports(cov: Coverage) {
  const first = new Map<Camp, { outlet: Outlet; at: string }>();
  for (const o of cov.byOutlet)
    for (const a of o.articles) {
      const cur = first.get(o.camp);
      if (!cur || a.publishedAt < cur.at) first.set(o.camp, { outlet: o, at: a.publishedAt });
    }
  return CAMP_ORDER.flatMap((c) => {
    const f = first.get(c);
    return f ? [{ camp: c, ...f }] : [];
  });
}

export default async function EventThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const view = (await searchParams).view === 'camps' ? 'camps' : 'timeline';
  const base = `${API_ORIGIN}/api/v1/events/threads/${encodeURIComponent(id)}`;
  const [res, covRes, seriesRes] = await Promise.all([
    fetch(base, { next: { revalidate } }),
    fetch(`${base}/coverage`, { next: { revalidate } }),
    fetch(`${base}/series`, { next: { revalidate: 300 } }),
  ]);
  if (!res.ok) notFound();
  const data = (await res.json()) as { thread: Thread; related: number[]; hours: Hour[] };
  // Coverage and series are separate, heavier queries; the page still renders without them.
  const cov = covRes.ok ? ((await covRes.json()) as Coverage) : null;
  const series = seriesRes.ok ? ((await seriesRes.json()) as { tags: string[]; points: EventSeriesPoint[] }) : null;
  const t = data.thread;
  const seen = new Set<string>();
  const news: News[] = [];
  for (const h of data.hours)
    for (const n of h.news)
      if (!seen.has(n.url)) {
        seen.add(n.url);
        news.push(n);
      }
  const byCamp = (c: Camp) => cov?.byOutlet.filter((o) => o.camp === c) ?? [];
  const blindspotText =
    cov && cov.blindspot.length > 0
      ? `${cov.blindspot.map((c) => (c === 'blue' ? '藍營傾向媒體' : '綠營傾向媒體')).join('與')}在這段期間沒有相關報導`
      : null;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-600">
          <Link href="/event/" className="hover:underline">
            事件表
          </Link>{' '}
          / 事件 #{t.id}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t.majorTags.join('、')}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {taipeiHour(t.firstTime)} 至 {taipeiHour(t.lastTime)} · 持續 {t.hours} 小時
          {t.hoursTotal && t.hoursTotal > t.hours ? `（含延續事件共 ${t.hoursTotal} 小時）` : ''} · 最高分 {t.maxScore.toFixed(1)}（
          {t.maxTag}）
        </p>
        {data.related.length > 0 && (
          <p className="mt-1 text-sm">
            相關事件：
            {data.related.map((r) => (
              <Link key={r} href={`/eve/${r}/`} className="mr-2 text-brand-700 hover:underline dark:text-brand-400">
                #{r}
              </Link>
            ))}
          </p>
        )}
      </div>

      {cov && (
        <section className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-sm font-medium text-zinc-600">報導分布</h2>
            <span className="text-sm">
              {cov.outlets} 家媒體 · {cov.articles} 篇
            </span>
            {cov.camps.map((c) => (
              <span key={c.camp} className="flex items-center gap-1 text-sm">
                <span className={`inline-block h-2 w-2 rounded-full ${CAMP_STYLE[c.camp].dot}`} />
                {CAMP_STYLE[c.camp].label} {c.outlets} 家 / {c.articles} 篇
              </span>
            ))}
          </div>
          {cov.articles > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-zinc-600">最早報導</span>
              {firstReports(cov).map((f) => (
                <span key={f.camp} className="flex items-center gap-1">
                  <span className={`inline-block h-2 w-2 rounded-full ${CAMP_STYLE[f.camp].dot}`} />
                  {f.outlet.title} {taipei(f.at)}
                </span>
              ))}
            </p>
          )}
          {blindspotText && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              盲點：{blindspotText}。
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-600">
            以主要標籤（{cov.majorTags.join('、')}）在 {taipeiHour(cov.from)} 至 {taipeiHour(cov.to)}{' '}
            之間的報導計算；藍綠傾向依本站媒體分類，僅供對照標題角度。
          </p>
        </section>
      )}

      {series && series.points.length > 1 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-600">時間變化</h2>
          <EventChart points={series.points} tags={series.tags} active={{ from: t.firstTime, to: t.lastTime }} />
          <p className="mt-1 text-xs text-zinc-600">
            上：各主要標籤每小時的分數（與標籤頁相同，所有媒體）；下：帶有任一主要標籤的報導篇數。灰底為這則事件出現在事件表上的時段，前後各多顯示
            12 小時。
          </p>
        </section>
      )}

      {cov && cov.articles > 0 && (
        <nav className="flex gap-1 text-sm">
          {(
            [
              ['timeline', `全部標題（依時間）`],
              ['camps', '藍綠對照'],
            ] as const
          ).map(([v, name]) => (
            <Link
              key={v}
              href={v === 'timeline' ? `/eve/${t.id}/` : `/eve/${t.id}/?view=${v}`}
              className={`rounded-md px-3 py-1 ${v === view ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}
            >
              {name}
            </Link>
          ))}
        </nav>
      )}

      <section className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        {cov && cov.articles > 0 && view === 'timeline' ? (
          <Timeline cov={cov} hours={data.hours} />
        ) : cov && cov.articles > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {CAMP_ORDER.map((c) => {
              const outlets = byCamp(c);
              return (
                <div key={c} className={`rounded-xl border p-2 ${CAMP_STYLE[c].ring}`}>
                  <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-medium">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${CAMP_STYLE[c].dot}`} />
                    {CAMP_STYLE[c].label}
                    <span className="ml-auto text-xs font-normal text-zinc-600">{outlets.length} 家</span>
                  </h2>
                  {outlets.length === 0 ? (
                    <p className="px-1 pb-2 text-xs text-zinc-600">這段期間沒有相關報導。</p>
                  ) : (
                    <ul className="space-y-2">
                      {outlets.map((o) => (
                        <OutletBlock key={o.media} o={o} />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-600">報導（{news.length}）</h2>
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-300 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {news.map((n) => (
                <li key={n.url} className="flex gap-3 p-3">
                  {n.image && /^https?:\/\//.test(n.image) && (
                    <SafeImage
                      src={n.image}
                      alt=""
                      width={96}
                      height={64}
                      className="h-16 w-24 flex-none rounded-md object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0">
                    <a href={n.url} target="_blank" rel="noopener" className="line-clamp-2 font-medium hover:underline">
                      {n.title}
                    </a>
                    <p className="mt-1 text-xs text-zinc-600">{n.media}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <aside className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-600">每小時主要標籤</h2>
          <p className="text-xs text-zinc-600">點時間可看當時整張事件表。</p>
          <ul className="rounded-xl border border-zinc-300 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-900">
            {data.hours.map((h) => (
              <li key={h.hourStart} className="flex flex-col gap-0.5 px-3 py-2">
                <Link href={`/event/?at=${encodeURIComponent(h.hourStart)}`} className="text-xs text-zinc-600 hover:underline">
                  {taipeiHour(h.hourStart)} · 第 {h.rank} 名 · {h.score.toFixed(1)}
                </Link>
                <span className="flex flex-wrap gap-1">
                  {h.major.map((m) => (
                    <Link
                      key={m}
                      href={`/tag/${encodeURIComponent(m)}/`}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                    >
                      {m}
                    </Link>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </div>
  );
}
