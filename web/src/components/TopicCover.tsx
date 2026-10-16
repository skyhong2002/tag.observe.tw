'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { isAllowedImage } from '@/lib/images';

/** A topic's cover, or blank space as wide: outlets list covers their CDN
 *  later refuses (403 to anything but a browser, 404 on a retired microsite),
 *  and a broken image reads worse than a blank. The space keeps every row's
 *  text starting at the same column, so a coverless topic does not look like
 *  a heading for the rows below it. */
export default function TopicCover({ src, href }: { src: string | null; href: string }) {
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  // Listen on the element itself: an image that failed before hydration has
  // already fired its error event, and React would never see it.
  useEffect(() => {
    const img = box.current?.querySelector('img');
    if (!img) return;
    const check = () => {
      if (img.complete && img.naturalWidth === 0) setFailed(true);
    };
    const fail = () => setFailed(true);
    check();
    img.addEventListener('error', fail);
    img.addEventListener('load', check);
    return () => {
      img.removeEventListener('error', fail);
      img.removeEventListener('load', check);
    };
  }, []);
  if (!isAllowedImage(src) || failed) {
    return <span aria-hidden className="w-28 shrink-0" />;
  }
  return (
    <span ref={box} className="aspect-video w-28 shrink-0 self-start overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
      <Link href={href} tabIndex={-1} aria-hidden className="block h-full w-full">
        <Image src={src} alt="" width={224} height={126} className="h-full w-full object-cover" />
      </Link>
    </span>
  );
}
