import { EventMethod, EventThreadMethod, MediaCardMethod } from '@/components/MethodNotes';
import { fetchThreadPart } from '@/lib/event-thread-api';

export const revalidate = 120;

// Same requests as the event page, so the fetches are shared within a render.
export default async function EventThreadNotes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, cov] = await Promise.all([
    fetchThreadPart<{ thread: { majorTags: string[] } }>(id, '').catch(() => null),
    fetchThreadPart<{ from: string; to: string; articles: number }>(id, '/coverage').catch(() => null),
  ]);
  return (
    <>
      <EventThreadMethod majorTags={data?.thread.majorTags} coverage={cov} />
      <EventMethod page="thread" />
      <MediaCardMethod />
    </>
  );
}
