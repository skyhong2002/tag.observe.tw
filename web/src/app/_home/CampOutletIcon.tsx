'use client';

import Link from 'next/link';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import SafeImage from '@/components/SafeImage';
import type { CampOutlet, DemoCamp } from '@/lib/demo';
import styles from './home.module.css';

export default function CampOutletIcon({ outlet, camp, campLabel }: { outlet: CampOutlet; camp: DemoCamp; campLabel: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const link = useRef<HTMLAnchorElement>(null);
  const card = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const activity = outlet.active ? `${outlet.last24h.toLocaleString()} 篇` : '沒有文章';

  useLayoutEffect(() => {
    if (!open || !link.current || !card.current) return;
    const anchor = link.current.getBoundingClientRect();
    const tooltip = card.current.getBoundingClientRect();
    const margin = 12;
    setPosition({
      left: Math.max(margin, Math.min(anchor.left + (anchor.width - tooltip.width) / 2, window.innerWidth - tooltip.width - margin)),
      top: Math.max(margin, anchor.bottom + tooltip.height + margin <= window.innerHeight ? anchor.bottom : anchor.top - tooltip.height),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', dismiss);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <Link
      ref={link}
      href={`/media/${outlet.media}/`}
      className={`${styles.campOutletLink} ${outlet.active ? '' : styles.campOutletIdle}`}
      aria-label={`${outlet.title}（過去 24 小時${activity}）`}
      aria-describedby={open ? tooltipId : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') setOpen(true);
      }}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen(false)}
    >
      <span className={styles.campOutletIcon}>
        {outlet.icon ? <SafeImage src={outlet.icon} alt="" width={18} height={18} /> : outlet.title.slice(0, 1)}
      </span>
      {open && (
        <span ref={card} id={tooltipId} role="tooltip" className={styles.campOutletTooltip} style={position}>
          <span className={styles.campOutletCard}>
            <strong>{outlet.title}</strong>
            <span className={styles.campOutletCategory}>
              <i className={styles[camp]} aria-hidden="true" />
              {campLabel}
            </span>
            <span className={styles.campOutletActivity}>
              過去 24 小時 <b>{activity}</b>
            </span>
            <span className={styles.campOutletHint}>查看媒體報導 →</span>
          </span>
        </span>
      )}
    </Link>
  );
}
