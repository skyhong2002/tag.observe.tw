import Link from 'next/link';
import MediaIcon from '@/components/MediaIcon';
import type { HomeTopicsSummary } from '@/lib/home-topics.mts';
import { isAllowedImage } from '@/lib/images';
import { updatedAtOf } from '@/lib/topic-update.mts';
import styles from './home.module.css';
import NewsImage from './NewsImage';

// Story dates can be old: date with the year, no time (as on TopicCard).
const taipeiDate = (iso: string) => new Date(iso).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });

export default function TopicPanel({
  topics,
  pending = false,
  onRetry,
}: {
  topics: HomeTopicsSummary | null;
  pending?: boolean;
  onRetry?: () => void;
}) {
  if (!topics)
    return (
      <p className={`${styles.notice} ${onRetry ? styles.topicRecoveryNotice : ''}`} role={pending ? 'status' : undefined}>
        {pending ? '正在重新取得議題…' : '議題資料暫時無法取得。'}
        {onRetry && (
          <button type="button" className={styles.rankingRetry} disabled={pending} onClick={onRetry}>
            重試
          </button>
        )}
        <Link prefetch={false} href="/topic/">
          查看議題表
        </Link>
      </p>
    );
  if (topics.latest.length === 0) return <p className={styles.notice}>最近沒有更新的議題。</p>;
  return (
    <ul className={styles.topicList}>
      {topics.latest.map((t) => {
        const image = isAllowedImage(t.image) ? t.image : null;
        const href = `/topic/${encodeURIComponent(t.media)}/#topic-${t.id}`;
        const updated = updatedAtOf(t);
        return (
          <li key={`${t.media}-${t.id}`}>
            <Link prefetch={false} href={href} className={styles.topicCover} tabIndex={-1} aria-hidden="true">
              <NewsImage src={image} variant="topic" />
            </Link>
            <div className={styles.topicBody}>
              <h3>
                <Link prefetch={false} href={href}>
                  {t.title}
                </Link>
              </h3>
              {/* Each piece wraps as a whole: the icon stays with its outlet and no count splits mid-word. */}
              <p>
                <span className={styles.topicMetaItem}>
                  <MediaIcon media={t.media} title={t.mediaTitle} size={12} />
                  {t.mediaTitle}
                </span>
                {updated && <span className={styles.topicMetaItem}>· 最後更新 {taipeiDate(updated)}</span>}
                {t.coverage && (
                  <span className={styles.topicMetaItem}>
                    · 近 3 天 {t.coverage.count}
                    {t.coverage.capped ? '+' : ''} 篇相關
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
