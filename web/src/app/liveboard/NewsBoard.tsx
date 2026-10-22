'use client';

import { useEffect, useState } from 'react';
import Wordmark from '@/components/Wordmark';
import type { MediaInfo } from '@/lib/api';
import type { LiveArticle } from '@/lib/liveboard.mts';
import { createFeedPoller } from '@/lib/liveboard-poll.mts';
import {
  asNewsCard,
  type BoardEvents,
  type BoardFeed,
  FOLLOW_LIMIT,
  FOLLOW_STORAGE,
  type NewsCard,
  readArticles,
  readEvents,
  readFeed,
  readFollows,
  selectNews,
  stableCards,
} from '@/lib/liveboard-view.mts';
import { articleHref } from '@/lib/reading.mts';
import styles from './news-board.module.css';

const time = (iso: string | null) =>
  iso && Number.isFinite(Date.parse(iso))
    ? new Date(iso).toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '時間待確認';
const tagHref = (tag: string) => `/tag/${encodeURIComponent(tag)}/`;

/** One request chain per resource; late responses cannot update an unmounted or paused view. */
function useRefresh<T>(path: string, initial: T | null, parse: (value: unknown) => T | null, paused: boolean, every = 30_000) {
  const [value, setValue] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [checked, setChecked] = useState<string | null>(null);
  useEffect(() => {
    if (paused) return;
    let stopped = false;
    const poller = createFeedPoller<T>({ connection: () => {} });
    const refresh = async () => {
      if (document.hidden) return;
      const result = await poller.poll(async () => {
        const res = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        return parse(await res.json());
      });
      if (stopped) return;
      // Overlapping refreshes return null as well: the timer cannot overlap the
      // bounded 17-second retry, and visibility refreshes use the guard below.
      setFailed(result === null);
      if (result !== null) {
        setValue(result);
        setChecked(new Date().toISOString());
      }
    };
    let busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        await refresh();
      } finally {
        busy = false;
      }
    };
    void run();
    const timer = setInterval(() => void run(), every);
    document.addEventListener('visibilitychange', run);
    return () => {
      stopped = true;
      poller.stop();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
    };
  }, [path, parse, paused, every]);
  return { value, failed, checked };
}

function Open({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={className}>
      {children}
    </a>
  );
}

function Headline({ card, main = false }: { card: NewsCard; main?: boolean }) {
  return (
    <article className={main ? styles.card : styles.headline} data-news-key={card.key}>
      <p className={styles.meta}>
        <span className={styles.source}>{card.media || '來源未提供'}</span>
        <span>
          {' '}
          · {card.timeLabel} {time(card.at)}
        </span>
      </p>
      <h3>
        <Open href={card.href}>{card.title}</Open>
      </h3>
      {main && (
        <div className={styles.tags}>
          {card.tags.slice(0, 3).map((tag) => (
            <Open key={tag} href={tagHref(tag)}>
              #{tag}
            </Open>
          ))}
        </div>
      )}
    </article>
  );
}

const readTagArticles = (value: unknown) => readArticles((value as { articles?: unknown } | null)?.articles);
function FollowedTag({ tag, paused, remove }: { tag: string; paused: boolean; remove: () => void }) {
  const data = useRefresh(`/api/v1/tags/${encodeURIComponent(tag)}/articles?hours=24&limit=8`, null, readTagArticles, paused);
  const [cards, setCards] = useState<NewsCard[]>([]);
  useEffect(() => {
    if (data.value) setCards((previous) => (data.value?.length ? stableCards(previous, data.value.slice(0, 3).map(asNewsCard)) : []));
  }, [data.value]);
  return (
    <section className={styles.followed} aria-label={`追蹤 ${tag}`}>
      <div className={styles.row}>
        <h3>
          <Open href={tagHref(tag)}>#{tag}</Open>
        </h3>
        <button type="button" onClick={remove} aria-label={`取消追蹤 ${tag}`}>
          移除
        </button>
      </div>
      <p className={styles.meta} role="status">
        {data.failed ? '暫時無法更新，保留已取得的新聞' : data.checked ? `近 24 小時 · 已檢查 ${time(data.checked)}` : '正在取得最新動態…'}
      </p>
      {cards.map((card) => (
        <Headline key={card.key} card={card} />
      ))}
      {data.value?.length === 0 && <p className={styles.empty}>近 24 小時沒有符合這個 Tag 的新聞。</p>}
      <Open className={styles.context} href={tagHref(tag)}>
        查看全部相關新聞 ↗
      </Open>
    </section>
  );
}

