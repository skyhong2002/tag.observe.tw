import Link from 'next/link';
import MethodLink from '@/components/MethodLink';
import Sparkline from '@/components/Sparkline';
import { taipei } from '@/lib/api';
import {
  fetchObservation,
  KIND_LABELS,
  OBSERVATION_DAYS,
  type Observation,
  type ObservationDays,
  type ObservedPage,
  pageHref,
} from '@/lib/observation';
import { canonicalQuery, pageMetadata } from '@/lib/seo.mts';
import DailyBars from './DailyBars';

export const revalidate = 60;
type Search = { days?: string };
const daysOf = (sp: Search): ObservationDays =>
  (OBSERVATION_DAYS as readonly number[]).includes(Number(sp.days)) ? (Number(sp.days) as ObservationDays) : 28;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }) {
  const days = daysOf(await searchParams);
  return pageMetadata(
    canonicalQuery('/observe/', { days: days === 28 ? undefined : String(days) }),
    '網站觀測',
    '新文易數的公開流量：每日瀏覽、讀者關注的事件與議題、來源管道、Google 搜尋表現與真實使用體驗。',
    true,
  );
}

const CHANNELS: Record<string, string> = {
  Direct: '直接造訪',
  'Organic Search': 'Google 等搜尋',
  'Organic Social': '社群網站',
  Referral: '其他網站連結',
  Unassigned: '未指派',
  'Cross-network': '跨聯播網',
  Email: '電子郵件',
  'Organic Video': '影音平台',
  'Paid Search': '付費搜尋',
};
const DEVICES: Record<string, string> = { desktop: '電腦', mobile: '手機', tablet: '平板' };
const EVENTS: Record<string, string> = {
  open_original: '點開原文',
  select_content: '從列表點進事件或標籤',
  rss_click: '點 RSS',
  app_installed: '安裝成 App',
};
const VITALS: Record<string, string> = { LCP: '主要內容出現', INP: '操作反應', CLS: '版面穩定' };

const n = (value: number) => value.toLocaleString('zh-TW');
const card = 'rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900';
const link = 'text-brand-700 hover:underline dark:text-brand-400';
const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={card}>
      <div className="text-xs text-zinc-600 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {note && <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{note}</div>}
    </div>
  );
}

