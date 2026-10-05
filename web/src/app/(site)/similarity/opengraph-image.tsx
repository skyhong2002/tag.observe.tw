import { Bars, CARD_SIZE, cardJson, Figure, pageCard, taipeiDay } from '@/lib/page-card';

export const alt = '新文易數：新聞關係圖';
export const size = CARD_SIZE;
export const contentType = 'image/png';
// Drawn per request (crawlers ask rarely); the API reads are cached by fetch.
export const dynamic = 'force-dynamic';

type Daily = {
  totals: { pairs: number[]; identical: number[] };
  media: Array<{ name: string; copied: number[] }>;
};
const sum = (xs: number[] | undefined) => (xs ?? []).reduce((n, x) => n + x, 0);

export default async function Image() {
  const data = await cardJson<Daily>(`/api/v1/similarity/daily?from=${taipeiDay(-1)}&to=${taipeiDay()}`, 1800);
  const top = (data?.media ?? [])
    .map((m) => ({ label: m.name, value: sum(m.copied) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  return pageCard({
    path: '/similarity/',
    title: '新聞關係圖',
    description: '媒體之間的內文相似與引用：誰先刊登、誰的稿子被最多家採用（昨天至今）。',
    children: (
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 22, color: '#52525b', marginBottom: 8 }}>先刊登、被其他媒體相似報導最多次</span>
          <Bars items={top} unit=" 次" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 240, marginLeft: 36 }}>
          <Figure label="相似報導配對" value={data ? sum(data.totals.pairs) : null} unit="組" />
          <Figure label="幾乎照登" value={data ? sum(data.totals.identical) : null} unit="組" />
        </div>
      </div>
    ),
  });
}
