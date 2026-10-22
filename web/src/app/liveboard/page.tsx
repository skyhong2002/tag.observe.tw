import type { Metadata, Viewport } from 'next';
import { pageMetadata } from '@/lib/seo.mts';
import { loadBoard } from './board-data';
import NewsBoard from './NewsBoard';

// A chrome-less, always-on screen (a wall tablet): it renders the current
// snapshot here, then NewsBoard refreshes the existing public APIs.
export const revalidate = 30;
export const metadata: Metadata = {
  ...pageMetadata('/liveboard/', '即時看板', '新文易數的常駐新聞看板：主要事件、最新新聞與人物／Tag 追蹤；進階分析另設 Advanced。', true),
  robots: { index: false, follow: false },
  // Its own web app: installed, it opens the board full screen (see manifest.webmanifest/route.ts).
  manifest: '/liveboard/manifest.webmanifest',
  appleWebApp: { capable: true, title: '即時看板', statusBarStyle: 'black-translucent' },
};
// viewport-fit=cover lets the board reach under the notch; it pads by the safe-area insets.
export const viewport: Viewport = { themeColor: '#09090b', viewportFit: 'cover' };

export default async function LiveboardPage() {
  return <NewsBoard {...(await loadBoard())} />;
}
