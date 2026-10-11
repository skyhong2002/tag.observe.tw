import Link from 'next/link';
import MethodLink from '@/components/MethodLink';
import Sparkline from '@/components/Sparkline';
import { pageMetadata } from '@/lib/seo.mts';
import { fetchWritingArticles, fetchWritingOverview, PLATFORM_LABEL, ROLE_LABEL, ROLES, type Role, share } from '@/lib/writing';
import OutletTable from './OutletTable';
import WritingList from './WritingList';
import WritingTabs, { DayPicker, writingDays } from './WritingTabs';

export const revalidate = 300;
export const metadata = pageMetadata(
  '/writing/',
  '轉述社群貼文 · 看寫法',
  '哪些報導的開頭是在轉述某人的臉書、Threads 或節目發言，發文者是誰、各家媒體的比例與變化。',
);

type Query = { days?: string; role?: string; media?: string; poster?: string; platform?: string; before?: string };
const TABLE_ROLES: Role[] = ['公職政治', '前任公職', '評論名嘴', '醫療健康', '藝人網紅', '網友民眾'];

export default async function WritingPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const days = writingDays(query.days);
  const role = (ROLES as readonly string[]).includes(query.role ?? '') ? (query.role as Role) : undefined;
  const filters = { role, media: query.media?.slice(0, 32), poster: query.poster?.slice(0, 40), platform: query.platform };
  const [overview, list] = await Promise.all([
    fetchWritingOverview(days),
    fetchWritingArticles({ ...filters, days, limit: 30, before: query.before }),
  ]);
  const keep = { days: days === 30 ? undefined : String(days) };
  const filterHref = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ ...keep, ...extra }).filter((e): e is [string, string] => !!e[1]));
    return `/writing/${q.size ? `?${q}` : ''}#articles`;
  };
  const totals = overview?.totals;
  const trend = overview?.daily.map((d) => (d.articles >= 200 ? d.social / d.articles : null)) ?? [];
  const values = trend.filter((v): v is number => v !== null);
  const mediaName = overview?.media.find((m) => m.media === filters.media)?.name ?? filters.media;
  const active = [
    filters.media && `媒體：${mediaName}`,
    filters.role && `發文者：${ROLE_LABEL[filters.role]}`,
    filters.poster && `發文者：${filters.poster}`,
    filters.platform && `平台：${PLATFORM_LABEL[filters.platform] ?? filters.platform}`,
  ].filter(Boolean);
  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <WritingTabs current="social" days={days} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">轉述社群貼文</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            內文開頭寫明「某人在臉書、Threads、X
            或節目上發文／表示」的報導，以及發文者的身分。這是描述寫法，不評斷報導好壞：轉述官員發文本來就是常見的新聞來源。
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <DayPicker days={days} path="/writing/" params={{ ...filters, platform: filters.platform }} />
            <MethodLink />
          </p>
        </div>
      </header>

      {!overview || !totals ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">暫時無法取得統計，請稍後重新整理。</p>
      ) : (
        <>
          <section aria-label="總覽" className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                近 {days} 天分析 {totals.articles.toLocaleString('zh-TW')} 篇
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{share(totals.social, totals.articles)}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">開頭轉述社群貼文（{totals.social.toLocaleString('zh-TW')} 篇）</p>
              {values.length > 1 && (
                <div className="mt-3">
                  <Sparkline values={trend} className="h-16 w-full" />
                  <p className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>{overview.from}</span>
                    <span>
                      每日 {(100 * Math.min(...values)).toFixed(1)}%–{(100 * Math.max(...values)).toFixed(1)}%
                    </span>
                  </p>
                </div>
              )}
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {Object.entries(totals.platforms)
                  .filter(([, n]) => n)
                  .sort((a, b) => b[1] - a[1])
                  .map(([p, n]) => (
                    <Link key={p} href={filterHref({ platform: p })} className="hover:underline">
                      {PLATFORM_LABEL[p] ?? p} <span className="tabular-nums text-zinc-500">{share(n, totals.social)}</span>
                    </Link>
                  ))}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="mb-3 text-sm font-medium">誰的貼文被轉述</h2>
              <ul className="space-y-1.5 text-sm">
                {ROLES.map((r) => {
                  const n = totals.roles[r] ?? 0;
                  return (
                    <li key={r}>
                      <Link
                        href={filterHref({ media: filters.media, role: r })}
                        className="grid grid-cols-[7.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 hover:underline"
                      >
                        <span className="truncate">{ROLE_LABEL[r]}</span>
                        <span className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <span
                            className="block h-2 rounded-full bg-brand-600 dark:bg-brand-500"
                            style={{ width: `${totals.social ? (100 * n) / totals.social : 0}%` }}
                          />
                        </span>
                        <span className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">{share(n, totals.social)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                「身分未標明」是句子裡只有名字、本站也還對照不出身分的發文者。
              </p>
            </div>
          </section>

          <section aria-labelledby="outlets" className="space-y-3">
            <h2 id="outlets" className="text-lg font-semibold">
              各媒體
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              比例的分母是各家已分析的文章；近 {days} 天分析不到 100 篇的媒體與轉載站不列入。點比例看那些報導。
            </p>
            <OutletTable
              caption="各媒體轉述社群貼文的比例，依發文者身分分列"
              path="/writing/"
              query={Object.fromEntries(Object.entries(keep).filter((e): e is [string, string] => !!e[1]))}
              rows={overview.media.map((m) => ({
                media: m.media,
                name: m.name,
                articles: m.articles,
                values: { social: m.social, ...m.roles },
              }))}
              columns={[
                { key: 'social', label: '轉述貼文', hint: '開頭轉述社群貼文的比例' },
                ...TABLE_ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r], hint: `轉述${ROLE_LABEL[r]}貼文的比例`, filter: { role: r } })),
              ]}
            />
          </section>

          {overview.posters.length > 0 && (
            <section aria-labelledby="posters" className="space-y-3">
              <h2 id="posters" className="text-lg font-semibold">
                最常被轉述的發文者
              </h2>
              <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {overview.posters.map((p, i) => (
                  <li key={`${p.name}-${p.role}`} className="flex items-baseline gap-2">
                    <span className="w-6 text-right text-xs tabular-nums text-zinc-400">{i + 1}</span>
                    <Link href={filterHref({ poster: p.name })} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{p.role === '未知' ? '' : ROLE_LABEL[p.role]}</span>
                    <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                      {p.articles} 篇 · {p.outlets} 家
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="articles" className="space-y-2">
        <h2 id="articles" className="scroll-mt-24 text-lg font-semibold">
          轉述社群貼文的報導
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          {active.length ? (
            <>
              {active.map((a) => (
                <span key={a as string} className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  {a}
                </span>
              ))}
              <Link href={filterHref({})} className="text-brand-700 hover:underline dark:text-brand-400">
                清除條件
              </Link>
            </>
          ) : (
            '最新的在前；點上方的身分、媒體或發文者可以篩選。'
          )}
        </p>
        <WritingList articles={list?.articles ?? []} />
        {list?.next && (
          <p className="pt-2 text-sm">
            <Link
              href={filterHref({ ...filters, platform: filters.platform, before: String(list.next) })}
              className="text-brand-700 hover:underline dark:text-brand-400"
            >
              更早的報導 →
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
