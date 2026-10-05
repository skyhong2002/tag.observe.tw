'use client';

import { sendGAEvent } from '@next/third-parties/google';
import { useEffect } from 'react';
import type { Metric } from 'web-vitals';

let started = false;
/** Document-level metrics; SPA navigations do not become new page-load samples. */
export default function WebVitals() {
  useEffect(() => {
    let active = true;
    const pageType = location.pathname.split('/')[1] || 'home';
    void import('web-vitals').then(({ onCLS, onINP, onLCP }) => {
      if (!active || started) return;
      started = true;
      const report = ({ name, value, rating, id, navigationType }: Metric) => {
        sendGAEvent('event', 'web_vital', {
          metric_name: name,
          metric_value: name === 'CLS' ? Math.round(value * 1000) / 1000 : Math.round(value),
          metric_rating: rating,
          metric_id: id,
          navigation_type: navigationType,
          page_type: pageType,
          non_interaction: true,
        });
      };
      // Report settled values, not every update. No DOM text or URL queries.
      onCLS(report);
      onINP(report);
      onLCP(report);
    });
    return () => {
      active = false;
    };
  }, []);
  return null;
}
