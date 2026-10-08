import { permanentRedirect } from 'next/navigation';
import { archiveDay } from '@/lib/seo.mts';

// The day view became the event table's default; old archive links keep working.
export default async function EventArchivePage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const day = archiveDay((await searchParams).day);
  permanentRedirect(day ? `/event/?day=${day}` : '/event/');
}
