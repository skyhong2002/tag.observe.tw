import Link from 'next/link';
import { CAMP_LONG, CAMP_TEXT, CampDot } from '@/components/EventCampDot';
import MediaHoverLink from '@/components/MediaHoverLink';
import { taipeiHour } from '@/lib/api';
import {
  CAMP_ORDER,
  type Camp,
  type CoverageOutlet,
  type HourGroup,
  hourIso,
  type ThreadHour,
  type TimedArticle,
} from '@/lib/event-thread.mts';
import HeadlineRowView from './HeadlineRowView';

// Presentational pieces of the event thread page. Pure shaping lives in
// lib/event-thread.mts so it can be unit-tested; this file only lays it out.

export { CAMP_TEXT, CampDot } from '@/components/EventCampDot';

const tagHref = (tag: string) => `/tag/${encodeURIComponent(tag)}/`;
const card = 'rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900';

export function SectionTitle({ id, children, note }: { id: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div>
      <h2 id={id} className="scroll-mt-20 text-base font-semibold">
        {children}
      </h2>
      {note && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{note}</p>}
    </div>
  );
}

/** Four headline numbers: the run, the peak, the reach, the split. */
export function StatTiles({ tiles }: { tiles: Array<{ label: string; value: React.ReactNode; note?: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className={`${card} px-4 py-3`}>
          <dt className="text-xs text-zinc-600 dark:text-zinc-400">{t.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums leading-tight">{t.value}</dd>
          {t.note && <dd className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Hour by hour: rank, score, and the hour's own top tags, so a reader can see
 *  which angle carried the story at each point. */
export function HourTable({ hours, maxScore }: { hours: ThreadHour[]; maxScore: number }) {
  const atLink = (iso: string) => `/event/?at=${encodeURIComponent(iso)}`;
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-zinc-50 text-left text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2 font-medium">時間</th>
            <th className="px-3 py-2 text-right font-medium">名次</th>
            <th className="px-3 py-2 font-medium">分數</th>
            <th className="px-3 py-2 font-medium">主要標籤</th>
            <th className="px-3 py-2 font-medium">其他高分標籤</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {hours.map((h) => {
            const others = h.tags.filter(([t]) => !h.major.includes(t)).slice(0, 6);
            return (
              <tr key={h.hourStart} className="align-top hover:bg-brand-50/60 dark:hover:bg-zinc-800/60">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                  <Link href={atLink(h.hourStart)} className="hover:underline" title="看這個小時的整張事件表">
                    {taipeiHour(h.hourStart)}
                  </Link>
                </td>
                <td className={`px-3 py-2 text-right font-medium tabular-nums ${h.rank === 1 ? 'text-brand-700 dark:text-brand-400' : ''}`}>
                  {h.rank}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 tabular-nums text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
                      <span
                        className="block h-full rounded-full bg-brand-600 dark:bg-brand-500"
                        style={{ width: `${Math.max(3, (h.score / Math.max(maxScore, 1e-9)) * 100)}%` }}
                      />
                    </span>
                    {h.score.toFixed(1)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {h.major.map((m) => (
                      <Link
                        key={m}
                        href={tagHref(m)}
                        className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-medium text-white dark:bg-brand-600"
                      >
                        {m}
                      </Link>
                    ))}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {others.map(([t, s]) => (
                      <Link
                        key={t}
                        href={tagHref(t)}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        title={`分數 ${s.toFixed(1)}`}
                      >
                        {t}
                        <span className="ml-1 tabular-nums text-zinc-500">{s.toFixed(0)}</span>
                      </Link>
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Never pass TimedArticle.outlet here: it contains every article at that outlet. */
function HeadlineRow({
  a,
  showCamp = true,
  time = true,
  showOutlet = true,
}: {
  a: TimedArticle;
  showCamp?: boolean;
  time?: boolean;
  showOutlet?: boolean;
}) {
  return (
    <HeadlineRowView
      a={{
        id: a.id,
        title: a.title,
        url: a.url,
        image: a.image,
        publishedAt: a.publishedAt,
        outlet: { media: a.outlet.media, title: a.outlet.title, camp: a.outlet.camp },
      }}
      showCamp={showCamp}
      time={time}
      showOutlet={showOutlet}
    />
  );
}

function HourHeading({ g, rankAt }: { g: HourGroup; rankAt: Map<number, ThreadHour> }) {
  const iso = hourIso(g.key);
  const h = rankAt.get(g.key);
  return (
    <h3 className="mb-1 flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
      {taipeiHour(iso)}
      <span className="text-xs font-normal text-zinc-600 dark:text-zinc-400">{g.items.length} 篇</span>
      <span className="flex items-center gap-1.5 text-xs font-normal text-zinc-600 dark:text-zinc-400">
        {CAMP_ORDER.filter((c) => g.byCamp[c].length > 0).map((c) => (
          <span key={c} className="inline-flex items-center gap-1">
            <CampDot camp={c} />
            {g.byCamp[c].length}
          </span>
        ))}
      </span>
      {h ? (
        <Link href={`/event/?at=${encodeURIComponent(iso)}`} className="text-xs font-normal text-sky-700 hover:underline dark:text-sky-400">
          事件表第 {h.rank} 名 →
        </Link>
      ) : (
        <span className="text-xs font-normal text-zinc-500">未上榜</span>
      )}
    </h3>
  );
}

/** Every report in time order, grouped by hour. */
export function Timeline({ groups, rankAt }: { groups: HourGroup[]; rankAt: Map<number, ThreadHour> }) {
  return (
    <ol className="space-y-4">
      {groups.map((g) => (
        <li key={g.key}>
          <HourHeading g={g} rankAt={rankAt} />
          <ul className={`${card} divide-y divide-zinc-100 px-3 text-sm dark:divide-zinc-800`}>
            {g.items.map((a) => (
              <HeadlineRow key={a.id} a={a} />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** Same hour, three columns: what blue-leaning, green-leaning and other
 *  outlets ran side by side, so the framing can be read across. */
export function CampColumns({ groups, rankAt }: { groups: HourGroup[]; rankAt: Map<number, ThreadHour> }) {
  const head = (c: Camp, n: number) => (
    <p className={`mb-1 flex items-center gap-1.5 text-xs font-medium ${CAMP_TEXT[c]}`}>
      <CampDot camp={c} />
      {CAMP_LONG[c]}
      <span className="font-normal text-zinc-500">{n ? `${n} 篇` : '沒有報導'}</span>
    </p>
  );
  return (
    <ol className="space-y-5">
      {groups.map((g) => (
        <li key={g.key}>
          <HourHeading g={g} rankAt={rankAt} />
          <div className="grid gap-3 md:grid-cols-3">
            {CAMP_ORDER.map((c) => (
              <div
                key={c}
                className={`${card} px-3 py-2 ${g.byCamp[c].length === 0 ? 'border-dashed bg-transparent dark:bg-transparent' : ''}`}
              >
                {head(c, g.byCamp[c].length)}
                {g.byCamp[c].length > 0 && (
                  <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                    {g.byCamp[c].map((a) => (
                      <HeadlineRow key={a.id} a={a} showCamp={false} time={false} />
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Grouped by outlet, most prolific first, with each outlet's full run. */
export function ByOutlet({ byOutlet, order }: { byOutlet: CoverageOutlet[]; order: 'asc' | 'desc' }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {byOutlet.map((o) => (
        <li key={o.media} className={`${card} p-3`}>
          <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
            <CampDot camp={o.camp} />
            <MediaHoverLink media={o.media} icon={16} className="hover:underline">
              {o.title}
            </MediaHoverLink>
            <span className="ml-auto text-xs font-normal tabular-nums text-zinc-600 dark:text-zinc-400">{o.articles.length} 篇</span>
          </div>
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {[...o.articles]
              .sort((a, b) => (order === 'asc' ? a.publishedAt.localeCompare(b.publishedAt) : b.publishedAt.localeCompare(a.publishedAt)))
              .map((a) => (
                <HeadlineRow key={a.id} a={{ ...a, outlet: o }} showOutlet={false} />
              ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
