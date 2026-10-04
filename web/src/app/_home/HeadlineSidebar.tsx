import Link from 'next/link';
import MediaHoverLink from '@/components/MediaHoverLink';
import SourceLink from '@/components/SourceLink';
import { taipei } from '@/lib/api';
import { loadComparisons } from '@/lib/compare-data';
import { headlineDiff } from '@/lib/headline-compare.mts';
import { articleHref } from '@/lib/reading.mts';
import styles from './home.module.css';

export default async function HeadlineSidebar({ query }: { query: string }) {
  const data = await loadComparisons(false, 'outlets');
  const search = query.toLocaleLowerCase('zh-TW');
  const events = data.events
    .filter(
      (event) =>
        event.pair &&
        (!search ||
          [event.label, event.seedTitle, ...event.articles.map((a) => a.title)].join(' ').toLocaleLowerCase('zh-TW').includes(search)),
    )
    .slice(0, 3);
  return (
    <>
      {(data.stale || data.failed > 0) && (
        <p className={styles.notice}>{data.stale ? '事件更新延遲，顯示最近一次的對照。' : '部分來源暫時無法取得，顯示已載入的對照。'}</p>
      )}
      <div className={styles.headlineList}>
        {events.map((event) => {
          const pair = event.pair!.map((id) => event.articles.find((article) => article.id === id)!);
          const parts = headlineDiff(pair[0].title, pair[1].title);
          return (
            <article key={event.id} className={styles.headlineCard}>
              <h3>{event.label}</h3>
              {pair.map((article, index) => (
                <div key={article.id} className={styles.headlineSource}>
                  <div className={styles.headlineByline}>
                    <span>
                      <MediaHoverLink media={article.media} icon={12} className="hover:underline">
                        {article.mediaTitle}
                      </MediaHoverLink>
                    </span>
                    <time dateTime={article.publishedAt}>{taipei(article.publishedAt)}</time>
                  </div>
                  <Link href={articleHref(article)} className={styles.comparedTitle}>
                    {parts[index].map((part, position) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: These stateless text runs are rendered together from a single immutable headline.
                      <span key={position} className={part.different ? styles.differentWords : undefined}>
                        {part.text}
                      </span>
                    ))}
                  </Link>
                  <SourceLink url={article.url} className="ml-2" />
                </div>
              ))}
              <Link href={`/eve/${encodeURIComponent(event.id)}/`} className={styles.headlineMore}>
                查看各家報導 <span aria-hidden="true">→</span>
              </Link>
            </article>
          );
        })}
      </div>
      {!events.length && (
        <p className={styles.notice}>
          {data.unavailable || data.failed
            ? '標題對照暫時無法取得，請稍後再試。'
            : query
              ? '目前沒有符合搜尋的標題對照。'
              : '目前沒有足夠的跨媒體相近報導可供對照。'}
        </p>
      )}
    </>
  );
}
