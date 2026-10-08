'use client';

import { type ReactNode, useMemo, useState } from 'react';
import MediaIcon from '@/components/MediaIcon';
import { eventMediaColumns } from '@/lib/event-headline-picks.mts';
import type { CompareArticle, HeadlineCamp } from '@/lib/headline-compare.mts';
import type { GroupHeadlinePart } from '@/lib/headline-group.mts';
import styles from './headlines.module.css';

const labels: Record<HeadlineCamp, string> = { blue: '偏藍媒體', green: '偏綠媒體', other: '其他媒體' };
const columnOrder: Record<HeadlineCamp, number> = { blue: 0, other: 1, green: 2 };
const time = (iso: string) =>
  iso
    ? new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(iso))
    : '';

function HighlightedText({ parts }: { parts: GroupHeadlinePart[] }) {
  return parts.map((part, i) =>
    // biome-ignore lint/suspicious/noArrayIndexKey: Stateless text runs are regenerated together for each comparison.
    part.different ? <mark key={`${i}-${part.text}`}>{part.text}</mark> : part.text,
  );
}

function HeadlineRow({
  article,
  parts,
  highlight,
  children,
}: {
  article: CompareArticle;
  parts: GroupHeadlinePart[];
  highlight: boolean;
  children?: ReactNode;
}) {
  return (
    <li>
      <div className={styles.articleMeta}>
        <strong className={styles.mediaName}>
          <MediaIcon media={article.media} title={article.mediaTitle} size={18} />
          {article.mediaTitle}
        </strong>
        {article.publishedAt && <time dateTime={article.publishedAt}>{time(article.publishedAt)}</time>}
      </div>
      <p className={styles.headline}>
        <a href={article.url} target="_blank" rel="noopener noreferrer">
          {highlight ? <HighlightedText parts={parts} /> : article.title}
        </a>
      </p>
      {children}
    </li>
  );
}

export default function HeadlineComparison({ articles, focus }: { articles: CompareArticle[]; focus: string }) {
  const [highlight, setHighlight] = useState(true);
  const columns = useMemo(
    () => eventMediaColumns(articles, focus).sort((a, b) => columnOrder[a.camp] - columnOrder[b.camp]),
    [articles, focus],
  );
  const selected = columns.reduce((n, c) => n + c.media.length, 0);
  return (
    <section className={styles.compare} aria-labelledby="headlines-heading">
      <div className={styles.sectionHeading}>
        <h2 id="headlines-heading">
          各媒體標題 <span className={styles.count}>{selected} 家媒體 · 每家一則</span>
        </h2>
        <label className={styles.toggle}>
          <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
          Highlight 差異
        </label>
      </div>
      <div className={styles.columns}>
        {columns.map(({ camp, media }) => (
          <section key={camp} className={styles.column} data-camp={camp} aria-labelledby={`camp-${camp}`}>
            <header className={styles.campHeading}>
              <h3 id={`camp-${camp}`}>{labels[camp]}</h3>
              <span>{media.length} 家</span>
            </header>
            <ul className={styles.picks}>
              {media.map(({ media: id, lead, remaining }) => (
                <HeadlineRow key={id} article={lead.article} parts={lead.parts} highlight={highlight}>
                  {remaining.length > 0 && (
                    <details className={styles.additional}>
                      <summary>這家媒體的其他 {remaining.length} 則標題</summary>
                      <ul className={styles.headlines}>
                        {remaining.map(({ article, parts }) => (
                          <HeadlineRow key={article.id} article={article} parts={parts} highlight={highlight} />
                        ))}
                      </ul>
                    </details>
                  )}
                </HeadlineRow>
              ))}
            </ul>
            {!media.length && <p className={styles.emptyColumn}>目前沒有收錄這類媒體的標題。</p>}
          </section>
        ))}
      </div>
    </section>
  );
}
