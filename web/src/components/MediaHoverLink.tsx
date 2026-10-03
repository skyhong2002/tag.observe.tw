'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './MediaHoverLink.module.css';
import MediaIcon from './MediaIcon';
import type { MediaKeywords } from './MediaWordCloud';

type Profile = {
  media: string;
  title: string;
  camp: 'blue' | 'green' | 'other';
  last24h: number;
  last7d: number;
  collectingSince: string | null;
  sourceKind: 'publisher' | 'discovery';
};
const camps = { green: '綠營傾向', blue: '藍營傾向', other: '未列藍綠' };
// Share in-flight requests across links, but let failed requests retry next time.
const requests = new Map<string, { expires: number; value: Promise<unknown> }>();
function get<T>(url: string): Promise<T> {
  const cached = requests.get(url);
  if (cached && cached.expires > Date.now()) return cached.value as Promise<T>;
  const value = fetch(url, { signal: AbortSignal.timeout(6000) })
    .then((response) => {
      if (!response.ok) throw new Error('Media data unavailable');
      return response.json() as Promise<T>;
    })
    .catch((error) => {
      requests.delete(url);
      throw error;
    });
  requests.set(url, { expires: Date.now() + 120000, value });
  return value;
}

export default function MediaHoverLink({
  media,
  children,
  className,
  title,
  icon = 14,
}: {
  media: string;
  children: ReactNode;
  className?: string;
  title?: string;
  /** Logo size in px shown before the children; `false` when the caller renders its own mark.
   *  Callers that already lay the link out with flex keep their own gap. */
  icon?: number | false;
}) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null | undefined>();
  const [keywords, setKeywords] = useState<MediaKeywords | null | undefined>();
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const anchor = useRef<HTMLAnchorElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touch = useRef(false);
  const id = useId();
  const label = title ?? (typeof children === 'string' ? children : media);
  const href = `/media/${encodeURIComponent(media)}/`;
  const keepOpen = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setProfile(undefined);
    setKeywords(undefined);
    const timer = setTimeout(() => {
      void get<{ media: Profile[] }>('/api/v1/media-stats').then(
        (data) => {
          if (active) setProfile(data.media.find((item) => item.media === media) ?? null);
        },
        () => {
          if (active) setProfile(null);
        },
      );
      // Discovery sources aggregate other publishers; their own-media keywords
      // would misleadingly appear empty.
      if (media === 'google_news' || media === 'dongtaiwang') return;
      void get<MediaKeywords>(`/api/v1/media/${encodeURIComponent(media)}/keywords?hours=24`).then(
        (data) => {
          if (active) setKeywords(data);
        },
        () => {
          if (active) setKeywords(null);
        },
      );
    }, 160);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, media]);

  useLayoutEffect(() => {
    if (!open || !anchor.current || !card.current) return;
    const reposition = () => {
      if (!anchor.current || !card.current) return;
      const trigger = anchor.current.getBoundingClientRect();
      const bounds = card.current.getBoundingClientRect();
      setPosition({
        left: Math.max(12, Math.min(trigger.left + (trigger.width - bounds.width) / 2, window.innerWidth - bounds.width - 12)),
        top: Math.max(12, trigger.bottom + bounds.height + 12 <= window.innerHeight ? trigger.bottom + 6 : trigger.top - bounds.height - 6),
      });
    };
    reposition();
    const observer = new ResizeObserver(reposition);
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node) && !card.current?.contains(event.target as Node)) close();
    };
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (card.current?.contains(document.activeElement)) anchor.current?.focus();
      close();
    };
    const scroll = (event: Event) => {
      if (!card.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', dismiss);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', dismiss);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const partialWeek = profile?.collectingSince && Date.now() - Date.parse(profile.collectingSince) < 7 * 86400e3;
  const discovery = profile?.sourceKind === 'discovery' || media === 'google_news' || media === 'dongtaiwang';
  return (
    <>
      <Link
        ref={anchor}
        href={href}
        className={icon === false || /\bflex\b/.test(className ?? '') ? className : `inline-flex items-center gap-1 ${className ?? ''}`}
        aria-label={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') keepOpen();
        }}
        onPointerLeave={scheduleClose}
        onPointerDown={(event) => {
          touch.current = event.pointerType === 'touch';
        }}
        onFocus={() => {
          if (!touch.current) keepOpen();
        }}
        onBlur={scheduleClose}
        onKeyDown={(event) => {
          touch.current = false;
          if (event.key === 'ArrowDown' || (open && event.key === 'Tab' && !event.shiftKey)) {
            event.preventDefault();
            keepOpen();
            requestAnimationFrame(() => card.current?.querySelector<HTMLAnchorElement>('a')?.focus());
          }
        }}
        onClick={(event) => {
          if (touch.current && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            keepOpen();
          } else setOpen(false);
        }}
      >
        {icon !== false && <MediaIcon media={media} title={label} size={icon} />}
        {children}
      </Link>
      {open &&
        createPortal(
          <div
            ref={card}
            id={id}
            role="dialog"
            aria-label={`${profile?.title ?? label}媒體摘要`}
            className={styles.card}
            style={position}
            onPointerEnter={keepOpen}
            onPointerLeave={scheduleClose}
            onFocus={keepOpen}
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return;
              const links = event.currentTarget.querySelectorAll('a');
              if (event.shiftKey && event.target === links[0]) {
                event.preventDefault();
                anchor.current?.focus();
              } else if (!event.shiftKey && event.target === links[links.length - 1]) {
                // Resume the document's tab order after the trigger, not after
                // the portal at the end of the body.
                anchor.current?.focus();
                setOpen(false);
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
            }}
          >
            <strong className={styles.title}>{profile?.title ?? label}</strong>
            {profile && (
              <span className={styles.muted}>
                <i className={styles[profile.camp]} />
                {camps[profile.camp]}
              </span>
            )}
            <span className={styles.muted}>{discovery ? '本站透過此來源收錄' : '本站收錄'}</span>
            <div className={styles.counts}>
              <span>
                24 小時<b>{profile ? `${profile.last24h.toLocaleString('zh-TW')} 篇` : '—'}</b>
              </span>
              <span>
                7 天<b>{profile ? `${profile.last7d.toLocaleString('zh-TW')} 篇` : '—'}</b>
              </span>
            </div>
            {profile === undefined && <span className={styles.note}>收錄篇數載入中…</span>}
            {profile === null && <span className={styles.note}>收錄篇數暫時無法取得</span>}
            {partialWeek && <span className={styles.note}>收錄未滿 7 天，以上為已收錄篇數</span>}
            {!discovery && (
              <div className={styles.keywords}>
                <span className={styles.muted}>近 24 小時熱門關鍵字</span>
                {keywords === undefined ? (
                  <p className={styles.note}>關鍵字載入中…</p>
                ) : keywords === null ? (
                  <p className={styles.note}>關鍵字暫時無法取得</p>
                ) : keywords.terms.length ? (
                  <>
                    <div className={styles.terms}>
                      {keywords.terms.slice(0, 5).map((term) => (
                        <Link
                          key={term.label}
                          href={`${href}?${new URLSearchParams({ hours: '24', q: term.label })}`}
                          onClick={() => setOpen(false)}
                        >
                          <span>{term.label}</span>
                          <span>{term.count.toLocaleString('zh-TW')} 篇</span>
                        </Link>
                      ))}
                    </div>
                    <span className={styles.note}>
                      {keywords.capped ? `取最新 ${keywords.sampledArticles.toLocaleString('zh-TW')} 篇；` : ''}
                      標籤與標題關鍵詞，每篇每詞計一次
                    </span>
                  </>
                ) : (
                  <p className={styles.note}>這段時間尚無足夠的關鍵字</p>
                )}
              </div>
            )}
            <Link className={styles.more} href={href} onClick={() => setOpen(false)}>
              查看媒體報導 →
            </Link>
          </div>,
          document.body,
        )}
    </>
  );
}
