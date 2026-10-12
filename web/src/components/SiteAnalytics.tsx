'use client';

import { useEffect } from 'react';
import { analyticsBlock, GA_ID, readOptOut, shouldReportLiveboardActivity } from '@/lib/analytics-consent.mts';
import { installAnalytics, sendAnalyticsEvent } from '@/lib/analytics-runtime.mts';
import WebVitals from './WebVitals';

const safeStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export default function SiteAnalytics() {
  useEffect(() => {
    const allowed = () =>
      analyticsBlock({
        production: process.env.NODE_ENV === 'production',
        hostname: location.hostname,
        webdriver: navigator.webdriver,
        userAgent: navigator.userAgent,
        doNotTrack: navigator.doNotTrack,
        globalPrivacyControl: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl,
        optedOut: readOptOut(safeStorage()),
      }) === null;
    const cleanup = installAnalytics({
      id: GA_ID,
      origin: location.origin,
      href: () => location.href,
      referrer: document.referrer,
      history,
      win: window as unknown as Parameters<typeof installAnalytics>[0]['win'],
      doc: document,
      localStorage: safeStorage,
      allowed,
      noindex: () => Boolean(document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex')),
      loadScript: (src, onload) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = onload;
        document.head.appendChild(script);
      },
    });
    const heartbeat = setInterval(() => {
      if (shouldReportLiveboardActivity(location.pathname, document.visibilityState, readOptOut(safeStorage()))) {
        sendAnalyticsEvent('liveboard_activity');
      }
    }, 60_000);
    return () => {
      clearInterval(heartbeat);
      cleanup();
    };
  }, []);
  return <WebVitals />;
}
