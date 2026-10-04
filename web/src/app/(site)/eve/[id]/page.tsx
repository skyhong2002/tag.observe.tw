import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CAMP_LABEL, FullBar } from '@/components/CampBar';
import EventChart, { type EventSeriesPoint } from '@/components/EventChart';
import EventTagCloud from '@/components/EventTagCloud';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
import { API_ORIGIN, taipei, taipeiHour } from '@/lib/api';
import { cleanEventHeadline, selectEventLead } from '@/lib/event-presentation.mts';
import {
  bestRank,
  type Camp,
  type CoverageOutlet,
  defaultDir,
  firstReports,
  flattenArticles,
  groupByHour,
  hourKey,
  OUTLET_SORTS,
  type OutletSort,
  outletRows,
  type ThreadHour,
  tagStats,
} from '@/lib/event-thread.mts';
import type { EventCoverage } from '@/lib/pages';
import { articleHref } from '@/lib/reading.mts';
import OutletTable from './OutletTable';
import { ByOutlet, CAMP_TEXT, CampColumns, CampDot, HourTable, SectionTitle, StatTiles, Timeline } from './sections';

export const revalidate = 120;

interface News {
  id?: number | null;
  title: string;
  url: string;
  image: string | null;
  media: string;
}
interface Hour extends ThreadHour {
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
}
interface Coverage {
  majorTags: string[];
  from: string;
  to: string;
  articles: number;
  outlets: number;
  camps: Array<{ camp: Camp; label: string; outlets: number; articles: number }>;
  blindspot: Camp[];
  byOutlet: CoverageOutlet[];
}
type ThreadData = { thread: Thread; related: number[]; hours: Hour[] };
type View = 'timeline' | 'camps' | 'outlets';
const VIEWS: Array<[View, string]> = [
  ['timeline', '依時間'],
  ['camps', '藍綠對照'],
  ['outlets', '依媒體'],
];

const threadUrl = (id: string) => `${API_ORIGIN}/api/v1/events/threads/${encodeURIComponent(id)}`;
const fetchThread = async (id: string): Promise<ThreadData | null> => {
  const res = await fetch(threadUrl(id), { next: { revalidate } });
  return res.ok ? ((await res.json()) as ThreadData) : null;
};
/** The event is named by its latest hour's lead headline, as the table and
 *  home page do: the thread's major tags pile up every story it absorbed. */
const headlineOf = (data: ThreadData) => {
  const latest = data.hours[0];
  const lead = latest ? selectEventLead(latest.news, latest.major) : null;
  return lead ? cleanEventHeadline(lead.title) : data.thread.majorTags.join('、');
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await fetchThread((await params).id);
  return { title: data ? headlineOf(data) : '事件' };
}

/** Coverage in the shape the shared camp bars take; one copy counts outlets, one counts reports. */
function asEventCoverage(cov: Coverage, by: 'outlets' | 'articles'): EventCoverage {
  const camps: Record<Camp, number> = { blue: 0, green: 0, other: 0 };
  for (const c of cov.camps) camps[c.camp] = c[by];
  return {
    outlets: cov.byOutlet.map((o) => ({ media: o.media, camp: o.camp })),
    articles: cov.articles,
    camps,
    share: null,
    lean: null,
    tilt: null,
    blindspot: cov.blindspot,
  };
}

