import type { Metadata, Viewport } from 'next';
import { pageMetadata } from '@/lib/seo.mts';
import { loadBoard } from '../board-data';
import NewsBoard from '../NewsBoard';

export const revalidate = 30;
export const metadata: Metadata = {
  ...pageMetadata(
    '/liveboard/advanced/',
    'Advanced 進階看板',
    '研究相似新聞、議題新增報導、事件延續與各家標題，持續追蹤關注的 Tag。',
    true,
  ),
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#09090b', viewportFit: 'cover' };

export default async function AdvancedLiveboardPage() {
  return <NewsBoard {...(await loadBoard())} advanced />;
}
