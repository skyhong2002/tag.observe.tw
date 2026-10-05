import { CARD_SIZE, pageCard } from '@/lib/page-card';

export const alt = '新文易數：網站觀測';
export const size = CARD_SIZE;
export const contentType = 'image/png';
export const revalidate = 86400;

export default function Image() {
  return pageCard({
    path: '/observe/',
    title: '網站觀測',
    description: '新文易數的公開流量：每日瀏覽、讀者關注的事件與議題、來源管道、搜尋表現與真實使用體驗。',
    cacheSeconds: 86400,
  });
}
