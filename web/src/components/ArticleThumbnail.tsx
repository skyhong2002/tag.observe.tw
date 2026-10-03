'use client';

import Link from 'next/link';
import { useState } from 'react';
import { isAllowedImage } from '@/lib/images';
import SafeImage from './SafeImage';

export default function ArticleThumbnail({ src, href, title }: { src: string | null; href: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!isAllowedImage(src) || failed) return null;
  return (
    <Link href={href} tabIndex={-1} aria-label={`閱讀：${title}`} className="mt-0.5 block w-16 flex-none overflow-hidden rounded sm:w-20">
      <SafeImage
        src={src}
        alt=""
        width={320}
        height={220}
        sizes="(max-width: 640px) 64px, 80px"
        className="aspect-[16/11] w-full object-cover"
        onError={() => setFailed(true)}
      />
    </Link>
  );
}
