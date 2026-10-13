'use client';

import { useState } from 'react';
import SafeImage from '@/components/SafeImage';
import { homeImageSizes } from '@/lib/home-images.mts';
import styles from './home.module.css';

export default function NewsImage({
  src,
  priority = false,
  variant = 'story',
}: {
  src: string | null;
  priority?: boolean;
  variant?: 'story' | 'topic';
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={styles.picture} aria-hidden="true">
      {/* The wordmark as a CSS mask, not inline SVG: a page has a dozen of these and the paths are 4 KB each. */}
      <span className={styles.pictureFallback}>
        <span className={styles.pictureMark} />
      </span>
      {src && !failed && (
        <SafeImage
          src={src}
          alt=""
          fill
          sizes={homeImageSizes[priority ? 'hero' : variant]}
          quality={priority ? 75 : 65}
          fetchPriority={priority ? 'high' : 'low'}
          loading={priority ? 'eager' : 'lazy'}
          className={styles.photo}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
