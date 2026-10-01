import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { renderRss, renderSitemap, robotsTxt, xml } from '../src/feeds.ts';

describe('feeds', () => {
  it('escapes markup and strips characters XML cannot carry', () => {
    expect(xml(`A&B <i>"x"</i> 'y'\u0001\u000b`)).toBe('A&amp;B &lt;i&gt;&quot;x&quot;&lt;/i&gt; &apos;y&apos;');
  });
  it('renders RSS 2.0 with a self link and items', () => {
    const out = renderRss(
      { title: 'T', link: 'https://tag.observe.tw/event/', self: 'https://tag.observe.tw/feeds/events.xml', description: 'D' },
      [
        {
          title: '劫機、以色列：<快訊>',
          link: 'https://tag.observe.tw/eve/1/',
          guid: 'https://tag.observe.tw/eve/1/',
          pubDate: new Date('2026-09-30T08:00:00Z'),
          description: '【中央社】a & b',
          categories: ['劫機'],
        },
      ],
    );
    expect(out).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/);
    expect(out).toContain('<atom:link href="https://tag.observe.tw/feeds/events.xml" rel="self" type="application/rss+xml" />');
    expect(out).toContain('<title>劫機、以色列：&lt;快訊&gt;</title>');
    expect(out).toContain('<pubDate>Wed, 30 Sep 2026 08:00:00 GMT</pubDate>');
    expect(out).toContain('<lastBuildDate>Wed, 30 Sep 2026 08:00:00 GMT</lastBuildDate>');
    expect(out).toContain('<category>劫機</category>');
    expect(out).toContain('<description>【中央社】a &amp; b</description>');
  });
  it('renders a sitemap with absolute, escaped URLs', () => {
    const out = renderSitemap([
      { loc: '/', changefreq: 'hourly', priority: 1 },
      { loc: '/tag/%E5%8F%B0&x/', lastmod: new Date('2026-09-30T00:00:00Z') },
    ]);
    expect(out).toContain('<url><loc>https://tag.observe.tw/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>');
    expect(out).toContain('<loc>https://tag.observe.tw/tag/%E5%8F%B0&amp;x/</loc><lastmod>2026-09-30T00:00:00.000Z</lastmod>');
  });
  it('robots.txt points at the sitemap and keeps crawlers off JSON endpoints', () => {
    expect(robotsTxt()).toContain('Sitemap: https://tag.observe.tw/sitemap.xml');
    expect(robotsTxt()).toContain('Disallow: /api/v');
    // Google needs CSS/JS to render pages.
    expect(robotsTxt()).not.toContain('/_next/');
    expect(robotsTxt()).not.toMatch(/Disallow: \/api\/\n/);
  });
  it('the gateway serves robots.txt itself instead of proxying it to the UI', async () => {
    const app = await buildApp({ uiOrigin: 'http://127.0.0.1:9' });
    try {
      const r = await app.inject('/robots.txt');
      expect(r.statusCode).toBe(200);
      expect(r.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(r.body).toBe(robotsTxt());
    } finally {
      await app.close();
    }
  });
});
