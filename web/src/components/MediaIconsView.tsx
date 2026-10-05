'use client';

import MediaHoverLink from '@/components/MediaHoverLink';
import styles from './MediaIcons.module.css';

export type MediaBadge = { media: string; title: string; count: number; camp: 'blue' | 'green' | 'other' };

/** Compact row data crosses the RSC boundary; markup is still rendered on the server. */
export default function MediaIconsView({ entries }: { entries: MediaBadge[] }) {
  return (
    <ul aria-label="媒體（可左右滑動）" className={`flex items-center gap-1.5 overflow-x-auto ${styles.list}`}>
      {entries.map(({ media: key, count: n, title, camp }) => {
        return (
          <li key={key} className="shrink-0">
            <MediaHoverLink
              media={key}
              title={title}
              className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] ${styles.badge} ${styles[camp]}`}
            >
              <span>
                {n}
                <span className="sr-only"> 篇</span>
              </span>
            </MediaHoverLink>
          </li>
        );
      })}
    </ul>
  );
}
