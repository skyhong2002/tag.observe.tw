'use client';

import { GoogleAnalytics, sendGAEvent } from '@next/third-parties/google';
import { useEffect, useState } from 'react';
import { analyticsBlock, GA_ID, OPT_OUT_EVENT, OPT_OUT_KEY, readOptOut, selectContentTarget } from '@/lib/analytics-consent.mts';
import WebVitals from './WebVitals';

const safeStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

// Page views belong to GA's enhanced measurement (including history changes).
// Do not also send page_view from a pathname effect.
// Everything (gtag.js, page_view, events, web_vital) mounts only when analyticsBlock
// allows it, so automation and opted-out browsers never load the Google tag.
export default function SiteAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const block = analyticsBlock({
      production: process.env.NODE_ENV === 'production',
      hostname: location.hostname,
      webdriver: navigator.webdriver,
      userAgent: navigator.userAgent,
      optedOut: readOptOut(safeStorage()),
      pathname: location.pathname,
    });
    // GA's documented kill switch, in case a tag was loaded some other way.
    const disable = window as unknown as Record<string, boolean>;
    disable[`ga-disable-${GA_ID}`] = block !== null;
    if (block) return;
    setEnabled(true);
    // Opting out mid-visit stops hits from the tag already loaded; opting back in takes effect on the next page load.
    const choice = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== OPT_OUT_KEY) return;
      if (readOptOut(safeStorage())) disable[`ga-disable-${GA_ID}`] = true;
    };
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
      } else if (url.origin === location.origin) {
        const target = selectContentTarget(url.pathname);
        if (target) sendGAEvent('event', 'select_content', { source_page_type, ...target });
      }
    };
    const installed = () => sendGAEvent('event', 'app_installed');
    document.addEventListener('click', click);
    document.addEventListener('auxclick', click);
    window.addEventListener('appinstalled', installed);
    window.addEventListener(OPT_OUT_EVENT, choice);
    window.addEventListener('storage', choice);
    return () => {
      document.removeEventListener('click', click);
      document.removeEventListener('auxclick', click);
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener(OPT_OUT_EVENT, choice);
      window.removeEventListener('storage', choice);
    };
  }, []);

  return enabled ? (
    <>
      <GoogleAnalytics gaId={GA_ID} />
      <WebVitals />
    </>
  ) : null;
}
