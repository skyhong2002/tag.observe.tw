import Link from 'next/link';
import MediaIcon from '@/components/MediaIcon';
import MediaSidebar from '@/components/MediaSidebar';
import TopicCard, { topicHref } from '@/components/TopicCard';
import TopicCheckStatus from '@/components/TopicCheckStatus';
import { type FeedTopic, fetchTopics, type TopicMedia } from '@/lib/pages';
export const revalidate = 300;
export const metadata = { title: '議題表' };

const taipeiDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10);
const DAY = 86400e3;

type Group = { key: string; label: string; items: FeedTopic[] };
/** Feed split by the day we first saw each topic, backlog last. */
function groupByDay(feed: FeedTopic[], now: Date): Group[] {
  const today = taipeiDay(now.toISOString());
  const yesterday = taipeiDay(new Date(+now - DAY).toISOString());
  const weekAgo = taipeiDay(new Date(+now - 7 * DAY).toISOString());
  const groups: Group[] = [
    { key: 'today', label: '今天新增', items: [] },
    { key: 'yesterday', label: '昨天', items: [] },
    { key: 'week', label: '過去 7 天', items: [] },
    { key: 'older', label: '更早', items: [] },
    { key: 'backlog', label: '開始追蹤前已上架', items: [] },
  ];
  for (const t of feed) {
    const day = t.time && !t.backlog ? taipeiDay(t.time) : null;
    const g = !day ? 'backlog' : day === today ? 'today' : day === yesterday ? 'yesterday' : day >= weekAgo ? 'week' : 'older';
    groups.find((x) => x.key === g)?.items.push(t);
  }
  return groups.filter((g) => g.items.length);
}

type Cluster = { tags: string[]; items: FeedTopic[]; mediaCount: number };
/** Topics from different outlets that map to the same site tags: the same
 *  story being packaged by several newsrooms at once. */
function clusters(feed: FeedTopic[]): Cluster[] {
  const byTags = new Map<string, FeedTopic[]>();
  for (const t of feed) {
    if (!t.coverage?.tags.length) continue;
    const key = [...t.coverage.tags].sort().join('\u0000');
    byTags.set(key, [...(byTags.get(key) ?? []), t]);
  }
  return [...byTags.values()]
    .map((items) => ({ tags: items[0].coverage?.tags ?? [], items, mediaCount: new Set(items.map((i) => i.media)).size }))
    .filter((c) => c.mediaCount >= 2)
    .sort((a, b) => b.mediaCount - a.mediaCount || b.items.length - a.items.length)
    .slice(0, 8);
}

