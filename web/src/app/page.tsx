import Link from 'next/link';
import { permanentRedirect, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { CampBadge, FullBar, SplitBar } from '@/components/CampBar';
import { eventHeadline, eventHref, Movement, OutletStrip, RankTrail } from '@/components/EventCard';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import { EventMethod, HomeMethod, MediaCardMethod } from '@/components/MethodNotes';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { taipei } from '@/lib/api';
import {
  type CampGap,
  DEMO_CAMPS,
  type DemoStory,
  type GraphOutlet,
  type GraphSummary,
  type JournalistBrief,
  loadDemo,
  loadHomeGraph,
  loadHomeJournalists,
  loadHomeTopics,
} from '@/lib/demo';
import { isAllowedImage } from '@/lib/images';
import { journalistHref } from '@/lib/journalists';
import type { EventCoverage, FeedTopic } from '@/lib/pages';
import { pageMetadata } from '@/lib/seo.mts';
import { updatedAtOf } from '@/lib/topic-update.mts';
import CampOutletDirectory from './_home/CampOutletDirectory';
import CampShareSummary from './_home/CampShareSummary';
import EventRecovery from './_home/EventRecovery';
import HeadlineSidebar from './_home/HeadlineSidebar';
import HomeRanking from './_home/HomeRanking';
import styles from './_home/home.module.css';
import Masthead from './_home/Masthead';
import NewsImage from './_home/NewsImage';
import ReadersPanel from './_home/ReadersPanel';

export const revalidate = 120;
export const metadata = pageMetadata(
  '/',
  '新文易數',
  '同一件事，各家怎麼說。比較台灣新聞媒體的報導標題，探索熱門事件、關鍵字排行與議題趨勢。',
);

function Arrow() {
  return <span aria-hidden="true">→</span>;
}

/** Outlet split for one story, drawn from the event snapshot's coverage. */
function Distribution({ coverage, compact = false }: { coverage: EventCoverage | null; compact?: boolean }) {
  if (!coverage || coverage.outlets.length === 0) return <span className={styles.muted}>報導分布暫無資料</span>;
  if (!compact) return <FullBar c={coverage} />;
  return (
    <div className={styles.compactDistribution}>
      <SplitBar c={coverage} width="w-16" />
      <span>
        {coverage.outlets.length} 家媒體 · {coverage.articles} 篇關聯報導
      </span>
      <CampBadge c={coverage} />
    </div>
  );
}

/** One line under the headline: source, when it charted, movement and the
 *  day's rank trail. The rank itself is the card's number. */
function StoryMeta({ story, trail = 'h-5 w-16' }: { story: DemoStory; trail?: string }) {
  return (
    <p className={styles.source}>
      <MediaHoverLink media={story.media} className="hover:underline">
        {story.source}
      </MediaHoverLink>
      {story.event.firstTime && <span>· {taipei(story.event.firstTime)} 上榜</span>}
      <Movement e={story.event} />
      <RankTrail e={story.event} className={trail} />
    </p>
  );
}

function CampGaps({ gaps }: { gaps: CampGap[] }) {
  if (gaps.every((g) => g.items.length === 0)) {
    return <p className={styles.notice}>今天沒有藍綠落差明顯的事件。</p>;
  }
  return (
    <div className={styles.gapList}>
      {gaps.map((col) => (
        <div key={col.camp} className={styles.gapGroup}>
          <p className={styles.gapGroupTitle}>
            <i className={styles[col.camp]} aria-hidden="true" />
            {col.title}
          </p>
          {col.items.length === 0 ? (
            <p className={styles.muted}>今天的事件裡沒有。</p>
          ) : (
            <ol>
              {col.items.map((e) => {
                const href = eventHref(e) ?? `/event/#event-${e.rank}`;
                return (
                  <li key={e.rank}>
                    <Link href={href}>{eventHeadline(e)}</Link>
                    <p>{e.coverage && <CampBadge c={e.coverage} />}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}

function JournalistPanel({ brief }: { brief: JournalistBrief | null }) {
  if (!brief) return <p className={styles.notice}>記者資料整理中。</p>;
  return (
    <ol className={styles.journalists}>
      {brief.top.map((j) => (
        <li key={j.name}>
          <Link href={journalistHref(j.name)}>
            <span className={styles.journalistName}>{j.name}</span>
            <span className={styles.journalistOutlets} title={j.media.map((m) => `${m.name} ${m.count} 篇`).join('、')}>
              {j.media.slice(0, 3).map((m) => (
                <MediaIcon key={m.media} media={m.media} title={m.name} size={14} />
              ))}
              {j.media.length > 3 && <small>+{j.media.length - 3}</small>}
            </span>
            <span className={styles.journalistCount}>
              {j.articles} 篇{j.similar.articles > 0 && <small>相近 {j.similar.articles}</small>}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function OutletList({ caption, rows, verb }: { caption: string; rows: GraphOutlet[]; verb: string }) {
  const max = rows[0]?.count ?? 1;
  return (
    <div>
      <p className={styles.panelCaption}>{caption}</p>
      <ol className={styles.pairList}>
        {rows.map((r) => (
          <li key={r.media}>
            <span className={styles.shareRow}>
              <span className={styles.pairNames}>
                <MediaHoverLink media={r.media} icon={14} className="hover:underline">
                  {r.name}
                </MediaHoverLink>
                {r.partnerName && (
                  <small>
                    {verb}
                    {r.partnerName}
                  </small>
                )}
              </span>
              <span className={styles.shareTrack} aria-hidden="true">
                <span style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
              </span>
            </span>
            <span className={styles.pairCount}>{r.count.toLocaleString()} 篇</span>
          </li>
        ))}
        {rows.length === 0 && <li className={styles.muted}>目前沒有紀錄。</li>}
      </ol>
    </div>
  );
}

function GraphPanel({ graph }: { graph: GraphSummary | null }) {
  if (!graph) return <p className={styles.notice}>相似度比對整理中。</p>;
  return (
    <div className={styles.graphBody}>
      <OutletList caption="文字相近，標示刊登較早" rows={graph.earliest} verb="相近對象：" />
      <OutletList caption="文字相近，標示刊登較晚" rows={graph.later} verb="相近對象：" />
      <OutletList caption="被他家明示引用" rows={graph.cited} verb="多被引用：" />
      <OutletList caption="明示引用他家" rows={graph.citing} verb="多引用：" />
      {/* What the columns mean is in the footer's 資料來源與計算方式 (HomeMethod). */}
      <p className={styles.panelFoot}>
        過去 {graph.hours} 小時比對 {graph.analyzed.toLocaleString()} 篇正文、{graph.citations.toLocaleString()} 筆明示引用 ·{' '}
        <a href="#method" className={styles.campShareMethod}>
          怎麼算 ⓘ
        </a>
      </p>
    </div>
  );
}

async function DeferredJournalists({ data }: { data: ReturnType<typeof loadHomeJournalists> }) {
  return <JournalistPanel brief={await data} />;
}

async function DeferredGraph({ data }: { data: ReturnType<typeof loadHomeGraph> }) {
  return <GraphPanel graph={await data} />;
}

async function DeferredTopics({ data }: { data: ReturnType<typeof loadHomeTopics> }) {
  return <TopicPanel topics={await data} />;
}

async function DeferredHomeMethod({
  basisCount,
  journalists,
  graph,
}: {
  basisCount?: number;
  journalists: ReturnType<typeof loadHomeJournalists>;
  graph: ReturnType<typeof loadHomeGraph>;
}) {
  const [j, g] = await Promise.all([journalists, graph]);
  return <HomeMethod basisCount={basisCount} journalistHours={j?.hours} graphHours={g?.hours} />;
}

function PanelLoading() {
  return (
    <p className={styles.notice} role="status">
      資料載入中…
    </p>
  );
}

// Story dates can be old: date with the year, no time (as on TopicCard).
const taipeiDate = (iso: string) => new Date(iso).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });

function TopicPanel({ topics }: { topics: { outlets: number; today: number; latest: FeedTopic[] } | null }) {
  if (!topics) return <p className={styles.notice}>議題資料整理中。</p>;
  if (topics.latest.length === 0) return <p className={styles.notice}>最近沒有更新的議題。</p>;
  return (
    <ul className={styles.topicList}>
      {topics.latest.map((t) => {
        const image = isAllowedImage(t.image) ? t.image : null;
        const href = `/topic/${encodeURIComponent(t.media)}/#topic-${t.id}`;
        const updated = updatedAtOf(t);
        return (
          <li key={`${t.media}-${t.id}`}>
            <Link href={href} className={styles.topicCover} tabIndex={-1} aria-hidden="true">
              <NewsImage src={image} />
            </Link>
            <div className={styles.topicBody}>
              <h3>
                <Link href={href}>{t.title}</Link>
              </h3>
              <p>
                <MediaIcon media={t.media} title={t.mediaTitle} size={12} />
                {t.mediaTitle}
                {updated && ` · 最後更新 ${taipeiDate(updated)}`}
                {t.coverage && ` · 近 3 天 ${t.coverage.count}${t.coverage.capped ? '+' : ''} 篇相關`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  // Preserve bookmarks to the former ranking homepage, including its sort state.
  const rankingParams = ['category', 'order', 'limit', 'sort', 'dir'];
  if (!query.q && rankingParams.some((key) => query[key] !== undefined)) {
    const params = new URLSearchParams();
    for (const key of rankingParams) {
      const value = query[key];
      if (value !== undefined) params.set(key, Array.isArray(value) ? value[0] : value);
    }
    permanentRedirect(`/ranking/?${params}`);
  }
  // The box used to filter this page's events; it now searches every article.
  const q = (Array.isArray(query.q) ? query.q[0] : (query.q ?? '')).trim().slice(0, 60);
  if (q) redirect(`/search/?${new URLSearchParams({ q })}`);
  const journalists = loadHomeJournalists();
  const graph = loadHomeGraph();
  const topics = loadHomeTopics();
  const data = await loadDemo();
  const [lead, ...rest] = data.stories;
  const ranking = data.ranking;
  const events = data.events?.events ?? [];
  const updated = data.events?.builtAt ?? ranking?.snapshot.computedAt;
  const date = updated
    ? new Date(updated).toLocaleDateString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      })
    : '台灣新聞，即時觀察';
  return (
    <div className={styles.home}>
      <a href="#news-main" className={styles.skip}>
        跳至新聞內容
      </a>
      <SiteHeader mastheadId="masthead" />
      <main id="news-main" className={styles.main}>
        <Masthead date={date} updated={updated ? `${taipei(updated)} 更新` : '等待資料更新'} />

        {data.events?.stale && <p className={styles.notice}>事件分群更新延遲，目前顯示最近一次的結果。</p>}

        <div className={styles.columns}>
          <aside className={styles.left} aria-label="關鍵字排行、記者與讀者關注">
            <div className={styles.sectionHeading}>
              <h2>關鍵字升溫榜</h2>
              <Link href="/ranking/?category=news">
                完整排行 <Arrow />
              </Link>
            </div>
            <HomeRanking initialRanking={ranking} />

            <div className={`${styles.sectionHeading} ${styles.sectionHeadingLater}`}>
              <h2>記者動態</h2>
              <Link href="/journalist/">
                全部記者 <Arrow />
              </Link>
            </div>
            <div className="min-h-72" data-vital-region="home-journalists">
              <Suspense fallback={<PanelLoading />}>
                <DeferredJournalists data={journalists} />
              </Suspense>
            </div>
            <div className="min-h-80" data-vital-region="home-readers">
              <Suspense fallback={<PanelLoading />}>
                <ReadersPanel />
              </Suspense>
            </div>
          </aside>

          <section className={styles.center} aria-label="焦點事件">
            <div className={styles.sectionHeading}>
              <h2>焦點事件</h2>
              <Link href="/event/">
                本小時全部 {events.length || ''} 件 <Arrow />
              </Link>
            </div>
            {lead ? (
              <>
                <article className={styles.hero} data-vital-region="home-hero">
                  <Link href={lead.href} className={styles.heroImage} tabIndex={-1} aria-hidden="true">
                    <NewsImage src={lead.image} priority />
                  </Link>
                  <div className={styles.heroContent}>
                    <span className={styles.heroBadge}>
                      焦點 01 {lead.tags.length > 0 && <span>／ {lead.tags.slice(0, 2).join(' · ')}</span>}
                    </span>
                    <h3>
                      <Link href={lead.href} className={styles.heroLink}>
                        {lead.title}
                      </Link>
                    </h3>
                    <StoryMeta story={lead} trail="h-6 w-20" />
                    <Distribution coverage={lead.coverage} />
                    {lead.coverage && (
                      <div className={styles.heroCamp}>
                        <CampBadge c={lead.coverage} />
                        <OutletStrip c={lead.coverage} media={data.media} />
                      </div>
                    )}
                    <div className={styles.heroFoot}>
                      <span>{!lead.coverage && `精選報導來自 ${lead.sampleOutlets} 家媒體`}</span>
                      <Link href={lead.href}>
                        比較各家標題 <Arrow />
                      </Link>
                    </div>
                  </div>
                </article>
                <div className={styles.legend}>
                  {DEMO_CAMPS.map((c) => (
                    <span key={c.key}>
                      <i className={styles[c.key]} />
                      {c.label}
                    </span>
                  ))}
                  <a href="#method">怎麼算 ⓘ</a>
                </div>
                <div className={styles.storyList}>
                  {rest.map((s, i) => (
                    <article key={s.key} className={styles.story}>
                      <div className={styles.storyBody}>
                        <p className={styles.storyTags}>
                          <span className={styles.storyIndex}>{String(i + 2).padStart(2, '0')}</span>
                          {s.tags.slice(0, 3).join(' / ')}
                        </p>
                        <h3>
                          <Link href={s.href}>{s.title}</Link>
                        </h3>
                        <StoryMeta story={s} />
                        <Distribution coverage={s.coverage} compact />
                      </div>
                      <Link href={s.href} className={styles.thumbnail} aria-label={`查看事件：${s.title}`} tabIndex={-1}>
                        <NewsImage src={s.image} />
                      </Link>
                    </article>
                  ))}
                  <Link href="/event/" className={styles.more}>
                    探索更多事件 <Arrow />
                  </Link>
                </div>
              </>
            ) : (
              <div className={styles.empty}>
                <span aria-hidden="true">◎</span>
                <h2>焦點事件載入中</h2>
                <EventRecovery />
                <Link href="/event/">
                  前往事件表 <Arrow />
                </Link>
              </div>
            )}
          </section>

          <aside className={styles.right} aria-label="藍綠溫差與標題對照">
            <div className={styles.sectionHeading}>
              <h2>藍綠溫差</h2>
              <Link href="/event/archive/">
                今天全部事件 <Arrow />
              </Link>
            </div>
            <CampGaps gaps={data.gaps} />

            <div className={`${styles.sectionHeading} ${styles.sectionHeadingLater}`}>
              <h2>同題不同標</h2>
            </div>
            <Suspense fallback={<p className={styles.notice}>正在整理標題對照…</p>}>
              <HeadlineSidebar query="" />
            </Suspense>
          </aside>
        </div>

        <div className={styles.band}>
          <section className={styles.panel} aria-label="新聞關係圖摘要">
            <div className={styles.sectionHeading}>
              <h2>新聞關係圖</h2>
              <Link href="/similarity/">
                看整張圖 <Arrow />
              </Link>
            </div>
            <div className="min-h-80" data-vital-region="home-graph">
              <Suspense fallback={<PanelLoading />}>
                <DeferredGraph data={graph} />
              </Suspense>
            </div>
          </section>
          <section className={styles.panel} aria-label="最近更新的議題">
            <div className={styles.sectionHeading}>
              <h2>最近更新的議題</h2>
              <Link href="/topic/">
                議題表 <Arrow />
              </Link>
            </div>
            <div className="min-h-80" data-vital-region="home-topics">
              <Suspense fallback={<PanelLoading />}>
                <DeferredTopics data={topics} />
              </Suspense>
            </div>
          </section>
        </div>

        <CampShareSummary initialShare={data.campShare}>
          <Suspense
            fallback={
              <p className={styles.notice} role="status">
                媒體清單載入中…
              </p>
            }
          >
            <CampOutletDirectory />
          </Suspense>
        </CampShareSummary>

        <SiteFooter
          notes={
            <>
              <Suspense fallback={<HomeMethod basisCount={ranking?.snapshot.basis.media.length} />}>
                <DeferredHomeMethod basisCount={ranking?.snapshot.basis.media.length} journalists={journalists} graph={graph} />
              </Suspense>
              <EventMethod page="table" />
              <MediaCardMethod />
            </>
          }
        />
      </main>
    </div>
  );
}
