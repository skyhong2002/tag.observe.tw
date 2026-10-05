import { Bars, CARD_SIZE, cardJson, pageCard } from '@/lib/page-card';

export const alt = '新文易數：新聞關鍵字排行榜';
export const size = CARD_SIZE;
export const contentType = 'image/png';
// Drawn per request (crawlers ask rarely); the API reads are cached by fetch.
export const dynamic = 'force-dynamic';

type Ranking = { entries: Array<{ tag: string; count: number }> };

export default async function Image() {
  const data = await cardJson<Ranking>('/api/v1/ranking?category=all&order=burst&limit=8');
  return pageCard({
    path: '/ranking/',
    title: '新聞關鍵字排行榜',
    description: '各媒體共同關注的話題：近 24 小時竄升最快的關鍵字（依名次）與報導篇數。',
    cacheSeconds: 900,
    children: (
      <Bars items={(data?.entries ?? []).slice(0, 7).map((e, i) => ({ label: `${i + 1}  ${e.tag}`, value: e.count }))} unit=" 篇" />
    ),
  });
}