export default async function TopicPage({ searchParams }: { searchParams: Promise<{ coverage?: string; backlog?: string }> }) {
  const sp = await searchParams;
  const onlyCovered = sp.coverage === '1';
  const hideBacklog = sp.backlog === '0';
  const data = await fetchTopics(120);
  // Older API builds have no merged feed; fall back to each outlet's latest.
  const all: FeedTopic[] =
    data?.feed ??
    (data?.media ?? []).flatMap((m) => (m.latest ? [{ ...m.latest, media: m.media, mediaTitle: m.title, icon: m.icon }] : []));
  const feed = all.filter((t) => (!onlyCovered || t.coverage) && (!hideBacklog || !t.backlog));
  const groups = groupByDay(feed, new Date());
  const shared = clusters(all);
  const filterHref = (next: { coverage?: boolean; backlog?: boolean }) => {
    const q = new URLSearchParams();
    if (next.coverage ?? onlyCovered) q.set('coverage', '1');
    if (next.backlog ?? hideBacklog) q.set('backlog', '0');
    const s = q.toString();
    return s ? `/topic/?${s}` : '/topic/';
  };
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">議題表</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {data
            ? `${data.media.length} 家媒體官方專題／議題入口的最新動態，每小時檢查。每個專題下方列出本站近 3 天從各家媒體抓到的相關報導。`
            : '追蹤媒體官方專題／議題入口，每小時檢查更新。'}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          依本站首次發現時間排序，不等於媒體上架時間。來源持續擴充中，未列出的媒體不代表沒有專題。
        </p>
      </div>
      {!data ? (
        <p className="text-zinc-600">議題資料目前無法取得。</p>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-8">
          <MediaSidebar label={`依媒體瀏覽（${data.media.length} 家）`}>
            <MediaList media={data.media} />
          </MediaSidebar>
          <div className="mt-5 min-w-0 space-y-6 lg:col-start-1 lg:row-start-1 lg:mt-0">
            {shared.length > 0 && (
              <section
                aria-labelledby="shared-heading"
                className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900 dark:bg-brand-950/20"
              >
                <h2 id="shared-heading" className="font-semibold">
                  多家媒體同時在做的專題
                </h2>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">對應到相同站內標籤的專題，各家怎麼包裝同一件事。</p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {shared.map((c) => (
                    <li key={c.tags.join('/')} className="rounded-lg bg-white p-3 text-sm dark:bg-zinc-900">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {c.tags.map((tag) => (
                          <Link
                            key={tag}
                            href={`/tag/${encodeURIComponent(tag)}`}
                            className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300"
                          >
                            {tag}
                          </Link>
                        ))}
                        <span className="text-zinc-500">{c.mediaCount} 家媒體</span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {c.items.map((t) => (
                          <li key={t.id} className="flex items-start gap-1.5">
                            <MediaIcon media={t.media} title={t.mediaTitle} className="mt-1" />
                            <Link href={topicHref(t.media, t.id)} className="line-clamp-1 hover:underline">
                              {t.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-500">篩選：</span>
              <Link
                href={filterHref({ coverage: !onlyCovered })}
                aria-pressed={onlyCovered}
                className={`rounded-full border px-3 py-1 ${onlyCovered ? 'border-brand-400 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200' : 'border-zinc-300 dark:border-zinc-700'}`}
              >
                只看有相關報導的
              </Link>
              <Link
                href={filterHref({ backlog: !hideBacklog })}
                aria-pressed={hideBacklog}
                className={`rounded-full border px-3 py-1 ${hideBacklog ? 'border-brand-400 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200' : 'border-zinc-300 dark:border-zinc-700'}`}
              >
                隱藏追蹤前已上架
              </Link>
              <span className="text-zinc-500">
                顯示 {feed.length} / {all.length} 個最近專題
              </span>
            </div>
            {groups.length === 0 && <p className="text-sm text-zinc-600">沒有符合篩選的專題。</p>}
            {groups.map((g) => (
              <section key={g.key} aria-labelledby={`group-${g.key}`}>
                <h2
                  id={`group-${g.key}`}
                  className="flex items-baseline gap-2 border-b border-zinc-300 pb-1 font-semibold dark:border-zinc-800"
                >
                  {g.label}
                  <span className="text-xs font-normal text-zinc-500">{g.items.length} 個</span>
                </h2>
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {g.items.map((t) => (
                    <TopicCard key={t.id} topic={t} media={t.media} mediaTitle={t.mediaTitle} showMedia href={topicHref(t.media, t.id)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MediaList({ media }: { media: TopicMedia[] }) {
  return (
    <nav aria-label="依媒體瀏覽" className="rounded-xl border border-zinc-200 p-3 text-sm sm:col-span-2 dark:border-zinc-800">
      <h2 className="font-semibold">依媒體瀏覽</h2>
      <p className="mt-0.5 text-xs text-zinc-500">累計追蹤到的專題數與來源更新狀態。</p>
      <ul className="mt-2 max-h-[70vh] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
        {media.map((m) => {
          const problem = !m.check || m.check.stale || m.check.status === 'failed' || m.check.status === 'partial';
          return (
            <li key={m.media}>
              <Link href={`/topic/${encodeURIComponent(m.media)}/`} className="flex items-center gap-2 py-1.5 hover:underline">
                <MediaIcon media={m.media} title={m.title} />
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                {m.count != null && <span className="text-xs text-zinc-500">{m.count}</span>}
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${problem ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  role="img"
                  aria-label={problem ? '來源更新異常' : '來源更新正常'}
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <details className="mt-2 text-xs text-zinc-500">
        <summary className="cursor-pointer">更新狀態詳情</summary>
        <ul className="mt-2 space-y-1">
          {media.map((m) => (
            <li key={m.media}>
              <a href={m.link} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                {m.title} ↗
              </a>{' '}
              <TopicCheckStatus check={m.check} />
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
