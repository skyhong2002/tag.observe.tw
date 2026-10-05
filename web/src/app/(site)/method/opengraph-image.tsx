import { CARD_SIZE, pageCard } from '@/lib/page-card';

export const alt = '新文易數：資料來源與計算方式';
export const size = CARD_SIZE;
export const contentType = 'image/png';
export const revalidate = 86400;

export default function Image() {
  return pageCard({
    path: '/method/',
    title: '資料來源與計算方式',
    description: '新聞來源、標籤排行、爆發力、事件分群、媒體分類與內文相似度的計算方法。',
    cacheSeconds: 86400,
  });
}
