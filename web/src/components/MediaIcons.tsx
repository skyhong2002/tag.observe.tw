import MediaIcon from '@/components/MediaIcon';
import type { MediaInfo } from '@/lib/api';

export default function MediaIcons({ media, info, max = 8 }: { media: Record<string, number>; info: MediaInfo; max?: number }) {
  const entries = Object.entries(media).slice(0, max);
  const rest = Object.keys(media).length - entries.length;
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {entries.map(([key, n]) => (
        <li
          key={key}
          title={`${info[key]?.title ?? key}：${n} 篇`}
          className="flex items-center gap-0.5 rounded bg-zinc-100 px-1 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          <MediaIcon media={key} title={info[key]?.title} />
          <span>{n}</span>
        </li>
      ))}
      {rest > 0 && <li className="text-[11px] text-zinc-500">+{rest}</li>}
    </ul>
  );
}
