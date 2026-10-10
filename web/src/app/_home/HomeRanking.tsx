'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Sparkline from '@/components/Sparkline';
import type { Ranking, RankingEntry } from '@/lib/api';
import { fetchHomeRanking, rankingReady } from '@/lib/home-ranking.mts';
import styles from './home.module.css';

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

export default function HomeRanking({ initialRanking }: { initialRanking: Ranking | null }) {
  const [recovered, setRecovered] = useState<Ranking | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [pending, setPending] = useState(false);
  const ranking = rankingReady(initialRanking) ? initialRanking : recovered;

  useEffect(() => {
    if (ranking || attempt >= 3) return;
    let active = true;
    const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(
      async () => {
        setPending(true);
        deadline = setTimeout(() => controller.abort(), 8000);
        try {
          const result = await fetchHomeRanking(controller.signal);
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
  }, [ranking, attempt, retryKey]);

  if (!ranking)
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
  if (ranking.entries.length === 0) return <p className={styles.notice}>目前沒有可列出的熱門關鍵字。</p>;
  return (
    <ol className={styles.ranking}>
      {ranking.entries.slice(0, 8).map((e, i) => (
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
