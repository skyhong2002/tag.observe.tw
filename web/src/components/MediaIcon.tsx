import { getImageProps } from 'next/image';
import { localMediaIcon, mediaIconClass } from '@/lib/media-icons';

// The single place that turns a media id into its mark. Logos live in
// web/public/favicons (manifest: app/data/favicon-local.json); outlets without
// a reviewed logo show their first character so rows stay aligned.
export default function MediaIcon({
  media,
  title,
  size = 14,
  rem = false,
  className = '',
}: {
  media: string;
  title?: string | null;
  size?: number;
  /** Size in rem (size / 16), for layouts that scale with the root font size. */
  rem?: boolean;
  className?: string;
}) {
  const src = localMediaIcon(media);
  const px = (n: number) => (rem ? `${n / 16}rem` : n);
  const box = { width: px(size), height: px(size) };
  if (src) {
    // Keep a plain server-renderable img while sizing the original outlet PNG
    // for its tiny display box. The shared optimizer supplies cached WebP.
    const { props } = getImageProps({ src, alt: '', width: size, height: size, loading: 'lazy', fetchPriority: 'low' });
    return (
      // biome-ignore lint/performance/noImgElement: getImageProps applies the Next image optimizer without a stateful Image component
      <img {...props} alt="" style={box} className={`shrink-0 rounded-sm object-contain ${mediaIconClass(media)} ${className}`} />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: px(Math.round(size * 0.65)) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-zinc-200 leading-none text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 ${className}`}
    >
      {(title || media).slice(0, 1)}
    </span>
  );
}