export default async function EventThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; sort?: string; dir?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const view: View = VIEWS.some(([v]) => v === sp.view) ? (sp.view as View) : 'timeline';
  const sort: OutletSort = OUTLET_SORTS.includes(sp.sort as OutletSort) ? (sp.sort as OutletSort) : 'articles';
  const dir: 'asc' | 'desc' = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : defaultDir(sort);
  const base = threadUrl(id);
  const [data, covRes, seriesRes] = await Promise.all([
    fetchThread(id),
    fetch(`${base}/coverage`, { next: { revalidate } }),
    fetch(`${base}/series`, { next: { revalidate: 300 } }),
  ]);
  if (!data) notFound();
  // Coverage and series are separate, heavier queries; the page still renders without them.
  const cov = covRes.ok ? ((await covRes.json()) as Coverage) : null;
  const series = seriesRes.ok ? ((await seriesRes.json()) as { tags: string[]; points: EventSeriesPoint[] }) : null;
  const t = data.thread;
  const headline = headlineOf(data);
  const stats = tagStats(data.hours, t.majorTags);
  const best = bestRank(data.hours);
  const peakHour = data.hours.reduce<Hour | null>((m, h) => (!m || h.score > m.score ? h : m), null);
  // Snapshot hours and series points share the same UTC hour keys.
  const rankByHour = new Map(data.hours.map((h) => [new Date(h.hourStart).toISOString(), h.rank]));
  const rankAt = new Map(data.hours.map((h) => [hourKey(h.hourStart), h]));
  const hoursAsc = [...data.hours].sort((a, b) => a.hourStart.localeCompare(b.hourStart));
  const rows = cov ? outletRows(cov.byOutlet) : [];
  const groups = cov ? groupByHour(flattenArticles(cov.byOutlet, 'asc')) : [];
  const breaking = cov ? firstReports(cov.byOutlet) : [];
  const campCount = (camp: Camp, by: 'outlets' | 'articles') => cov?.camps.find((c) => c.camp === camp)?.[by] ?? 0;
  const blindspotText =
    cov && cov.blindspot.length > 0 ? `${cov.blindspot.map((c) => `${CAMP_LABEL[c]}傾向媒體`).join('與')}在這段期間沒有相關報導` : null;
  const href = (q: Record<string, string | undefined>, hash?: string) => {
    const next = new URLSearchParams();
    const merged = {
      view: view === 'timeline' ? undefined : view,
      sort: sort === 'articles' ? undefined : sort,
      dir: sort === 'articles' && dir === 'desc' ? undefined : dir,
      ...q,
    };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `/eve/${t.id}/${next.size ? `?${next}` : ''}${hash ? `#${hash}` : ''}`;
  };
  // Header links: the active column flips direction, any other starts at its default.
  const sortHref = (s: OutletSort, d: 'asc' | 'desc') =>
    href({ sort: s === 'articles' && d === 'desc' ? undefined : s, dir: s === 'articles' && d === 'desc' ? undefined : d }, 'outlets');
  const sortHrefs = Object.fromEntries(
    OUTLET_SORTS.map((s) => [s, sortHref(s, s === sort ? (dir === 'asc' ? 'desc' : 'asc') : defaultDir(s))]),
  ) as Record<OutletSort, string>;
  // Headlines the snapshot kept, for threads whose coverage query is unavailable or empty.
  const seen = new Set<string>();
  const news: News[] = [];
  for (const h of data.hours)
    for (const n of h.news)
      if (!seen.has(n.url)) {
        seen.add(n.url);
        news.push(n);
      }
  const jump = [
    ['trend', '時間變化'],
    ['tags', '標籤'],
    ['outlets', '各媒體報導量'],
    ['headlines', '標題對照'],
  ] as const;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/event/" className="hover:underline">
            事件表
          </Link>{' '}
          / 事件 #{t.id}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{headline}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">主要標籤</span>
          {t.majorTags.map((tag) => (
            <Link
              key={tag}
              href={`/tag/${encodeURIComponent(tag)}/`}
              className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-medium text-white dark:bg-brand-600"
            >
              {tag}
            </Link>
          ))}
          {stats
            .filter((s) => !s.major)
            .slice(0, 6)
            .map((s) => (
              <Link
                key={s.tag}
                href={`/tag/${encodeURIComponent(s.tag)}/`}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {s.tag}
              </Link>
            ))}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {taipeiHour(t.firstTime)} 至 {taipeiHour(t.lastTime)} · 上榜 {t.hours} 小時
          {t.hoursTotal && t.hoursTotal > t.hours ? `（含延續事件共 ${t.hoursTotal} 小時）` : ''}
          {data.related.length > 0 && (
            <>
              {' · 相關事件 '}
              {data.related.map((r) => (
                <Link key={r} href={`/eve/${r}/`} className="mr-1 text-brand-700 hover:underline dark:text-brand-400">
                  #{r}
                </Link>
              ))}
            </>
          )}
        </p>
        <nav className="flex flex-wrap gap-1 text-xs" aria-label="頁內段落">
          {jump.map(([anchor, label]) => (
            <a
              key={anchor}
              href={`#${anchor}`}
              className="rounded-md bg-zinc-100 px-2.5 py-1 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <StatTiles
        tiles={[
          {
            label: '事件表名次',
            value: best ? `最高第 ${best.rank} 名` : '—',
            note: best ? `${best.hours} 小時在第 ${best.rank} 名 · 共上榜 ${t.hours} 小時` : undefined,
          },
          {
            label: '最高分',
            value: (peakHour ? Math.max(peakHour.score, t.maxScore) : t.maxScore).toFixed(1),
            note: peakHour
              ? `${taipeiHour(peakHour.hourStart)}，由「${peakHour.tags[0]?.[0] ?? t.maxTag ?? '—'}」帶動`
              : (t.maxTag ?? undefined),
          },
          {
            label: '報導',
            value: cov ? `${cov.articles} 篇` : '—',
            note: cov ? `${cov.outlets} 家媒體 · ${taipeiHour(cov.from)} 起` : '報導分布暫時無法取得',
          },
          {
            label: '藍綠家數',
            value: cov ? (
              <span className="flex items-baseline gap-2 text-base">
                <span className={CAMP_TEXT.blue}>藍 {campCount('blue', 'outlets')}</span>
                <span className={CAMP_TEXT.green}>綠 {campCount('green', 'outlets')}</span>
                <span className={CAMP_TEXT.other}>其他 {campCount('other', 'outlets')}</span>
              </span>
            ) : (
              '—'
            ),
            note: cov
              ? `篇數 藍 ${campCount('blue', 'articles')} · 綠 ${campCount('green', 'articles')} · 其他 ${campCount('other', 'articles')}`
              : undefined,
          },
        ]}
      />

      <section className="space-y-3">
        <SectionTitle
          id="trend"
          note="上：各主要標籤每小時的分數（與標籤頁相同，採固定媒體基準，歷史不足留白），虛線為這則事件在事件表上的名次（右軸，第 1 名在最上面，未上榜的小時留空）；下：所有媒體帶有任一主要標籤的報導篇數。灰底為這則事件出現在事件表上的時段，前後各多顯示 12 小時。"
        >
          時間變化
        </SectionTitle>
        {series && series.points.length > 1 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <EventChart
              points={series.points}
              tags={series.tags}
              active={{ from: t.firstTime, to: t.lastTime }}
              ranks={series.points.map((p) => rankByHour.get(p.t) ?? null)}
            />
          </div>
        )}
        <h3 className="text-sm font-medium">
          每小時名次與標籤{' '}
          <span className="text-xs font-normal text-zinc-600 dark:text-zinc-400">點時間可看當時整張事件表；標籤後的數字是該小時分數。</span>
        </h3>
        <HourTable hours={hoursAsc} maxScore={Math.max(t.maxScore, ...data.hours.map((h) => h.score))} />
      </section>

      <section className="space-y-3">
        <SectionTitle
          id="tags"
          note={
            <>
              每小時事件表會列出這件事的前 12
              個標籤與分數；這裡合併整段期間，字越大最高分越高，移到字上可看分數與出現小時數，點選進入標籤頁。
              <span className="text-brand-700 dark:text-brand-400">橘色</span>是分群時認定的主要標籤（{t.majorTags.join('、')}
              ），報導分布與下方標題對照都依主要標籤計算，其餘標籤只出現在這裡與上方每小時列表。
            </>
          }
        >
          標籤（{stats.length}）
        </SectionTitle>
        <EventTagCloud stats={stats} hours={data.hours.length} />
      </section>

      <section className="space-y-3">
        <SectionTitle
          id="outlets"
          note={
            cov
              ? `以主要標籤在 ${taipeiHour(cov.from)} 至 ${taipeiHour(cov.to)} 之間的報導計算；同一家媒體同標題只算一次。藍綠傾向依本站媒體分類，僅供對照標題角度。點欄名可排序。`
              : '報導分布暫時無法取得，請稍後重新整理。'
          }
        >
          各媒體報導量{cov ? `（${cov.outlets} 家 · ${cov.articles} 篇）` : ''}
        </SectionTitle>
        {cov && cov.articles > 0 && (
          <div className="grid gap-3 rounded-xl border border-zinc-300 bg-white p-4 text-sm md:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">依媒體家數</p>
              <FullBar c={asEventCoverage(cov, 'outlets')} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">依報導篇數</p>
              <FullBar c={asEventCoverage(cov, 'articles')} />
            </div>
            {breaking.length > 0 && (
              <div className="md:col-span-2">
                <p className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">各陣營最早報導</p>
                <ul className="grid gap-2 md:grid-cols-3">
                  {breaking.map((f) => (
                    <li key={f.camp} className="min-w-0">
                      <p className={`flex items-center gap-1.5 text-xs ${CAMP_TEXT[f.camp]}`}>
                        <CampDot camp={f.camp} />
                        {f.outlet.title}
                        <span className="tabular-nums text-zinc-500">{taipei(f.article.publishedAt)}</span>
                      </p>
                      <Link href={articleHref(f.article)} className="line-clamp-2 leading-snug hover:underline">
                        {f.article.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {blindspotText && (
              <p className="rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-800 md:col-span-2 dark:bg-amber-950 dark:text-amber-200">
                盲點：{blindspotText}。
              </p>
            )}
          </div>
        )}
        {rows.length > 0 ? (
          <OutletTable rows={rows} sort={sort} dir={dir} hrefs={sortHrefs} />
        ) : (
          cov && <p className="text-sm text-zinc-600 dark:text-zinc-400">這段期間沒有帶主要標籤的報導。</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle
            id="headlines"
            note={
              cov && cov.articles > 0
                ? '同一件事，各家怎麼下標。依時間看事件如何展開；藍綠對照把同一小時三類媒體的標題並排；依媒體看每家的完整報導。'
                : '這裡只保留事件表每小時挑出的代表標題。'
            }
          >
            標題對照{cov && cov.articles > 0 ? `（${cov.articles} 篇）` : news.length ? `（${news.length} 篇）` : ''}
          </SectionTitle>
          {cov && cov.articles > 0 && (
            <nav className="flex gap-1 text-sm" aria-label="標題排列方式">
              {VIEWS.map(([v, name]) => (
                <Link
                  key={v}
                  href={href({ view: v === 'timeline' ? undefined : v }, 'headlines')}
                  scroll={false}
                  aria-current={v === view ? 'page' : undefined}
                  className={`rounded-md px-3 py-1 ${v === view ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}
                >
                  {name}
                </Link>
              ))}
            </nav>
          )}
        </div>
        {cov && cov.articles > 0 ? (
          view === 'timeline' ? (
            <Timeline groups={groups} rankAt={rankAt} />
          ) : view === 'camps' ? (
            <CampColumns groups={groups} rankAt={rankAt} />
          ) : (
            <ByOutlet byOutlet={cov.byOutlet} />
          )
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-300 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {news.map((n) => (
              <li key={n.url} className="flex gap-3 p-3">
                {n.image && /^https?:\/\//.test(n.image) && (
                  <Link href={articleHref(n)} tabIndex={-1} aria-label={`閱讀：${n.title}`} className="flex-none">
                    <SafeImage
                      src={n.image}
                      alt=""
                      width={96}
                      height={64}
                      className="h-16 w-24 flex-none rounded-md object-cover"
                      loading="lazy"
                    />
                  </Link>
                )}
                <div className="min-w-0">
                  <Link href={articleHref(n)} className="line-clamp-2 font-medium hover:underline">
                    {n.title}
                  </Link>
                  <SourceLink url={n.url} className="ml-2" />
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{n.media}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
