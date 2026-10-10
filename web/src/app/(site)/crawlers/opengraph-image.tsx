import { CARD_SIZE, pageCard } from '@/lib/page-card';

export const alt = '新文易數：資料蒐集';
export const size = CARD_SIZE;
export const contentType = 'image/png';
export const revalidate = 86400;

export default function Image() {
  return pageCard({
    path: '/crawlers/',
    title: '資料蒐集',
    description: '各新聞來源的擷取方式、最近收錄與爬取狀態，了解資料的涵蓋範圍與更新限制。',
    cacheSeconds: 86400,
  });
}
