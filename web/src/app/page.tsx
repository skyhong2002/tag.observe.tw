import Link from 'next/link';
import { permanentRedirect, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { CAMP_LABEL, CampBadge, FullBar, LeanText, SplitBar } from '@/components/CampBar';
import { eventHeadline, eventHref, Movement, OutletStrip, RankTrail } from '@/components/EventCard';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaIcon from '@/components/MediaIcon';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import Sparkline from '@/components/Sparkline';
import { type MediaInfo, type RankingEntry, taipei } from '@/lib/api';
import { type CampGap, type CampShare, DEMO_CAMPS, type DemoStory, type GraphSummary, type JournalistBrief, loadDemo } from '@/lib/demo';
import { isAllowedImage } from '@/lib/images';
import { journalistHref } from '@/lib/journalists';
import type { EventCoverage, EventItem, FeedTopic } from '@/lib/pages';
import CampOutletIcon from './_home/CampOutletIcon';
import CampOutlets from './_home/CampOutlets';
import HeadlineSidebar from './_home/HeadlineSidebar';
import styles from './_home/home.module.css';
import NewsImage from './_home/NewsImage';

export const revalidate = 120;
export const metadata = { alternates: { canonical: 'https://tag.observe.tw/' } };

function Arrow() {
  return <span aria-hidden="true">→</span>;
}

/** Whole percentages that still sum to 100 (largest remainders). */
function wholePercentages(counts: number[]): number[] {
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (!total) return counts.map(() => 0);
  const exact = counts.map((n) => (n / total) * 100);
  const percentages = exact.map(Math.floor);
  const remaining = 100 - percentages.reduce((sum, n) => sum + n, 0);
  exact
    .map((n, i) => ({ i, remainder: n - percentages[i] }))
    .sort((a, b) => b.remainder - a.remainder)
    .slice(0, remaining)
    .forEach(({ i }) => {
      percentages[i]++;
    });
  return percentages;
}

function CampShareBar({ share }: { share: CampShare }) {
  const camps = DEMO_CAMPS.map((c) => ({ ...c, count: share.camps.find((v) => v.camp === c.key)?.articles ?? 0 }));
  const percentages = wholePercentages(camps.map((c) => c.count));
  const description = camps.map((c, i) => `${c.label} ${percentages[i]}%（${c.count.toLocaleString()} 篇）`).join('、');
  return (
    <section className={styles.campShare} aria-label="過去 24 小時新聞量藍綠分布">
      <p className={styles.campShareLabel}>
        過去 24 小時新聞量
        <span>{share.articles.toLocaleString()} 篇</span>
      </p>
      <div className={styles.campShareChart}>
        <div className={styles.bar} role="img" aria-label={description} title={description}>
          {camps
            .filter((c) => c.count > 0)
            .map((c) => (
              <span key={c.key} className={styles[c.key]} style={{ flexGrow: c.count }}>
                <span className={styles.campShareText}>
                  <span>{c.label}</span>
                  <span>{percentages[camps.indexOf(c)]}%</span>
                </span>
              </span>
            ))}
        </div>
      </div>
      <a href="#method" className={styles.campShareMethod}>
        分類方式 ⓘ
      </a>
      {share.camps.some((c) => c.outlets.length > 0) && (
        <CampOutlets
          total={share.camps.reduce((n, c) => n + c.outlets.length, 0)}
          columns={DEMO_CAMPS.map(
            (c) => `minmax(128px, ${Math.max(1, share.camps.find((v) => v.camp === c.key)?.outlets.length ?? 0)}fr)`,
          ).join(' ')}
        >
          {DEMO_CAMPS.map((c) => {
            const outlets = share.camps.find((v) => v.camp === c.key)?.outlets ?? [];
            return (
              <div key={c.key} className={styles.campOutletGroup}>
                <p>
                  <i className={styles[c.key]} aria-hidden="true" />
                  {c.label} <span>{outlets.length} 家</span>
                </p>
                <ul>
                  {outlets.map((o) => (
                    <li key={o.media}>
                      <CampOutletIcon outlet={o} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </CampOutlets>
      )}
    </section>
  );
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
      <LeanText c={coverage} />
      <CampBadge c={coverage} />
    </div>
  );
}

function StoryMeta({ story }: { story: DemoStory }) {
  return (
    <p className={styles.source}>
      <span>標題來源：</span>
      <MediaHoverLink media={story.media} className="hover:underline">
        {story.source}
      </MediaHoverLink>
      {story.event.firstTime && <span>· {taipei(story.event.firstTime)} 上榜</span>}
    </p>
  );
}

/** Movement since the last hour and the day's rank trail, as on the event table. */
function Signals({ e, trail = 'h-5 w-16' }: { e: EventItem; trail?: string }) {
  return (
    <span className={styles.signals}>
      <span className={styles.signalRank}>第 {e.rank} 名</span>
      <Movement e={e} />
      <RankTrail e={e} className={trail} />
    </span>
  );
}

function RankChange({ e }: { e: RankingEntry }) {
  if (e.new) return <span className={styles.rankNew}>新</span>;
  if (e.rank24h === null || e.rank24h === e.rank) return <span className={styles.rankSame}>－</span>;
  const up = e.rank24h > e.rank;
  return (
    <span className={up ? styles.rankUp : styles.rankDown} title={`24 小時前第 ${e.rank24h} 名`}>
      {up ? '▲' : '▼'}
      {Math.abs(e.rank24h - e.rank)}
    </span>
  );
}

function CampGaps({ gaps }: { gaps: CampGap[] }) {
  if (gaps.every((g) => g.items.length === 0)) {
    return <p className={styles.notice}>本小時各事件的藍綠報導比例都在平常範圍內，沒有盲點。</p>;
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
            <p className={styles.muted}>本小時沒有。</p>
          ) : (
            <ol>
              {col.items.map((e) => {
                const href = eventHref(e) ?? `/event/#event-${e.rank}`;
                return (
                  <li key={e.rank}>
                    <Link href={href}>{eventHeadline(e)}</Link>
                    <p>
                      {e.coverage && <CampBadge c={e.coverage} />}
                      {e.coverage && <LeanText c={e.coverage} />}
                      <span>
                        {CAMP_LABEL.blue} {e.coverage?.camps.blue} 家 · {CAMP_LABEL.green} {e.coverage?.camps.green} 家
                      </span>
                    </p>
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
              {j.articles} 篇{j.similar.articles > 0 && <small title="內文與其他媒體相近的篇數">相近 {j.similar.articles}</small>}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

function GraphPanel({ graph, media }: { graph: GraphSummary | null; media: MediaInfo }) {
  if (!graph) return <p className={styles.notice}>相似度比對整理中。</p>;
  const label = (id: string, fallback: string) => media[id]?.title ?? fallback;
  return (
    <div className={styles.graphBody}>
      <div>
        <p className={styles.panelCaption}>內文與他家相近的比例</p>
        <ol className={styles.pairList}>
          {graph.similar.map((r) => (
            <li key={r.media} title={`${r.articles} 篇中有 ${r.matched} 篇與其他媒體內文相近`}>
              <span className={styles.shareRow}>
                <span className={styles.pairNames}>
                  <MediaHoverLink media={r.media} icon={14} className="hover:underline">
                    {label(r.media, r.name)}
                  </MediaHoverLink>
                  {r.partner && <small>多與{label(r.partner, r.partnerName ?? r.partner)}相近</small>}
                </span>
                <span className={styles.shareTrack} aria-hidden="true">
                  <span style={{ width: percent(r.share) }} />
                </span>
              </span>
              <span className={styles.pairCount}>{percent(r.share)}</span>
            </li>
          ))}
          {graph.similar.length === 0 && <li className={styles.muted}>目前沒有達到門檻的相近文章。</li>}
        </ol>
      </div>
      <div>
        <p className={styles.panelCaption}>被引用的占比</p>
        <ol className={styles.pairList}>
          {graph.cited.map((c) => (
            <li key={c.media} title={`${graph.citations} 筆引用中有 ${c.count} 筆`}>
              <span className={styles.shareRow}>
                <span className={styles.pairNames}>
                  <MediaHoverLink media={c.media} icon={14} className="hover:underline">
                    {label(c.media, c.name)}
                  </MediaHoverLink>
                </span>
                <span className={styles.shareTrack} aria-hidden="true">
                  <span style={{ width: percent(c.share) }} />
                </span>
              </span>
              <span className={styles.pairCount}>{percent(c.share)}</span>
            </li>
          ))}
          {graph.cited.length === 0 && <li className={styles.muted}>目前沒有明示引用的紀錄。</li>}
        </ol>
      </div>
      <p className={styles.panelFoot}>
        過去 {graph.hours} 小時比對 {graph.analyzed.toLocaleString()} 篇正文。左欄是各媒體自己的文章中，內文與其他媒體相近的比例（至少 20
        篇才列入）；右欄是 {graph.citations.toLocaleString()} 筆明示引用中，各來源所占比例。
      </p>
    </div>
  );
}

function TopicPanel({ topics }: { topics: { outlets: number; today: number; latest: FeedTopic[] } | null }) {
  if (!topics) return <p className={styles.notice}>議題資料整理中。</p>;
  if (topics.latest.length === 0) return <p className={styles.notice}>最近沒有新發現的專題。</p>;
  return (
    <ul className={styles.topicList}>
      {topics.latest.map((t) => {
        const image = isAllowedImage(t.image) ? t.image : null;
        const href = `/topic/${encodeURIComponent(t.media)}/#topic-${t.id}`;
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
                {t.time && ` · ${taipei(t.time)}`}
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
      <SiteHeader />
      <main id="news-main" className={styles.main}>
        <div className={styles.pageHeading}>
          <div>
            <div className={styles.titleRow}>
              <h1>新聞總覽</h1>
            </div>
            <p className={styles.edition}>
              {date} · {updated ? `${taipei(updated)} 更新` : '等待資料更新'}
            </p>
          </div>
        </div>

        {data.campShare && <CampShareBar share={data.campShare} />}

        {data.events?.stale && <p className={styles.notice}>事件分群更新延遲，目前顯示最近一次的結果。</p>}

        <div className={styles.columns}>
          <aside className={styles.left} aria-label="關鍵字排行與記者">
            <div className={styles.sectionHeading}>
              <h2>關鍵字升溫榜</h2>
              <Link href="/ranking/?category=news">
                完整排行 <Arrow />
              </Link>
            </div>
            {!ranking && <p className={styles.notice}>排行資料更新中</p>}
            <ol className={styles.ranking}>
              {ranking?.entries.slice(0, 8).map((e, i) => (
                <li key={e.tag}>
                  <Link href={`/tag/${encodeURIComponent(e.tag)}/`}>
                    <span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span>
                    <span className={styles.rankBody}>
                      <strong>
                        {e.tag} <RankChange e={e} />
                      </strong>
                      <small>
                        {Object.keys(e.media).length} 家媒體 · {e.count} 篇
                      </small>
                    </span>
                    <span className={styles.rankTrend}>
                      {e.trend && e.trend.length > 1 && <Sparkline values={e.trend.map((p) => p.average24h)} className="h-6 w-14" />}
                      <span className={styles.burst}>{e.burst === null ? '歷史不足' : `↗ ${e.burst.toFixed(1)}`}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>

            <div className={`${styles.sectionHeading} ${styles.sectionHeadingLater}`}>
              <h2>記者動態</h2>
              <Link href="/journalist/">
                全部記者 <Arrow />
              </Link>
            </div>
            <JournalistPanel brief={data.journalists} />
            <p className={styles.panelNote}>
              {data.journalists ? `過去 ${data.journalists.hours} 小時署名文章最多的記者。` : '以署名統計記者的發稿量與跨媒體相近情形。'}
            </p>
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
                <article className={styles.hero}>
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
                    <StoryMeta story={lead} />
                    <Signals e={lead.event} trail="h-6 w-20" />
                    <Distribution coverage={lead.coverage} />
                    {lead.coverage && (
                      <div className={styles.heroCamp}>
                        <span>
                          藍綠差 <LeanText c={lead.coverage} />
                        </span>
                        <CampBadge c={lead.coverage} />
                        <OutletStrip c={lead.coverage} media={data.media} max={12} />
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
                  <a href="#method">分布如何計算 ⓘ</a>
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
                        <Signals e={s.event} />
                        <Distribution coverage={s.coverage} compact />
                      </div>
                      <Link href={s.href} className={styles.thumbnail} aria-label={`查看事件：${s.title}`} tabIndex={-1}>
                        <NewsImage src={s.image} />
                      </Link>
                    </article>
                  ))}
                </div>
                <Link href="/event/" className={styles.more}>
                  探索更多事件 <Arrow />
                </Link>
              </>
            ) : (
              <div className={styles.empty}>
                <span aria-hidden="true">◎</span>
                <h2>新聞正在整理中</h2>
                <p>目前暫時無法取得事件資料，請稍後重新整理。</p>
                <Link href="/event/">
                  前往事件表 <Arrow />
                </Link>
              </div>
            )}
          </section>

          <aside className={styles.right} aria-label="藍綠溫差與標題對照">
            <div className={styles.sectionHeading}>
              <h2>藍綠溫差</h2>
              <Link href="/event/">
                事件表 <Arrow />
              </Link>
            </div>
            <p className={styles.gapIntro}>相對於過去 24 小時的整體比例，哪一邊的媒體特別在寫、哪一邊幾乎沒報。</p>
            <CampGaps gaps={data.gaps} />

            <div className={`${styles.sectionHeading} ${styles.sectionHeadingLater}`}>
              <h2>同題不同標</h2>
            </div>
            <p className={styles.gapIntro}>政治事件精選：同一件事，藍綠媒體怎麼下標？</p>
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
            <GraphPanel graph={data.graph} media={data.media} />
          </section>
          <section className={styles.panel} aria-label="最新專題">
            <div className={styles.sectionHeading}>
              <h2>媒體新專題</h2>
              <Link href="/topic/">
                議題表 <Arrow />
              </Link>
            </div>
            <TopicPanel topics={data.topics} />
          </section>
        </div>

        <SiteFooter
          notes={
            <>
              <p>首頁卡片的標籤僅顯示與該標題相符的關鍵字。</p>
              <p>
                藍綠分布以整個事件分群計算，並非單篇新聞的報導分布：數的是過去 24
                小時寫過該事件主要關鍵字的媒體家數。「藍綠差」是藍營家數占比減綠營家數占比；「盲點」表示其中一營幾乎沒有報導。
              </p>
              <p>
                頁首的新聞量分布為過去 24
                小時新聞類媒體有標籤的文章數，依媒體所屬陣營加總，並非逐篇判斷立場。展開後列出各段包含的媒體，淡色表示該媒體過去 24
                小時沒有文章。
              </p>
              {ranking && (
                <>
                  <p id="basis">
                    升溫榜與「{ranking.snapshot.basis.media.length}{' '}
                    家」篇數的媒體範圍：這是「新聞」類別中符合收錄條件的固定名單，並非預先設定家數，也不是依媒體品質或公信力評選。
                  </p>
                  <p>
                    本版名單選取已啟用、非僅供探索的來源：在名單凍結前至少 72 小時已成功取得非空新聞列表，且凍結前最近 3
                    小時內也有成功紀錄。固定同一批媒體，讓不同時間的議題熱度能在相同範圍內比較。當天未發稿的媒體仍保留，新來源待下一版基準再納入。
                  </p>
                  <p>篇數只計算這批媒體過去 24 小時已收錄的報導，不是全站總量；抓取失敗或補抓仍可能影響數字。</p>
                </>
              )}
              <p>新聞關係圖的「相近」以正文片段重疊度計算，門檻 0.65；「引用」為文中明示引用其他媒體的紀錄。</p>
            </>
          }
        />
      </main>
    </div>
  );
}
