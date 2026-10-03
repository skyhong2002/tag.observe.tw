import { describe, expect, it } from 'vitest';
import { selectEventCover } from '../../../web/src/lib/event-presentation.mts';

const allowed = (u: string | null | undefined) => !!u && u.startsWith('https://');
describe('selectEventCover', () => {
  it('skips outlet logos and images shared by several reports', () => {
    const news = [
      { image: 'https://imgcdn.cna.com.tw/www/images/pic_fb.jpg' },
      { image: 'https://udn.com/static/img/UDN_BABY.png' },
      { image: 'https://x/same.jpg' },
      { image: 'https://x/same.jpg' },
      { image: 'https://x/photo.jpg' },
      { image: 'http://x/insecure.jpg' },
    ];
    expect(selectEventCover(news, news[0], allowed)).toBe(news[4]);
    expect(selectEventCover(news, news[4], allowed)).toBe(news[4]);
    expect(selectEventCover(news.slice(0, 4), null, allowed)).toBeNull();
  });
});
