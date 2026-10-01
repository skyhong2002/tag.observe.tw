'use client';

import { useState } from 'react';
import SafeImage from '@/components/SafeImage';
import Wordmark from '@/components/Wordmark';
import styles from './home.module.css';

export default function NewsImage({ src, priority = false }: { src: string | null; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={styles.picture} aria-hidden="true">
      <span className={styles.pictureFallback}>
        <Wordmark />
      </span>
      {src && !failed && (
        <SafeImage
          src={src}
          alt=""
          fill
          sizes={priority ? '(max-width: 760px) 100vw, 55vw' : '(max-width: 760px) 35vw, 25vw'}
          loading={priority ? 'eager' : 'lazy'}
          className={styles.photo}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
