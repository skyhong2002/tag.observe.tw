'use client';

import { type CSSProperties, type ReactNode, useState } from 'react';
import styles from './home.module.css';

/** The outlets behind each camp segment: three rows per camp (busiest first)
 *  fading out as a preview, the full list a click away. */
export default function CampOutlets({ total, columns, children }: { total: number; columns: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.campOutletsWrap}>
      <div
        id="camp-outlets"
        className={`${styles.campOutlets} ${open ? '' : styles.campOutletsCollapsed}`}
        style={{ '--outlet-columns': columns } as CSSProperties}
      >
        {children}
      </div>
      <button
        type="button"
        className={`${styles.campOutletsMore} ${open ? '' : styles.campOutletsMoreOverlay}`}
        aria-expanded={open}
        aria-controls="camp-outlets"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '收合' : `顯示全部 ${total} 家媒體`}
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
    </div>
  );
}
