'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Sparkline from '@/components/Sparkline';
import { fetchHomeRanking, type HomeRankingRow, homeRankingRows } from '@/lib/home-ranking.mts';
import styles from './home.module.css';

function RankChange({ e }: { e: HomeRankingRow }) {
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

/** `initialRows` is null when the server render could not get a ready snapshot; the panel then retries on its own. */
export default function HomeRanking({ initialRows }: { initialRows: HomeRankingRow[] | null }) {
  const [recovered, setRecovered] = useState<HomeRankingRow[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [pending, setPending] = useState(false);
  const rows = initialRows ?? recovered;

  useEffect(() => {
    if (rows || attempt >= 3) return;
    let active = true;
    const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(
      async () => {
        setPending(true);
        deadline = setTimeout(() => controller.abort(), 8000);
        try {
          const result = await fetchHomeRanking(controller.signal);
          if (active) setRecovered(homeRankingRows(result));
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
  }, [rows, attempt, retryKey]);

  if (!rows)
    return (
      <div className={styles.notice}>
        <p role="status">{pending || attempt < 3 ? '排行暫時無法取得，正在自動重試…' : '排行暫時無法取得，請稍後再試。'}</p>
        <button
          className={styles.rankingRetry}
          type="button"
          disabled={pending}
          onClick={() => {
            setAttempt(0);
            setRetryKey((value) => value + 1);
          }}
        >
          {pending ? '載入中…' : '重新載入排行'}
        </button>
      </div>
    );
  if (rows.length === 0) return <p className={styles.notice}>目前沒有可列出的熱門關鍵字。</p>;
  return (
    <ol className={styles.ranking}>
      {rows.map((e, i) => (
        <li key={e.tag}>
          <Link prefetch={false} href={`/tag/${encodeURIComponent(e.tag)}/`}>
            <span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span>
            <span className={styles.rankBody}>
              <strong>
                {e.tag} <RankChange e={e} />
              </strong>
              <small>
                {e.mediaCount} 家媒體 · {e.count} 篇
              </small>
            </span>
            <span className={styles.rankTrend}>
              {e.trend.length > 1 && <Sparkline values={e.trend} className="h-6 w-14" />}
              <span className={styles.burst} title="分數">
                {e.normalized.toFixed(1)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
