import Link from 'next/link';
import MediaIcon from '@/components/MediaIcon';
import MediaSidebar from '@/components/MediaSidebar';
import TopicCard, { kindNoun, topicHref, topicMediaHref } from '@/components/TopicCard';
import TopicCheckStatus from '@/components/TopicCheckStatus';
import { taipei } from '@/lib/api';
import {
  type FeedTopic,
  fetchTopicSearch,
  fetchTopics,
  kindCount,
  ofKind,
  type TopicKind,
  type TopicMedia,
  type TopicSearch,
  type TopicTagCount,
} from '@/lib/pages';

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

/** Keywords of a topic: from its name, else those of its recent coverage. */
const tagsOf = (t: FeedTopic) => (t.tags?.length ? t.tags : (t.coverage?.tags ?? []));

type Cluster = { tags: string[]; items: FeedTopic[]; mediaCount: number };
/** Topics from different outlets that map to the same site tags: the same
 *  story being packaged by several newsrooms at once. */
function clusters(feed: FeedTopic[]): Cluster[] {
  const byTags = new Map<string, FeedTopic[]>();
  for (const t of feed) {
    if (!tagsOf(t).length) continue;
    const key = [...tagsOf(t)].sort().join('\u0000');
    byTags.set(key, [...(byTags.get(key) ?? []), t]);
  }
  return [...byTags.values()]
    .map((items) => ({ tags: tagsOf(items[0]), items, mediaCount: new Set(items.map((i) => i.media)).size }))
    .filter((c) => c.mediaCount >= 2)
    .sort((a, b) => b.mediaCount - a.mediaCount || b.items.length - a.items.length)
    .slice(0, 8);
}

export type TopicIndexParams = { tag?: string | string[]; q?: string | string[] };
const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 50) || undefined;

/** The 議題表 (/topic/) and 專題 (/feature/) index: one layout, two kinds.
 *  A keyword (?tag=) or title filter (?q=) lists both kinds across outlets,
 *  the same on either page. Old ?coverage= / ?backlog= links are ignored. */
