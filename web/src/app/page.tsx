import Link from 'next/link';
import { permanentRedirect, redirect } from 'next/navigation';
import { type CSSProperties, Suspense } from 'react';
import MediaHoverLink from '@/components/MediaHoverLink';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { taipei } from '@/lib/api';
import { type CampShare, DEMO_CAMPS, type DemoCoverage, type DemoStory, loadDemo } from '@/lib/demo';
import CampOutletIcon from './_home/CampOutletIcon';
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
      <div className={styles.bar} role="img" aria-label={description} title={description}>
        {camps
          .filter((c) => c.count > 0)
          .map((c) => (
            <span key={c.key} className={styles[c.key]} style={{ flexGrow: c.count }}>
              <span>
                {c.label} {percentages[camps.indexOf(c)]}%
              </span>
            </span>
          ))}
      </div>
      <a href="#method" className={styles.campShareMethod}>
        分類方式 ⓘ
      </a>
      {share.camps.some((c) => c.outlets.length > 0) && (
        <div
          className={styles.campOutlets}
          style={
            {
              '--outlet-columns': DEMO_CAMPS.map(
                (c) => `minmax(128px, ${Math.max(1, share.camps.find((v) => v.camp === c.key)?.outlets.length ?? 0)}fr)`,
              ).join(' '),
            } as CSSProperties
          }
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
        </div>
      )}
    </section>
  );
}

function Distribution({ coverage, compact = false }: { coverage: DemoCoverage | null; compact?: boolean }) {
  if (!coverage?.outlets) return <span className={styles.muted}>報導分布暫無資料</span>;
  const camps = DEMO_CAMPS.map((c) => ({ ...c, count: coverage.camps.find((v) => v.camp === c.key)?.outlets ?? 0 }));
  const percentages = wholePercentages(camps.map((c) => c.count));
  const description = camps.map((c) => `${c.label} ${c.count} 家`).join('、');
  return (
    <div className={compact ? styles.compactDistribution : styles.distribution}>
      <div className={styles.bar} role="img" aria-label={`已收錄媒體分布：${description}`} title={description}>
        {camps
          .filter((c) => c.count > 0)
          .map((c) => (
            <span key={c.key} className={styles[c.key]} style={{ flexGrow: c.count }}>
              {!compact && (
                <span>
                  {c.short} {percentages[camps.indexOf(c)]}%
                </span>
              )}
            </span>
          ))}
      </div>
      {compact && (
        <span>
          {coverage.outlets} 家媒體 · {coverage.articles} 篇關聯報導
        </span>
      )}
    </div>
  );
}

