'use client';

import { sendGAEvent } from '@next/third-parties/google';
import { useEffect } from 'react';
import type { MetricWithAttribution } from 'web-vitals/attribution';

let started = false;
/** Document-level metrics; SPA navigations do not become new page-load samples. */
export default function WebVitals() {
  useEffect(() => {
    let active = true;
    // A settled metric can be sent after SPA navigation. Keep its original document URL.
    const navigation = performance.getEntriesByType('navigation')[0];
    const documentUrl = new URL(navigation?.name ?? location.href);
    const pageType = documentUrl.pathname.split('/')[1] || 'home';
    const pageLocation = `${location.origin}${documentUrl.pathname}`;
    // Never send DOM text, IDs, selectors, image URLs or search parameters.
    const generateTarget = (node: Node | null) => {
      if (!(node instanceof Element)) return 'unknown';
      const region = node.closest('[data-vital-region]')?.getAttribute('data-vital-region');
      return region && /^(home-(journalists|readers|graph|topics|hero|outlets)|footer-stats|article-thumbnail)$/.test(region)
        ? region
        : node.tagName.toLowerCase();
    };
    void import('web-vitals/attribution').then(({ onCLS, onINP, onLCP }) => {
      if (!active || started) return;
      started = true;
      const report = (metric: MetricWithAttribution) => {
        const { name, value, rating, id, navigationType } = metric;
        const detail: Record<string, string | number> = {};
        if (metric.name === 'LCP') {
          const a = metric.attribution;
          detail.metric_target = a.target ?? 'unknown';
          detail.lcp_ttfb = Math.round(a.timeToFirstByte);
          detail.lcp_load_delay = Math.round(a.resourceLoadDelay);
          detail.lcp_load_duration = Math.round(a.resourceLoadDuration);
          detail.lcp_render_delay = Math.round(a.elementRenderDelay);
        } else if (metric.name === 'CLS') {
          detail.metric_target = metric.attribution.largestShiftTarget ?? 'none';
        }
        sendGAEvent('event', 'web_vital', {
          metric_name: name,
          metric_value: name === 'CLS' ? Math.round(value * 1000) / 1000 : Math.round(value),
          metric_rating: rating,
          metric_id: id,
          navigation_type: navigationType,
          page_type: pageType,
          page_location: pageLocation,
          ...detail,
          non_interaction: true,
        });
      };
      // Report settled values, not every update. No DOM text or URL queries.
      onCLS(report, { generateTarget });
      onINP(report, { generateTarget });
      onLCP(report, { generateTarget });
    });
    return () => {
      active = false;
    };
  }, []);
  return null;
}