export default async function TopicIndex({ kind, searchParams }: { kind: TopicKind; searchParams: TopicIndexParams }) {
  const noun = kindNoun(kind);
  const base = kind === 'feature' ? '/feature/' : '/topic/';
  const tag = param(searchParams.tag);
  const q = param(searchParams.q);
  const [data, found] = await Promise.all([fetchTopics(120, kind), tag || q ? fetchTopicSearch({ tag, q }) : null]);
  // Outlets with none of this kind yet (only known once the API sends counts).
  const media = (data?.media ?? []).filter((m) => kindCount(m, kind) !== 0);
  // Older API builds have no merged feed; fall back to each outlet's latest.
  const feed: FeedTopic[] = (
    data?.feed ?? (data?.media ?? []).flatMap((m) => (m.latest ? [{ ...m.latest, media: m.media, mediaTitle: m.title, icon: m.icon }] : []))
  ).filter((t) => ofKind(t, kind) && t.status !== 'ended');
  const groups = groupByDay(feed, new Date());
  const shared = clusters(feed);
  const tagCounts = data?.tags ?? found?.tags ?? [];
  const tagHref = (t: string) => `${base}?${new URLSearchParams({ tag: t })}`;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{kind === 'feature' ? '專題' : '議題表'}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {kind === 'feature' ? '一次性的新聞包；持續更新的新聞串請見' : '持續新增報導的新聞串；一次性的新聞包請見'}
          <Link
            href={kind === 'feature' ? '/topic/' : '/feature/'}
            className="text-brand-700 underline underline-offset-2 dark:text-brand-400"
          >
            {kind === 'feature' ? '議題表' : '專題'}
          </Link>
          。
        </p>
      </div>
      {!data && !found ? (
        <p className="text-zinc-600">{noun}資料目前無法取得。</p>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-8">
          <MediaSidebar label={`依媒體瀏覽（${media.length} 家）`}>
            <MediaList media={media} kind={kind} />
          </MediaSidebar>
          <div className="mt-5 min-w-0 space-y-6 lg:col-start-1 lg:row-start-1 lg:mt-0">
            <KeywordBar tags={tagCounts} active={tag} q={q} base={base} tagHref={tagHref} />
            {tag || q ? (
              <SearchResults found={found} tag={tag} q={q} />
            ) : (
              <>
                {shared.length > 0 && (
                  <section
                    aria-labelledby="shared-heading"
                    className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900 dark:bg-brand-950/20"
                  >
                    <h2 id="shared-heading" className="font-semibold">
                      多家媒體同時在做的{noun}
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">對應到相同站內標籤的{noun}，各家怎麼包裝同一件事。</p>
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                      {shared.map((c) => (
                        <li key={c.tags.join('/')} className="rounded-lg bg-white p-3 text-sm dark:bg-zinc-900">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {c.tags.map((t) => (
                              <Link
                                key={t}
                                href={tagHref(t)}
                                className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300"
                              >
                                {t}
                              </Link>
                            ))}
                            <span className="text-zinc-500">{c.mediaCount} 家媒體</span>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {c.items.map((t) => (
                              <li key={t.id} className="flex items-start gap-1.5">
                                <MediaIcon media={t.media} title={t.mediaTitle} className="mt-1" />
                                <Link href={topicHref(t.media, t.id, kind)} className="line-clamp-1 hover:underline">
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
                {groups.length === 0 && <p className="text-sm text-zinc-600">目前沒有最近新增的{noun}。</p>}
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
                        <TopicCard
                          key={t.id}
                          topic={t}
                          media={t.media}
                          mediaTitle={t.mediaTitle}
                          showMedia
                          kind={kind}
                          href={topicHref(t.media, t.id, kind)}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </>
            )}
          </div>
        </div>
      )}
      <MethodNotes kind={kind} mediaCount={data ? media.length : null} tagCount={tagCounts.length} />
    </div>
  );
}

const chipClass = (on: boolean) =>
  `inline-flex items-baseline gap-1 rounded-full border px-2.5 py-1 ${
    on
      ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-600 dark:bg-brand-950 dark:text-brand-200'
      : 'border-zinc-200 hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:hover:text-brand-400'
  }`;

const SHOWN_TAGS = 18;
/** The most common keywords across 議題 and 專題, and a title filter. */
function KeywordBar({
  tags,
  active,
  q,
  base,
  tagHref,
}: {
  tags: TopicTagCount[];
  active?: string;
  q?: string;
  base: string;
  tagHref: (tag: string) => string;
}) {
  // A tag from the URL that is not among the common ones still shows as selected.
  const chips: Array<Pick<TopicTagCount, 'tag'> & Partial<TopicTagCount>> =
    active && !tags.some((t) => t.tag === active) ? [{ tag: active }, ...tags] : tags;
  // Two or three rows; the rest folded so the list does not fill a phone screen.
  const shown = chips.slice(0, SHOWN_TAGS);
  const more = chips.slice(SHOWN_TAGS);
  const chip = (t: (typeof chips)[number]) => {
    const on = t.tag === active;
    return (
      <li key={t.tag}>
        <Link
          href={on ? base : tagHref(t.tag)}
          aria-current={on ? 'page' : undefined}
          title={t.media != null ? `${t.media} 家媒體：${t.topic} 個議題、${t.feature} 個專題` : undefined}
          className={chipClass(on)}
        >
          {t.tag}
          {t.media != null && <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{t.media} 家</span>}
        </Link>
      </li>
    );
  };
  return (
    <section aria-labelledby="keywords-heading" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="keywords-heading" className="text-sm font-semibold">
          各家把哪些關鍵字做成議題、專題
        </h2>
        {(active || q) && (
          <Link href={base} className="text-xs text-zinc-600 hover:underline dark:text-zinc-400">
            清除篩選 ×
          </Link>
        )}
      </div>
      {shown.length > 0 && <ul className="flex flex-wrap gap-1.5 text-xs">{shown.map(chip)}</ul>}
      {more.length > 0 && (
        <details open={more.some((t) => t.tag === active)} className="text-xs">
          <summary className="cursor-pointer text-zinc-600 hover:text-brand-700 dark:text-zinc-400">更多關鍵字（{more.length}）</summary>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">{more.map(chip)}</ul>
        </details>
      )}
      <form action={base} className="flex max-w-md gap-2">
        {active && <input type="hidden" name="tag" value={active} />}
        <input
          key={q ?? ''}
          name="q"
          defaultValue={q ?? ''}
          maxLength={50}
          aria-label="搜尋議題與專題名稱"
          placeholder="搜尋議題與專題名稱"
          className="min-w-0 flex-1 rounded border border-zinc-200 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-brand-600 dark:border-zinc-700"
        />
        <button
          type="submit"
          className="rounded border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          搜尋
        </button>
      </form>
    </section>
  );
}

const KIND_BADGE: Record<TopicKind, string> = {
  topic: 'border-brand-300 text-brand-700 dark:border-brand-800 dark:text-brand-300',
  feature: 'border-sky-300 text-sky-800 dark:border-sky-800 dark:text-sky-300',
};

/** Both kinds for a keyword or title filter, one block per outlet (the API sends them grouped). */
function SearchResults({ found, tag, q }: { found: TopicSearch | null; tag?: string; q?: string }) {
  if (!found) return <p className="text-sm text-zinc-600">篩選結果目前無法取得。</p>;
  const label = [tag && `「${tag}」`, q && `名稱含「${q}」`].filter(Boolean).join('、');
  const outlets: Array<{ media: string; title: string; items: FeedTopic[] }> = [];
  for (const t of found.topics) {
    const last = outlets.at(-1);
    if (last?.media === t.media) last.items.push(t);
    else outlets.push({ media: t.media, title: t.mediaTitle, items: [t] });
  }
  return (
    <section aria-labelledby="results-heading" className="space-y-4">
      <div>
        <h2 id="results-heading" className="font-semibold">
          {label}
        </h2>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
          {found.total
            ? `${found.mediaCount} 家媒體的 ${found.counts.topic} 個議題、${found.counts.feature} 個專題`
            : '沒有符合的議題或專題。'}
          {found.topics.length < found.total && `，列出前 ${found.topics.length} 個`}
          {tag && (
            <>
              {' · '}
              <Link href={`/tag/${encodeURIComponent(tag)}`} className="text-brand-700 hover:underline dark:text-brand-400">
                看「{tag}」的報導
              </Link>
            </>
          )}
        </p>
      </div>
      {outlets.map((o) => (
        <section key={o.media} aria-label={o.title}>
          <h3 className="flex items-center gap-1.5 border-b border-zinc-300 pb-1 text-sm font-semibold dark:border-zinc-800">
            <MediaIcon media={o.media} title={o.title} />
            {o.title}
            <span className="text-xs font-normal text-zinc-500">{o.items.length} 個</span>
          </h3>
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {o.items.map((t) => {
              const k = t.kind ?? 'topic';
              return (
                <li key={t.id} className="flex items-baseline gap-2 py-1.5">
                  <span className={`shrink-0 rounded border px-1 text-[10px] leading-4 ${KIND_BADGE[k]}`}>{kindNoun(k)}</span>
                  <span className="min-w-0 flex-1">
                    <Link href={topicHref(t.media, t.id, k)} className="hover:underline">
                      {t.title}
                    </Link>
                    <span className="ml-2 whitespace-nowrap text-xs text-zinc-500">
                      {t.time && !t.backlog ? `首次發現 ${taipei(t.time)}` : '開始追蹤前已上架'}
                      {t.status === 'ended' && ' · 已停更'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}

/** 資料來源與計算方式 at the foot of the page, as on /media/[media]. */
function MethodNotes({ kind, mediaCount, tagCount }: { kind: TopicKind; mediaCount: number | null; tagCount: number }) {
  const noun = kindNoun(kind);
  return (
    <details className="border-t border-zinc-200 pt-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <summary className="cursor-pointer py-1.5 hover:text-brand-700 dark:hover:text-brand-400">資料來源與計算方式</summary>
      <ul className="mt-1 space-y-1.5 border-l-2 border-zinc-200 pl-3 leading-5 dark:border-zinc-800">
        <li>
          {mediaCount != null ? `${mediaCount} 家媒體官方${noun}入口的最新動態，` : `追蹤媒體官方${noun}入口，`}
          每小時檢查。每個{noun}下方列出本站近 3 天從各家媒體抓到的相關報導。來源持續擴充中，未列出的媒體不代表沒有{noun}。
        </li>
        <li>依本站首次發現時間排序，不等於媒體上架時間；本站開始追蹤前就已上架的{noun}列在最後。</li>
        <li>
          各家用詞不一（專題、專輯、策展…），本站依有沒有持續新增報導來分類，不照媒體的命名：持續新增報導的是議題（90
          天沒有新報導標為已停更），一次性的新聞包是專題。
        </li>
        <li>
          關鍵字：從議題與專題的名稱比對站內近 7
          天常用的標籤，標籤須構成名稱的主要部分（「懶人包」「專題」這類包裝用語不算）。上方列出未停更議題與專題中最常見的
          {tagCount ? ` ${tagCount} ` : ''}
          個，依帶有這個關鍵字的媒體家數排序；點選後列出各媒體帶這個關鍵字的議題與專題（含已停更），議題表與專題頁結果相同。
        </li>
      </ul>
    </details>
  );
}

function MediaList({ media, kind }: { media: TopicMedia[]; kind: TopicKind }) {
  return (
    <nav aria-label="依媒體瀏覽" className="rounded-xl border border-zinc-200 p-3 text-sm sm:col-span-2 dark:border-zinc-800">
      <h2 className="font-semibold">依媒體瀏覽</h2>
      <p className="mt-0.5 text-xs text-zinc-500">累計追蹤到的{kindNoun(kind)}數與來源更新狀態。</p>
      <ul className="mt-2 max-h-[70vh] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
        {media.map((m) => {
          const problem = !m.check || m.check.stale || m.check.status === 'failed' || m.check.status === 'partial';
          const count = kindCount(m, kind);
          return (
            <li key={m.media}>
              <Link href={topicMediaHref(m.media, kind)} className="flex items-center gap-2 py-1.5 hover:underline">
                <MediaIcon media={m.media} title={m.title} />
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                {count != null && <span className="text-xs text-zinc-500">{count}</span>}
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
