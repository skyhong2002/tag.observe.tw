'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import { isAllowedImage } from '@/lib/images';

// next/image restricted to the generated host allowlist; unknown hosts render
// nothing. Outlet logos go through MediaIcon, not here. A picture the origin
// no longer serves (404/500 from the optimizer) also renders nothing rather
// than a broken-image box; callers with a fallback still get onError.
export default function SafeImage({ src, alt = '', onError, ...props }: Omit<ImageProps, 'src'> & { src: string | null | undefined }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!isAllowedImage(src) || failed === src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      {...props}
      onError={(event) => {
        setFailed(src);
        onError?.(event);
      }}
    />
  );
}
