import { CARD_SIZE, pageCard } from '@/lib/page-card';

export const alt = '新文易數：媒體流量與收錄比較';
export const size = CARD_SIZE;
export const contentType = 'image/png';
export const revalidate = 86400;

export default function Image() {
  return pageCard({
    path: '/media/sources/',
    title: '媒體流量與收錄比較',
    description: '對照媒體網站流量資料與本站新聞收錄範圍，查看媒體分類、來源與統計方法。',
    cacheSeconds: 86400,
  });
}
