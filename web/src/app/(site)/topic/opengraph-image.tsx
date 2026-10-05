import { CARD_SIZE, cardJson, Empty, pageCard, Row } from '@/lib/page-card';

export const alt = '新文易數：議題表';
export const size = CARD_SIZE;
export const contentType = 'image/png';
// Drawn per request (crawlers ask rarely); the API reads are cached by fetch.
export const dynamic = 'force-dynamic';

// Some outlets refresh many topic pages at once; keep the list varied.
const onePerOutlet = () => {
  const seen = new Map<string, number>();
  return (t: { mediaTitle: string }) => {
    const n = seen.get(t.mediaTitle) ?? 0;
    seen.set(t.mediaTitle, n + 1);
    return n < 2;
  };
};
type Feed = { feed: Array<{ id: string; mediaTitle: string; title: string | null; storyCount?: number | null }> };

export default async function Image() {
  const data = await cardJson<Feed>('/api/v1/topics?kind=topic&limit=30', 1800);
  return pageCard({
    path: '/topic/',
    title: '議題表',
    description: '各媒體持續更新的議題，依最近更新排序。',
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
        {(data?.feed ?? []).length === 0 && <Empty />}
        {(data?.feed ?? [])
          .filter((t) => t.title)
          .filter(onePerOutlet())
          .slice(0, 5)
          .map((t) => (
            <Row key={t.id} lead={t.mediaTitle} text={t.title!} tail={t.storyCount ? `${t.storyCount} 篇` : undefined} chars={34} />
          ))}
      </div>
    ),
  });
}
