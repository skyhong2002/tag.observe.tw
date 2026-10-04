import { API_ORIGIN } from '@/lib/api';
import { cleanEventHeadline, clipHeadline, selectEventLead } from '@/lib/event-presentation.mts';
import { shareCard } from '@/lib/share-card';

export const alt = '新文易數：新聞事件與各家標題對照';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 21600;
export const dynamic = 'force-static';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,15}$/.test(id) || !Number.isSafeInteger(Number(id))) return new Response('Not found', { status: 404 });
  const response = await fetch(`${API_ORIGIN}/api/v1/events/threads/${id}`, {
    next: { revalidate: 21600 },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok)
    return new Response(response.status === 404 ? 'Not found' : 'Temporarily unavailable', { status: response.status === 404 ? 404 : 503 });
  const data = (await response.json()) as {
    thread: { majorTags: string[] };
    hours: Array<{ news: Array<{ title: string; image: string | null; url: string; media: string }>; major: string[] }>;
  };
  const latest = data.hours[0];
  const lead = latest ? selectEventLead(latest.news, latest.major) : null;
  const title = lead ? clipHeadline(cleanEventHeadline(lead.title)) : data.thread.majorTags.join('、');
  return shareCard(title || `事件 ${id}`, '新聞事件', '各家標題・事件時間線・報導分布');
}
