import { CARD_SIZE, cardJson, Empty, Figure, pageCard, Row } from '@/lib/page-card';

export const alt = '新文易數：記者';
export const size = CARD_SIZE;
export const contentType = 'image/png';
// Drawn per request (crawlers ask rarely); the API reads are cached by fetch.
export const dynamic = 'force-dynamic';

type Journalists = {
  totals: { journalists: number; credited: number };
  journalists: Array<{ name: string; articles: number; media: Array<{ name: string }> }>;
};

export default async function Image() {
  const data = await cardJson<Journalists>('/api/v1/journalists?limit=6', 1800);
  return pageCard({
    path: '/journalist/',
    title: '記者',
    description: '從新聞署名看記者與作者：刊登媒體、報導篇數與跨媒體相似報導（近 48 小時）。',
    children: (
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          {(data?.journalists ?? []).length === 0 && <Empty />}
          {(data?.journalists ?? []).slice(0, 5).map((j) => (
            <Row
              key={j.name}
              lead={j.name}
              text={j.media
                .slice(0, 3)
                .map((m) => m.name)
                .join('、')}
              tail={`${j.articles} 篇`}
              chars={26}
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 240, marginLeft: 36 }}>
          <Figure label="署名記者與作者" value={data?.totals.journalists} unit="位" />
          <Figure label="有署名的文章" value={data?.totals.credited} unit="篇" />
        </div>
      </div>
    ),
  });
}
