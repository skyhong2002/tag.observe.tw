'use client';

import { useState } from 'react';
import { isAllowedImage } from '@/lib/images';
import SafeImage from './SafeImage';
import SourceLink from './SourceLink';

export default function ArticleImage({
  src,
  title,
  mediaTitle,
  sourceUrl,
}: {
  src: string | null;
  title: string;
  mediaTitle: string;
  sourceUrl?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!isAllowedImage(src) || failedSrc === src) return null;

  return (
    <figure className="mb-8">
      <SafeImage
        src={src}
        alt={`${title}（新聞配圖）`}
        width={1200}
        height={800}
        sizes="(max-width: 736px) calc(100vw - 32px), 704px"
        loading="eager"
        className="h-auto w-full rounded-lg"
        onError={() => setFailedSrc(src)}
      />
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>配圖來源：{mediaTitle}</span>
        {sourceUrl && <SourceLink url={sourceUrl} label="原站文章" />}
      </figcaption>
    </figure>
  );
}
