import type { MediaInfo } from '@/lib/api';
import catalog from '../../../app/data/media-catalog.json';
import MediaIconsView, { type MediaBadge } from './MediaIconsView';

export default function MediaIcons({ media, info }: { media: Record<string, number>; info: MediaInfo }) {
  const entries: MediaBadge[] = Object.entries(media).map(([key, count]) => ({
    media: key,
    title: info[key]?.title ?? key,
    count,
    camp: catalog.categories.blue.includes(key) ? 'blue' : catalog.categories.green.includes(key) ? 'green' : 'other',
  }));
  return <MediaIconsView entries={entries} />;
}
