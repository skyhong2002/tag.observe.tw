import { CARD_SIZE, pageCard } from '@/lib/page-card';

export const alt = '新文易數：新文易數 API';
export const size = CARD_SIZE;
export const contentType = 'image/png';
export const revalidate = 86400;

export default function Image() {
  return pageCard({
    path: '/api/',
    title: '新文易數 API',
    description: '免費取用新聞關鍵字、事件、議題、媒體與相似度資料：公開、免金鑰、唯讀。',
    cacheSeconds: 86400,
  });
}
