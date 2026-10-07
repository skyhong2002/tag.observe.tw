'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type CampShare, fetchCampShare, wholePercentages } from '@/lib/camp-share.mts';
import styles from './home.module.css';

const CAMPS = [
  { key: 'green', label: '綠營傾向' },
  { key: 'other', label: '其他' },
  { key: 'blue', label: '藍營傾向' },
] as const;

export default function CampShareSummary({ initialShare }: { initialShare: CampShare | null }) {
  const [recovered, setRecovered] = useState<CampShare | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [pending, setPending] = useState(false);
  const share = initialShare ?? recovered;

  useEffect(() => {
    if (share || attempt >= 3) return;
    let active = true;
    const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(
      async () => {
        setPending(true);
        deadline = setTimeout(() => controller.abort(), 8000);
        try {
          const result = await fetchCampShare(controller.signal);
          if (active) setRecovered(result);
        } catch {
          if (active) setAttempt((value) => value + 1);
        } finally {
          clearTimeout(deadline);
          if (active) setPending(false);
        }
      },
      retryKey > 0 && attempt === 0 ? 0 : 3000 * 2 ** attempt,
    );
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(deadline);
      controller.abort();
    };
  }, [share, attempt, retryKey]);

  const camps = CAMPS.map((c) => ({ ...c, count: share?.camps.find((v) => v.camp === c.key)?.articles ?? 0 }));
  const percentages = wholePercentages(camps.map((c) => c.count));
  const description = share
    ? camps.map((c, i) => `${c.label} ${percentages[i]}%（${c.count.toLocaleString()} 篇）`).join('、')
    : '新聞量分布暫時無法取得';
  return (
    <section className={styles.campShare} aria-label="過去 24 小時新聞量藍綠分布">
      <p className={styles.campShareLabel}>
        過去 24 小時新聞量
        <span>{share ? `${share.articles.toLocaleString()} 篇` : '待更新'}</span>
      </p>
      <div className={styles.campShareChart}>
        {share ? (
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
        ) : (
          <div className={styles.campShareUnavailable}>
            {CAMPS.map((c) => (
              <span key={c.key}>
                <i className={styles[c.key]} aria-hidden="true" />
                {c.label} —
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.campShareLinks}>
        <Link href="/media/">媒體分類</Link>
        <a href="#method">怎麼算 ⓘ</a>
      </div>
      {!share && (
        <div className={styles.campShareStatus}>
          <p role="status">{pending || attempt < 3 ? '新聞量分布暫時無法取得，正在自動重試…' : '新聞量分布暫時無法取得，請稍後再試。'}</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setAttempt(0);
              setRetryKey((value) => value + 1);
            }}
          >
            {pending ? '載入中…' : '重新載入'}
          </button>
        </div>
      )}
    </section>
  );
}
