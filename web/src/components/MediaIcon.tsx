import Image from 'next/image';
import { localMediaIcon, mediaIconClass } from '@/lib/media-icons';

// The single place that turns a media id into its mark. Logos live in
// web/public/favicons (manifest: app/data/favicon-local.json); outlets without
// a reviewed logo show their first character so rows stay aligned.
export default function MediaIcon({
  media,
  title,
  size = 14,
  className = '',
}: {
  media: string;
  title?: string | null;
  size?: number;
  className?: string;
}) {
  const src = localMediaIcon(media);
  const box = { width: size, height: size };
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        unoptimized
        loading="lazy"
        style={box}
        className={`shrink-0 rounded-sm object-contain ${mediaIconClass(media)} ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: Math.round(size * 0.65) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-zinc-200 leading-none text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 ${className}`}
    >
      {(title || media).slice(0, 1)}
    </span>
  );
}
