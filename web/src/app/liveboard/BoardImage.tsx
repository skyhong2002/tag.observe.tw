'use client';

import type { ImageProps } from 'next/image';
import { useState } from 'react';
import SafeImage from '@/components/SafeImage';
import { isAllowedImage } from '@/lib/images';

/** Failed photos relinquish their entire box, leaving room for the report. */
export default function BoardImage({
  src,
  frameClassName,
  ...props
}: Omit<ImageProps, 'src' | 'alt' | 'fill'> & { src: string | null | undefined; frameClassName: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!isAllowedImage(src) || failedSrc === src) return null;
  return (
    <div className={frameClassName}>
      <SafeImage {...props} src={src} alt="" fill onError={() => setFailedSrc(src)} />
    </div>
  );
}
