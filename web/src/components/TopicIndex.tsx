import Link from 'next/link';
import MediaIcon from '@/components/MediaIcon';
import MediaSidebar from '@/components/MediaSidebar';
import TopicCard, { kindNoun, topicHref, topicMediaHref } from '@/components/TopicCard';
import TopicCheckStatus from '@/components/TopicCheckStatus';
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
import { gapLabel, kindLine, raceRounds, raceSummary, statusLine } from '@/lib/topic-race.mts';
import { groupByUpdate, updatedAtOf } from '@/lib/topic-update.mts';

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
  // The API sends the feed most recently updated first.
  const groups = groupByUpdate(feed, new Date());
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
                {groups.length === 0 && <p className="text-sm text-zinc-600">目前沒有最近更新的{noun}。</p>}
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

/** Both kinds for a keyword or title filter: for a keyword, outlets in the order
 *  they opened one (TagRace); for a title filter alone, one block per outlet (the API sends them grouped). */
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
      {tag ? (
        <TagRace topics={found.topics} />
      ) : (
        outlets.map((o) => (
          <section key={o.media} aria-label={o.title}>
            <h3 className="flex items-center gap-1.5 border-b border-zinc-300 pb-1 text-sm font-semibold dark:border-zinc-800">
              <MediaIcon media={o.media} title={o.title} />
              {o.title}
              <span className="text-xs font-normal text-zinc-500">{o.items.length} 個</span>
            </h3>
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {o.items.map((t) => {
                const k = t.kind ?? 'topic';
                const updated = updatedAtOf(t);
                return (
                  <li key={t.id} className="flex items-baseline gap-2 py-1.5">
                    <span className={`shrink-0 rounded border px-1 text-[10px] leading-4 ${KIND_BADGE[k]}`}>{kindNoun(k)}</span>
                    <span className="min-w-0 flex-1">
                      <Link href={topicHref(t.media, t.id, k)} className="hover:underline">
                        {t.title}
                      </Link>
                      <span className="ml-2 whitespace-nowrap text-xs text-zinc-500">
                        {updated ? `最後更新 ${taipeiDate(updated)}` : '更新時間不明（追蹤前已上架）'}
                        {t.status === 'ended' && ' · 已停更'}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}

const taipeiDate = (iso: string) => new Date(iso).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
const STATUS_BADGE = {
  active: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300',
  ended: 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400',
};

/** A keyword across outlets: who opened a 議題/專題 for it first, which kind
 *  each made, and whose 議題 is still updating. One row per outlet, its items
 *  (and their names) under it. */
function TagRace({ topics }: { topics: FeedTopic[] }) {
  if (!topics.length) return null;
  const rounds = raceRounds(topics);
  const dated = rounds.filter((r) => r.start);
  // Headings only when there is more than one list to tell apart.
  const roundLabel = (r: (typeof rounds)[number]) =>
    !r.start
      ? '開始時間不明（追蹤前已上架）'
      : dated.length === 1
        ? `${taipeiDate(r.start)} 起`
        : r === dated.at(-1)
          ? `最近一輪（${taipeiDate(r.start)} 起）`
          : `較早一輪（${taipeiDate(r.start)}–${taipeiDate(r.end ?? r.start)}）`;
  const summary = raceSummary(topics);
  const status = statusLine(summary);
  return (
    <div className="space-y-4">
      <ul className="space-y-0.5 text-sm text-zinc-700 dark:text-zinc-300">
        <li>{kindLine(summary)}</li>
        {status && <li>{status}</li>}
      </ul>
      {rounds.map((r) => (
        <section key={r.start ?? 'undated'} aria-label={rounds.length > 1 ? roundLabel(r) : undefined}>
          {rounds.length > 1 && <h3 className="mb-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">{roundLabel(r)}</h3>}
          <ol className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {r.outlets.map((o, i) => {
              const gap = r.outlets.length > 1 ? gapLabel(o.gapDays, i) : null;
              return (
                <li key={o.media} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-400" aria-hidden>
                      {o.start ? i + 1 : ''}
                    </span>
                    <Link
                      href={topicMediaHref(o.media, o.items[0].kind ?? 'topic')}
                      className="flex min-w-0 items-center gap-1.5 font-semibold hover:underline"
                    >
                      <MediaIcon media={o.media} title={o.mediaTitle} />
                      <span className="truncate">{o.mediaTitle}</span>
                    </Link>
                    <span className="ml-auto flex items-center gap-1.5 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400">
                      {o.start ? (
                        <>
                          <time dateTime={o.start}>{taipeiDate(o.start)} 開始</time>
                          {gap && (
                            <span
                              className={`rounded px-1 leading-4 ${
                                i === 0
                                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}
                            >
                              {gap}
                            </span>
                          )}
                        </>
                      ) : (
                        '追蹤前已上架'
                      )}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-1 pl-7 text-sm">
                    {o.items.map((t) => {
                      const k = t.kind ?? 'topic';
                      const st = t.status === 'ended' ? 'ended' : 'active';
                      const updated = updatedAtOf(t);
                      return (
                        <li key={t.id} className="flex items-baseline gap-2">
                          <span className={`shrink-0 rounded border px-1 text-[10px] leading-4 ${KIND_BADGE[k]}`}>{kindNoun(k)}</span>
                          <span className="min-w-0 flex-1">
                            <Link href={topicHref(t.media, t.id, k)} className="hover:underline">
                              {t.title}
                            </Link>
                            <span className="ml-2 inline-flex flex-wrap items-baseline gap-x-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                              {o.items.length > 1 && t.start && <span>{taipeiDate(t.start)} 開始</span>}
                              {k === 'topic' && (
                                <span className={`rounded border px-1 text-[10px] leading-4 ${STATUS_BADGE[st]}`}>
                                  {st === 'ended' ? '已停更' : '進行中'}
                                </span>
                              )}
                              {k === 'topic' && updated && <span>最後更新 {taipeiDate(updated)}</span>}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
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
        <li>
          依最後更新排序：最後更新是{noun}
          頁上最新一則報導的時間；沒有報導日期的，用本站首次發現時間（不等於媒體上架時間）。本站開始追蹤前就已上架、又沒有報導日期可查的
          {noun}，更新時間不明，不列入上方清單（各媒體頁列在最後）；已上架的{noun}有新報導時照樣排到前面。
        </li>
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
        <li>
          點選關鍵字後依各家開始做這個關鍵字的時間排序，最早的在前，並標出比最早一家晚幾天（以台灣日期計）。開始時間取媒體議題或專題頁上所列最早一則報導與本站首次發現兩者中較早的；本站開始追蹤前就已上架、又沒有報導日期可查的，標「追蹤前已上架」排在最後。一家有多個時以最早的為準，名稱全部列出。同一關鍵字隔年再出現（如每年的金馬）時，前面各家最後一則報導之後超過
          90 天才開始的，另算一輪重新比較先後。 進行中／已停更與最後更新日期只適用於議題。
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
