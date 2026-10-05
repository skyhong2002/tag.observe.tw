import { Bars, CARD_SIZE, cardJson, Figure, pageCard } from '@/lib/page-card';

export const alt = '新文易數：媒體與文章數';
export const size = CARD_SIZE;
export const contentType = 'image/png';
// Drawn per request (crawlers ask rarely); the API reads are cached by fetch.
export const dynamic = 'force-dynamic';

type Stats = {
  totals: { today: number; activeSources: number; publishingMedia24h: number };
  media: Array<{ title: string; last24h: number }>;
};

export default async function Image() {
  const data = await cardJson<Stats>('/api/v1/media-stats', 1800);
  const top = [...(data?.media ?? [])].sort((a, b) => b.last24h - a.last24h).slice(0, 6);
  return pageCard({
    path: '/media/',
    title: '媒體與文章數',
    description: '本站追蹤的新聞媒體、近期收錄篇數與更新狀態。',
    children: (
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 22, color: '#52525b', marginBottom: 8 }}>近 24 小時收錄最多</span>
          <Bars items={top.map((m) => ({ label: m.title, value: m.last24h }))} unit=" 篇" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 240, marginLeft: 36 }}>
          <Figure label="追蹤來源" value={data?.totals.activeSources} unit="個" />
          <Figure label="24 小時發稿" value={data?.totals.publishingMedia24h} unit="家" />
        </div>
      </div>
    ),
  });
}
