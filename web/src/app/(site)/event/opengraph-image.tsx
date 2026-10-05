import { cleanEventHeadline, selectEventLead } from '@/lib/event-presentation.mts';
import { C, CARD_SIZE, CampSplit, cardJson, clip, Empty, pageCard } from '@/lib/page-card';
export const alt = '新文易數：事件表';
export const size = CARD_SIZE;
export const contentType = 'image/png';
// Drawn per request (crawlers ask rarely); the API reads are cached by fetch.
export const dynamic = 'force-dynamic';

type Events = {
  events: Array<{
    rank: number;
    major: string[];
    news: Array<{ title: string }>;
    coverage?: { outlets: unknown[]; articles: number; camps: { blue: number; green: number; other: number } };
  }>;
};

export default async function Image() {
  const data = await cardJson<Events>('/api/v1/events?limit=4');
  return pageCard({
    path: '/event/',
    title: '事件表',
    description: '同一件事，各家媒體的標題與刊登時間並排比較。',
    cacheSeconds: 900,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
        {(data?.events ?? []).length === 0 && <Empty />}
        {(data?.events ?? []).slice(0, 4).map((e) => {
          const lead = selectEventLead(e.news, e.major);
          return (
            <div key={e.rank} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>
              <span style={{ fontSize: 34, color: C.brand, width: 56 }}>{e.rank}</span>
              <span style={{ fontSize: 28, flex: 1 }}>{clip(cleanEventHeadline(lead?.title ?? e.major.join('、')), 26)}</span>
              {e.coverage && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 16 }}>
                  <span style={{ fontSize: 20, color: C.muted, marginBottom: 6 }}>
                    {e.coverage.outlets.length} 家 · {e.coverage.articles} 篇
                  </span>
                  <CampSplit camps={e.coverage.camps} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    ),
  });
}
