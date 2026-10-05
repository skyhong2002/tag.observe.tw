import { CARD_SIZE, cardJson, Empty, Figure, pageCard, Row } from '@/lib/page-card';

export const alt = '新文易數：最新文章';
export const size = CARD_SIZE;
export const contentType = 'image/png';
// Drawn per request (crawlers ask rarely); the API reads are cached by fetch.
export const dynamic = 'force-dynamic';

type Articles = { articles: Array<{ mediaTitle: string; title: string; publishedAt: string }> };
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit' });

export default async function Image() {
  const [list, stats] = await Promise.all([
    cardJson<Articles>('/api/v1/articles?limit=6&settled=1&hours=3'),
    cardJson<{ totals: { today: number; publishingMedia24h: number } }>('/api/v1/media-stats'),
  ]);
  return pageCard({
    path: '/article/',
    title: '最新文章',
    description: '所有媒體的新聞，依刊登時間由新到舊。',
    cacheSeconds: 900,
    children: (
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          {(list?.articles ?? []).length === 0 && <Empty />}
          {(list?.articles ?? []).slice(0, 5).map((a) => (
            <Row key={a.title} lead={a.mediaTitle} text={a.title} tail={hhmm(a.publishedAt)} chars={21} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 240, marginLeft: 36 }}>
          <Figure label="今日收錄" value={stats?.totals.today} unit="篇" />
          <Figure label="24 小時發稿" value={stats?.totals.publishingMedia24h} unit="家" />
        </div>
      </div>
    ),
  });
}
