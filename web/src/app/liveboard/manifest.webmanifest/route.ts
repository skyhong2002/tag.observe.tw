import type { MetadataRoute } from 'next';

// The board installs as its own web app: added to a home screen it opens
// straight into /liveboard/, full screen and landscape, with no browser bars.
export const dynamic = 'force-static';

export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: '/liveboard/',
    name: '新文易數・即時看板',
    short_name: '即時看板',
    description: '新文易數的常駐即時看板：新進新聞、新事件、各家標題對照與轉載比對輪流顯示。',
    lang: 'zh-Hant-TW',
    start_url: '/liveboard/',
    scope: '/liveboard/',
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'landscape',
    background_color: '#09090b',
    theme_color: '#09090b',
    categories: ['news'],
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return Response.json(manifest, { headers: { 'Content-Type': 'application/manifest+json' } });
}
