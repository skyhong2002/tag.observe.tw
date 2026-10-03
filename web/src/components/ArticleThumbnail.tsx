'use client';

import Link from 'next/link';
import { useState } from 'react';
import { isAllowedImage } from '@/lib/images';
import SafeImage from './SafeImage';

export default function ArticleThumbnail({ src, href, title }: { src: string | null; href: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!isAllowedImage(src) || failed) return null;
  return (
    <Link href={href} tabIndex={-1} aria-label={`閱讀：${title}`} className="mt-1 block w-24 flex-none overflow-hidden rounded-md sm:w-40">
      <SafeImage
        src={src}
        alt=""
        width={320}
        height={220}
        sizes="(max-width: 640px) 96px, 160px"
        className="aspect-[16/11] w-full object-cover"
        onError={() => setFailed(true)}
      />
    </Link>
  );
}
