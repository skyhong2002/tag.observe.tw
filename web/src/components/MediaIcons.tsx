import MediaHoverLink from '@/components/MediaHoverLink';
import type { MediaInfo } from '@/lib/api';
import catalog from '../../../app/data/media-catalog.json';
import styles from './MediaIcons.module.css';

export default function MediaIcons({ media, info }: { media: Record<string, number>; info: MediaInfo }) {
  const entries = Object.entries(media);
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {entries.map(([key, n]) => {
        const camp = catalog.categories.blue.includes(key) ? 'blue' : catalog.categories.green.includes(key) ? 'green' : 'other';
        return (
          <li key={key}>
            <MediaHoverLink
              media={key}
              title={info[key]?.title ?? key}
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
