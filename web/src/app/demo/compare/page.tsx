import { permanentRedirect } from 'next/navigation';

export default async function FormerComparison({ searchParams }: { searchParams: Promise<{ event?: string | string[] }> }) {
  const { event } = await searchParams;
  permanentRedirect(typeof event === 'string' && /^\d+$/.test(event) ? `/eve/${event}/` : '/');
}
