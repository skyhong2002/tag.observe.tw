import MediaHoverLink from '@/components/MediaHoverLink';
import type { MediaInfo } from '@/lib/api';
import catalog from '../../../app/data/media-catalog.json';
import styles from './MediaIcons.module.css';

export default function MediaIcons({ media, info, max = 8 }: { media: Record<string, number>; info: MediaInfo; max?: number }) {
  const entries = Object.entries(media).slice(0, max);
  const rest = Object.keys(media).length - entries.length;
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
      {rest > 0 && <li className="text-[11px] text-zinc-500">+{rest}</li>}
    </ul>
  );
}