/** GA Realtime: who is reading right now. */
function Live({ live }: { live: NonNullable<Observation['live']> }) {
  const time = new Date(live.fetchedAt).toLocaleTimeString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return (
    <section className={`${card} flex flex-wrap items-center gap-x-6 gap-y-3`} aria-label="最近 30 分鐘">
      <p className="flex items-center gap-2 text-sm">
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          {live.activeUsers > 0 && (
            <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-emerald-500 opacity-60" />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${live.activeUsers > 0 ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
        </span>
        最近 30 分鐘
      </p>
      <p className="text-sm">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{n(live.activeUsers)}</span> 位讀者
      </p>
      <p className="text-sm">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{n(live.views)}</span> 次瀏覽
      </p>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-1 sm:justify-end">
        <Sparkline values={live.perMinute} className="h-8 w-40 max-w-full" />
        <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">每分鐘瀏覽 · {time}</span>
      </div>
    </section>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={card}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {aside && <span className="text-xs text-zinc-600 dark:text-zinc-400">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** Label, value and a bar scaled to the largest row (one hue: these are shares of one total). */
function Shares({ rows, labels, unit }: { rows: Array<{ name: string; value: number }>; labels: Record<string, string>; unit: string }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5 text-sm">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex justify-between gap-3">
            <span>{labels[r.name] ?? r.name}</span>
            <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
              {n(r.value)} {unit} · {Math.round((r.value / total) * 100)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function PageList({ pages, value }: { pages: Array<Omit<ObservedPage, 'views'>>; value: (i: number) => string }) {
  return (
    <ol className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
      {pages.map((p, i) => (
        <li key={p.path} className="flex items-baseline gap-3 py-2">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-500">{i + 1}</span>
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {KIND_LABELS[p.kind]}
          </span>
          <Link href={pageHref(p.path)} className={`min-w-0 flex-1 truncate ${link}`} title={p.title}>
            {p.title}
          </Link>
          <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">{value(i)}</span>
        </li>
      ))}
    </ol>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-6 text-center text-sm text-zinc-500">{children}</p>;

/** Every day of the period; days before tracking began have no bar. */
function series(data: Observation, pick: (d: NonNullable<Observation['traffic']>['daily'][number]) => number) {
  const days = Array.from({ length: data.days }, (_, i) => shiftDay(data.start, i));
  const byDay = new Map(data.traffic?.daily.map((d) => [d.date, pick(d)]));
  return { days, values: days.map((d) => byDay.get(d) ?? (data.trackingSince && d >= data.trackingSince ? 0 : null)) };
}

function Vitals({ vitals }: { vitals: NonNullable<Observation['vitals']> }) {
  const parts = [
    { key: 'good', label: '良好', className: 'bg-emerald-600 dark:bg-emerald-500' },
    { key: 'needsImprovement', label: '需改善', className: 'bg-amber-500 dark:bg-amber-400' },
    { key: 'poor', label: '不佳', className: 'bg-red-600 dark:bg-red-500' },
  ] as const;
  return (
    <ul className="space-y-4 text-sm">
      {vitals.map((v) => {
        const total = v.good + v.needsImprovement + v.poor;
        return (
          <li key={v.name}>
            <div className="flex justify-between gap-3">
              <span>
                <span className="font-medium">{v.name}</span> {VITALS[v.name]}
              </span>
              <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{n(total)} 份樣本</span>
            </div>
            {total > 0 && (
              <>
                <div className="mt-1.5 flex h-2 gap-0.5 overflow-hidden rounded-full">
                  {parts.map((p) => v[p.key] > 0 && <div key={p.key} className={p.className} style={{ flexGrow: v[p.key] }} />)}
                </div>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {parts.map((p) => `${p.label} ${Math.round((v[p.key] / total) * 100)}%`).join(' · ')}
                </p>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default async function ObservePage({ searchParams }: { searchParams: Promise<Search> }) {
  const days = daysOf(await searchParams);
  const data = await fetchObservation(days);
  const traffic = data?.traffic;
  const search = data?.search;
  const views = data && series(data, (d) => d.views);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">網站觀測</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            本站的讀者從哪裡來、看了什麼
            {data?.updatedAt && ` · 更新於 ${taipei(data.updatedAt)}`}
            {data?.trackingSince && ` · ${data.trackingSince.replaceAll('-', '/')} 起`}
          </p>
        </div>
        <MethodLink className="text-sm" />
      </div>
      <nav className="flex gap-1 text-sm" aria-label="期間">
        {OBSERVATION_DAYS.map((d) => (
          <Link
            key={d}
            href={d === 28 ? '/observe/' : `/observe/?days=${d}`}
            scroll={false}
            aria-current={d === days ? 'page' : undefined}
            className={`whitespace-nowrap rounded-full px-3 py-1 ${d === days ? 'bg-brand-700 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
          >
            近 {d} 天
          </Link>
        ))}
      </nav>

      {!data ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600 dark:border-zinc-700">
          觀測資料暫時無法取得，請稍後再試。
        </p>
      ) : (
        <>
          {data.live && <Live live={data.live} />}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="瀏覽" value={traffic ? n(traffic.views) : '—'} />
            <Tile label="造訪" value={traffic ? n(traffic.sessions) : '—'} />
            <Tile label="Google 搜尋點擊" value={search ? n(search.clicks) : '—'} note={search ? undefined : '尚無資料'} />
            <Tile
              label="Google 搜尋曝光"
              value={search ? n(search.impressions) : '—'}
              note={search?.position ? `平均排名 ${search.position}` : search ? undefined : '尚無資料'}
            />
          </div>

          <Section title="每日瀏覽" aside="今天的長條較淡：仍在累計">
            {views && traffic ? (
              <DailyBars label="每日網頁瀏覽次數" name="瀏覽" days={views.days} values={views.values} partialLast />
            ) : (
              <Empty>還沒有瀏覽資料。</Empty>
            )}
          </Section>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section id="readers" className={card}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">讀者關注</h2>
                <span className="text-xs text-zinc-600 dark:text-zinc-400">內容頁瀏覽次數</span>
              </div>
              {data.content.length ? (
                <PageList pages={data.content} value={(i) => n(data.content[i].views)} />
              ) : (
                <Empty>這段期間還沒有內容頁的瀏覽。</Empty>
              )}
            </section>
            <div className="space-y-5">
              <Section title="從哪裡來" aside="造訪次數">
                {traffic?.channels.length ? <Shares rows={traffic.channels} labels={CHANNELS} unit="次" /> : <Empty>尚無資料。</Empty>}
              </Section>
              <Section title="用什麼裝置" aside="造訪次數">
                {traffic?.devices.length ? <Shares rows={traffic.devices} labels={DEVICES} unit="次" /> : <Empty>尚無資料。</Empty>}
              </Section>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <Section title="熱門頁面" aside="含首頁與索引頁">
              {data.pages.length ? (
                <PageList pages={data.pages.slice(0, 10)} value={(i) => n(data.pages[i].views)} />
              ) : (
                <Empty>尚無資料。</Empty>
              )}
            </Section>
            <Section title="讀者做了什麼">
              {traffic?.events.length ? (
                <dl className="grid grid-cols-2 gap-3">
                  {traffic.events.map((e) => (
                    <div key={e.name}>
                      <dt className="text-xs text-zinc-600 dark:text-zinc-400">{EVENTS[e.name] ?? e.name}</dt>
                      <dd className="text-xl font-semibold tabular-nums">{n(e.value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <Empty>尚無互動紀錄。</Empty>
              )}
            </Section>
          </div>

          <Section title="Google 搜尋" aside={search ? '美國太平洋時間，近 2–3 天可能仍會修正' : undefined}>
            {search ? (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="min-w-0">
                  <h3 className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">每日點擊</h3>
                  <DailyBars
                    className="h-44 w-full"
                    label="每日 Google 搜尋點擊"
                    name="點擊"
                    days={search.daily.map((d) => d.date)}
                    values={search.daily.map((d) => d.clicks)}
                  />
                  <h3 className="mt-4 mb-1 text-xs text-zinc-600 dark:text-zinc-400">每日曝光</h3>
                  <DailyBars
                    className="h-44 w-full"
                    label="每日 Google 搜尋曝光"
                    name="曝光"
                    days={search.daily.map((d) => d.date)}
                    values={search.daily.map((d) => d.impressions)}
                  />
                </div>
                <div>
                  <h3 className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">搜尋帶來最多點擊的頁面</h3>
                  {search.pages.length ? (
                    <PageList
                      pages={search.pages}
                      value={(i) => `${n(search.pages[i].clicks)} 點擊 / ${n(search.pages[i].impressions)} 曝光`}
                    />
                  ) : (
                    <Empty>還沒有頁面獲得搜尋點擊。</Empty>
                  )}
                </div>
              </div>
            ) : (
              <Empty>Search Console 還沒有回傳搜尋資料，通常在網站被收錄後幾天出現。</Empty>
            )}
          </Section>

          <Section title="使用體驗" aside={data.vitals ? '讀者瀏覽器回報的樣本' : undefined}>
            {data.vitals ? <Vitals vitals={data.vitals} /> : <Empty>還沒有讀者瀏覽器回報的使用體驗樣本。</Empty>}
          </Section>
        </>
      )}
    </div>
  );
}