function StoryMeta({ story }: { story: DemoStory }) {
  return (
    <p className={styles.source}>
      標題來源：
      <MediaHoverLink media={story.media} className="hover:underline">
        {story.source}
      </MediaHoverLink>
      {story.publishedAt && ` · ${taipei(story.publishedAt)}`}
    </p>
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
          <search className={styles.search}>
            <form action="/search/" className={styles.searchForm}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 5 5" />
              </svg>
              <input name="q" aria-label="搜尋所有新聞的標題、摘要與標籤" placeholder="搜尋新聞" maxLength={60} />
              <button type="submit" aria-label="搜尋">
                <Arrow />
              </button>
            </form>
          </search>
        </div>

        {data.campShare && <CampShareBar share={data.campShare} />}

        {data.events?.stale && <p className={styles.notice}>事件分群更新延遲，目前顯示最近一次的結果。</p>}

        <div className={styles.columns}>
          <aside className={styles.left} aria-label="收錄概況與關鍵字排行">
            <div className={styles.sectionHeading}>
              <h2>收錄概況</h2>
            </div>
            <div className={styles.brief}>
              <p className={styles.briefCount}>
                {ranking?.snapshot.articleCount?.toLocaleString() ?? '—'}
                <span>篇新聞</span>
              </p>
              <p className={styles.briefSub}>
                過去 24 小時 · {ranking ? `固定基準 ${ranking.snapshot.basis.media.length} 家新聞媒體` : '資料暫時無法取得'}
              </p>
              {ranking && (
                <details className={styles.basisNote}>
                  <summary>這 {ranking.snapshot.basis.media.length} 家媒體如何選定？</summary>
                  <p>這是「新聞」類別中符合收錄條件的固定名單，並非預先設定家數，也不是依媒體品質或公信力評選。</p>
                  <p>
                    本版名單選取已啟用、非僅供探索的來源：在名單凍結前至少 72 小時已成功取得非空新聞列表，且凍結前最近 3
                    小時內也有成功紀錄。
                  </p>
                  <p>固定同一批媒體，讓不同時間的議題熱度能在相同範圍內比較。當天未發稿的媒體仍保留，新來源待下一版基準再納入。</p>
                  <p>上方篇數只計算這批媒體過去 24 小時已收錄的報導，不是全站總量；抓取失敗或補抓仍可能影響數字。</p>
                </details>
              )}
              <Link href="/media/" className={styles.textLink}>
                查看媒體來源 <Arrow />
              </Link>
            </div>
            <div className={styles.rankingHeading}>
              <h2>議題升溫榜</h2>
            </div>
            {!ranking && <p className={styles.notice}>排行資料更新中</p>}
            <ol className={styles.ranking}>
              {ranking?.entries.slice(0, 8).map((e, i) => (
                <li key={e.tag}>
                  <Link href={`/tag/${encodeURIComponent(e.tag)}/`}>
                    <span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span>
                    <span className={styles.rankBody}>
                      <strong>{e.tag}</strong>
                      <small>
                        {Object.keys(e.media).length} 家媒體 · {e.count} 篇
                      </small>
                    </span>
                    <span className={styles.burst}>{e.burst === null ? '歷史不足' : `↗ ${e.burst.toFixed(1)}`}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <Link href="/ranking/?category=news" className={styles.outlineLink}>
              完整關鍵字排行 <Arrow />
            </Link>
          </aside>

          <section className={styles.center} aria-label="焦點事件">
            <div className={styles.sectionHeading}>
              <h2>焦點事件</h2>
            </div>
            {lead ? (
              <>
                <article className={styles.hero}>
                  <Link href={lead.href} className={styles.heroLink}>
                    <div className={styles.heroImage}>
                      <NewsImage src={lead.image} priority />
                    </div>
                    <div className={styles.heroContent}>
                      <span className={styles.heroBadge}>
                        焦點 01 {lead.tags.length > 0 && <span>／ {lead.tags.slice(0, 2).join(' · ')}</span>}
                      </span>
                      <h3>{lead.title}</h3>
                      <StoryMeta story={lead} />
                      <Distribution coverage={lead.coverage} />
                      <div className={styles.heroFoot}>
                        <span>
                          {lead.coverage
                            ? `${lead.coverage.outlets} 家媒體 · ${lead.coverage.articles} 篇關聯報導`
                            : `精選報導來自 ${lead.sampleOutlets} 家媒體`}
                        </span>
                        <span>
                          比較各家標題 <Arrow />
                        </span>
                      </div>
                    </div>
                  </Link>
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
                  {rest.map((s) => (
                    <article key={s.key} className={styles.story}>
                      <div className={styles.storyBody}>
                        {s.tags.length > 0 && <p className={styles.storyTags}>{s.tags.slice(0, 3).join(' / ')}</p>}
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

          <aside className={styles.right} aria-label="政治事件標題對照">
            <div className={styles.gapHeading}>
              <h2>同題不同標</h2>
            </div>
            <p className={styles.gapIntro}>政治事件精選：同一件事，藍綠媒體怎麼下標？</p>
            <Suspense fallback={<p className={styles.notice}>正在整理標題對照…</p>}>
              <HeadlineSidebar query="" />
            </Suspense>
          </aside>
        </div>

        <SiteFooter
          notes={
            <>
              <p>首頁卡片的標籤僅顯示與該標題相符的關鍵字。</p>
              <p>
                藍綠分布以整個議題分群計算，並非單篇新聞的報導分布。每個分群最多取 400
                筆關聯報導，並非完整報導量，可能包含不同子事件或抓取缺漏。
              </p>
              <p>
                頁首的新聞量分布為過去 24
                小時新聞類媒體有標籤的文章數，依媒體所屬陣營加總，並非逐篇判斷立場。下方圖示列出各段包含的媒體，淡色表示該媒體過去 24
                小時沒有文章。
              </p>
            </>
          }
        />
      </main>
    </div>
  );
}
