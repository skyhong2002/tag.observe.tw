'use client';

import { GoogleAnalytics, sendGAEvent } from '@next/third-parties/google';
import { useEffect, useState } from 'react';

const GA_ID = 'G-D1E1CZSX7L';

// Page views belong to GA's enhanced measurement (including history changes).
// Do not also send page_view from a pathname effect.
export default function SiteAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || location.hostname !== 'tag.observe.tw') return;
    setEnabled(true);
    // Queue early interactions even if gtag.js has not finished downloading.
    const analyticsWindow = window as Window & { dataLayer?: unknown[] };
    analyticsWindow.dataLayer ??= [];

    const click = (event: MouseEvent) => {
      if (event.type === 'auxclick' && event.button !== 1) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      // Word-cloud links live inside SVG, while lists use HTML anchors.
      if (!(anchor instanceof HTMLAnchorElement || anchor instanceof SVGElement)) return;
      const url = new URL(anchor.getAttribute('href')!, location.href);
      if (!['https:', 'http:'].includes(url.protocol)) return;
      const source_page_type = location.pathname.split('/')[1] || 'home';
      if (anchor.dataset.analytics === 'open_original' && url.origin !== location.origin) {
        sendGAEvent('event', 'open_original', { source_page_type, link_domain: url.hostname });
      } else if (url.origin === location.origin && url.pathname.startsWith('/feeds/')) {
        sendGAEvent('event', 'rss_click', { source_page_type });
      } else if (url.origin === location.origin && /^\/(tag|eve)\/[^/]+/.test(url.pathname)) {
        sendGAEvent('event', 'select_content', {
          source_page_type,
          content_type: url.pathname.startsWith('/tag/') ? 'tag' : 'event',
        });
      }
    };
    const installed = () => sendGAEvent('event', 'app_installed');
    document.addEventListener('click', click);
    document.addEventListener('auxclick', click);
    window.addEventListener('appinstalled', installed);
    return () => {
      document.removeEventListener('click', click);
      document.removeEventListener('auxclick', click);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  return enabled ? <GoogleAnalytics gaId={GA_ID} /> : null;
}
