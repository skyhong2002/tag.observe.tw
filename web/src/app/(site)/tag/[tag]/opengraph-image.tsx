import { API_ORIGIN, type TagStatus } from '@/lib/api';
import { shareCard } from '@/lib/share-card';

export const alt = '新文易數：關鍵字新聞與趨勢';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 21600;
export const dynamic = 'force-static';

export default async function Image({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  if (!tag.trim() || tag.length > 60) return new Response('Not found', { status: 404 });
  const response = await fetch(`${API_ORIGIN}/api/v1/tags/${encodeURIComponent(tag)}/status`, {
    next: { revalidate: 21600 },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return new Response('Temporarily unavailable', { status: 503 });
  const status = (await response.json()) as TagStatus;
  if (!status.history && !status.ranking && !status.threads.length && !status.related.length) {
    // A newly collected tag can have articles before it enters the ranking.
    const articles = await fetch(`${API_ORIGIN}/api/v1/tags/${encodeURIComponent(tag)}/articles?hours=168`, {
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(6000),
    });
    if (!articles.ok) return new Response('Temporarily unavailable', { status: 503 });
    const data = (await articles.json()) as { articles: unknown[] };
    if (!data.articles.length) return new Response('Not found', { status: 404 });
  }
  return shareCard(tag, '關鍵字觀察', '相關報導・媒體對照・熱度趨勢');
}