function Tracking({ paused }: { paused: boolean }) {
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [storageNote, setStorageNote] = useState('');
  useEffect(() => {
    const restore = () => {
      try {
        setTags(readFollows(JSON.parse(localStorage.getItem(FOLLOW_STORAGE) ?? '[]')));
      } catch {
        setStorageNote('無法讀取儲存設定；仍可在本頁追蹤。');
      }
    };
    restore();
    const sync = (event: StorageEvent) => {
      if (event.key === FOLLOW_STORAGE) restore();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const save = (next: string[]) => {
    setTags(next);
    try {
      localStorage.setItem(FOLLOW_STORAGE, JSON.stringify(next));
    } catch {
      setStorageNote('瀏覽器無法儲存；本次追蹤只保留到關閉頁面。');
    }
  };
  return (
    <aside className={styles.tracking} aria-labelledby="tracking-heading">
      <h2 id="tracking-heading">我的 Tag 追蹤</h2>
      <p className={styles.meta}>人物、地名或議題，最多 {FOLLOW_LIMIT} 個。設定儲存在這個瀏覽器。</p>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          const tag = draft.trim();
          if (tag && tags.length < FOLLOW_LIMIT) {
            save(readFollows([...tags, tag]));
            setDraft('');
          }
        }}
      >
        <label htmlFor="follow-tag">追蹤人物或 Tag</label>
        <div className={styles.row}>
          <input
            id="follow-tag"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={60}
            placeholder="例如：沈伯洋"
            disabled={tags.length >= FOLLOW_LIMIT}
          />
          <button type="submit" disabled={!draft.trim() || tags.length >= FOLLOW_LIMIT}>
            追蹤
          </button>
        </div>
      </form>
      {storageNote && (
        <p role="status" className={styles.meta}>
          {storageNote}
        </p>
      )}
      {!tags.length && <p className={styles.empty}>加入關注的 Tag，這裡會持續顯示相關新聞，不受主要新聞排序影響。</p>}
      {tags.map((tag) => (
        <FollowedTag key={tag} tag={tag} paused={paused} remove={() => save(tags.filter((t) => t !== tag))} />
      ))}
    </aside>
  );
}

function ArticlePreview({ article }: { article: LiveArticle }) {
  return (
    <div>
      <Headline card={asNewsCard(article)} />
      <p className={styles.excerpt}>{article.text?.slice(0, 240) || '內文尚未取得，可開啟新聞頁查看來源。'}</p>
    </div>
  );
}

function Advanced({ feed, events, media }: { feed: BoardFeed | null; events: BoardEvents | null; media: MediaInfo }) {
  return (
    <div className={styles.analysis}>
      <section aria-labelledby="similar-heading">
        <div className={styles.row}>
          <h2 id="similar-heading">內文相似新聞</h2>
          <Open href="/similarity/">完整關係圖 ↗</Open>
        </div>
        <p className={styles.meta}>相似內容不等於抄襲或轉載；來源與署名請以完整新聞頁為準。</p>
        {!feed?.stories.length && <p className={styles.empty}>目前沒有可顯示的相似新聞，稍後自動更新。</p>}
        {feed?.stories.slice(0, 6).map((story) => (
          <details key={story.key} className={styles.detail}>
            <summary>
              {story.lead.title}
              <span className={styles.meta}>
                {' '}
                · {story.followers.length + story.more} 篇相關報導 · 比對 {time(story.computedAt)}
              </span>
            </summary>
            <ArticlePreview article={story.lead} />
            {story.followers.map((f) => (
              <div key={f.article.id} className={styles.comparison}>
                <p className={styles.meta}>
                  {f.direct ? `與上方報導內文相似 ${Math.round(f.score * 100)}%` : '經其他報導間接關聯，非與上方報導直接比對'}
                </p>
                <ArticlePreview article={f.article} />
              </div>
            ))}
            {story.more > 0 && <Open href={articleHref(story.lead)}>完整新聞與相關報導 ↗</Open>}
          </details>
        ))}
      </section>
      <section aria-labelledby="topics-heading">
        <div className={styles.row}>
          <h2 id="topics-heading">議題新進新聞</h2>
          <Open href="/topic/">全部議題 ↗</Open>
        </div>
        {!feed?.topics.length && <p className={styles.empty}>目前沒有新的議題更新，稍後自動檢查。</p>}
        {feed?.topics.slice(0, 6).map((topic) => {
          const href = `/${topic.kind === 'feature' ? 'feature' : 'topic'}/${encodeURIComponent(topic.media)}/${topic.id}/`;
          return (
            <div className={styles.detail} key={topic.id}>
              <p className={styles.meta}>
                {topic.mediaTitle} · {topic.isNew ? '新收錄' : '更新'} {time(topic.at)}
              </p>
              <h3>
                <Open href={href}>{topic.title}</Open>
              </h3>
              <ul>
                {topic.stories.slice(0, 3).map((story) => (
                  <li key={story.url ?? story.title}>
                    <Open href={story.article ? articleHref(story.article) : href}>{story.title}</Open>
                    {!story.article && <span className={styles.meta}> · 內文待收錄</span>}
                  </li>
                ))}
              </ul>
              {!topic.stories.length && <p className={styles.meta}>尚無可列出的新增新聞，請開啟議題頁查看。</p>}
            </div>
          );
        })}
      </section>
      <section aria-labelledby="coverage-heading">
        <div className={styles.row}>
          <h2 id="coverage-heading">事件延續與各家標題</h2>
          <Open href="/event/">全部事件 ↗</Open>
        </div>
        <p className={styles.meta}>並列現有事件中的代表報導；完整媒體覆蓋與時間線請開啟事件脈絡。</p>
        {!events?.events.length && <p className={styles.empty}>事件資料暫未取得，稍後自動更新。</p>}
        {events?.events.slice(0, 6).map((event) => (
          <details className={styles.detail} key={event.relatedEventPk ?? event.major.join('|')}>
            <summary>
              {event.major.join('、') || '事件報導'} · {new Set(event.news.map((n) => n.media)).size} 家代表媒體
            </summary>
            <ul>
              {event.news.map((article) => (
                <li key={article.id ?? article.url}>
                  <span className={styles.meta}>{media[article.media]?.title ?? article.media} · </span>
                  <Open href={articleHref(article)}>{article.title}</Open>
                </li>
              ))}
            </ul>
            {event.relatedEventPk && <Open href={`/eve/${event.relatedEventPk}/`}>事件脈絡、完整媒體覆蓋與新增報導 ↗</Open>}
          </details>
        ))}
      </section>
      <details className={styles.diagnostics}>
        <summary>更新紀錄與爬蟲狀態（需要時展開）</summary>
        <p className={styles.meta}>
          新聞資料 {time(feed?.generatedAt ?? null)} · 事件快照 {time(events?.builtAt ?? events?.hour ?? null)}
        </p>
        <ul>
          {feed?.activity.crawls.slice(0, 12).map((c) => (
            <li key={`${c.media}:${c.stage}:${c.at}`}>
              {c.mediaTitle} · {c.stage} · {c.failed ? '本次失敗' : c.running ? '處理中' : `新增 ${c.inserted} 篇`} · {time(c.at)}
            </li>
          ))}
        </ul>
        <Open href="/crawlers/">完整爬蟲狀態 ↗</Open>
      </details>
    </div>
  );
}

export default function NewsBoard({
  initialFeed,
  initialEvents,
  media,
  advanced = false,
}: {
  initialFeed: BoardFeed | null;
  initialEvents: BoardEvents | null;
  media: MediaInfo;
  advanced?: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const feed = useRefresh('/api/v1/liveboard', initialFeed, readFeed, paused);
  const events = useRefresh('/api/v1/events?limit=12', initialEvents, readEvents, paused, 180_000);
  const [shown, setShown] = useState(() => ({
    feed: initialFeed,
    events: initialEvents,
    ...selectNews(initialEvents, initialFeed, media),
  }));
  useEffect(() => {
    setShown((previous) => {
      // Empty snapshots keep the last readable content; the status explains this.
      const nextFeed = feed.value
        ? {
            ...feed.value,
            articles: feed.value.articles.length ? feed.value.articles : (previous.feed?.articles ?? []),
            stories: feed.value.stories.length ? feed.value.stories : (previous.feed?.stories ?? []),
            topics: feed.value.topics.length ? feed.value.topics : (previous.feed?.topics ?? []),
          }
        : previous.feed;
      const nextEvents = events.value?.events.length ? events.value : previous.events;
      const next = selectNews(nextEvents, nextFeed, media);
      return {
        feed: nextFeed,
        events: nextEvents,
        main: stableCards(previous.main, next.main),
        latest: stableCards(previous.latest, next.latest, false),
      };
    });
  }, [feed.value, events.value, media]);
  const shownFeed = shown.feed;
  const shownEvents = shown.events;
  const cards = shown;
  const quiet = feed.value?.articles.length === 0;
  return (
    <main className={styles.board}>
      <header className={styles.header}>
        <a href="/" aria-label="新文易數首頁">
          <Wordmark className={styles.wordmark} />
        </a>
        <nav aria-label="看板模式">
          <a href="/liveboard/" aria-current={!advanced ? 'page' : undefined}>
            一般看板
          </a>
          <a href="/liveboard/advanced/" aria-current={advanced ? 'page' : undefined}>
            Advanced 進階
          </a>
        </nav>
        <button type="button" onClick={() => setPaused((v) => !v)} aria-pressed={paused}>
          {paused ? '恢復更新' : '暫停更新'}
        </button>
      </header>
      <div className={styles.intro}>
        <h1>{advanced ? 'Advanced 新聞脈絡' : '現在值得注意的新聞'}</h1>
        <p>{advanced ? '展開感興趣的內容，對照相似內文、議題更新與各家報導。' : '主要事件，一眼掌握。開啟新聞後，看板會繼續更新。'}</p>
      </div>
      <p className={styles.status} role="status">
        {paused
          ? '已暫停更新，保留目前畫面。'
          : feed.failed
            ? '新聞更新暫時失敗，保留既有內容並自動重試。'
            : !feed.value
              ? '尚未取得新聞，正在重試。'
              : quiet
                ? '暫無新進新聞，保留最近內容並持續檢查。'
                : '每 30 秒檢查新進新聞。'}{' '}
        {feed.checked ? `最近檢查 ${time(feed.checked)}` : `新聞資料 ${time(shownFeed?.generatedAt ?? null)}`}
        {(events.failed || !events.value || events.value.stale || !events.value.events.length) && (
          <span> · 事件資料暫未更新，保留已取得的內容。</span>
        )}
      </p>
      <div className={styles.layout}>
        {advanced ? (
          <Advanced feed={shownFeed} events={shownEvents} media={media} />
        ) : (
          <div>
            <section aria-labelledby="main-heading">
              <h2 id="main-heading">主要新聞</h2>
              <div className={styles.grid}>
                {cards.main.map((card) => (
                  <Headline key={card.key} card={card} main />
                ))}
              </div>
              {!cards.main.length && (
                <p className={styles.empty}>尚無可顯示的主要新聞。取得資料後會自動出現在這裡；你也可以先加入關注的 Tag。</p>
              )}
            </section>
            <section className={styles.latest} aria-labelledby="latest-heading">
              <h2 id="latest-heading">最新收錄</h2>
              {cards.latest.map((card) => (
                <Headline key={card.key} card={card} />
              ))}
              {!cards.latest.length && <p className={styles.meta}>目前沒有其他新進新聞。</p>}
            </section>
            <details className={styles.selection}>
              <summary>主要新聞如何挑選</summary>
              <p>
                優先依本站現有事件排名，每個事件選一則代表標題，最多六則；不足時以最新收錄新聞補足。同一事件已列出的報導、相同標題及已知內文相似群組只保留一則。既有新聞保留原位置，新事件替換空出的格位。未完成分析的新聞仍可能屬於同一事件。
              </p>
              <p>
                事件約每三分鐘檢查，新聞每三十秒檢查；時間不明會明示。沒有新資料或更新失敗時保留最近內容。瀏覽器在背景時暫停檢查，回到前景立即更新。
              </p>
            </details>
          </div>
        )}
        <Tracking paused={paused} />
      </div>
    </main>
  );
}
