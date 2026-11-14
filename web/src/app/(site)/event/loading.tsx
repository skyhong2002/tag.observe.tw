import { EventSkeleton } from '@/components/PageSkeleton';

// No page under this segment calls notFound(), so streaming its 200 is safe (PageSkeleton).
export default function Loading() {
  return <EventSkeleton label="事件表" />;
}
