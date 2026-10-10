import type { MediaInfo } from '@/lib/api';
import MediaIconsView, { type MediaBadge } from './MediaIconsView';

export default function MediaIcons({ media, info }: { media: Record<string, number>; info: MediaInfo }) {
  const entries: MediaBadge[] = Object.entries(media).map(([key, count]) => ({
    media: key,
    title: info[key]?.title ?? key,
    count,
    camp: info[key]?.camp ?? 'other',
  }));
  return <MediaIconsView entries={entries} />;
}
