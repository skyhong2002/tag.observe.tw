import Link from 'next/link';
import { fetchObservation, KIND_LABELS, pageHref } from '@/lib/observation';
import styles from './home.module.css';

const MIN_ITEMS = 3;

/** 讀者關注: this site's most-read content pages over 7 days (GA4), hidden until there is a real list. */
export default async function ReadersPanel() {
  const data = await fetchObservation(7);
  const pages = data?.content.slice(0, 5) ?? [];
  if (pages.length < MIN_ITEMS) return null;
  return (
    <>
      <div className={`${styles.sectionHeading} ${styles.sectionHeadingLater}`}>
        <h2>讀者關注</h2>
        <Link href="/observe/#readers">
          網站觀測 <span aria-hidden="true">→</span>
        </Link>
      </div>
      <ol className={styles.ranking}>
        {pages.map((p, i) => (
          <li key={p.path}>
            <Link href={pageHref(p.path)}>
              <span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.rankBody}>
                <strong className={styles.readerTitle}>{p.title}</strong>
                <small>
                  {KIND_LABELS[p.kind]} · 近 7 天 {p.views.toLocaleString('zh-TW')} 次瀏覽
                </small>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
