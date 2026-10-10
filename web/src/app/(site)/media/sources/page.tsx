import { permanentRedirect } from 'next/navigation';

// 流量與排名 moved from /media/sources/ to /media/traffic/ (2026-10-10), keeping the query.
export default async function Moved({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const v of [value ?? []].flat()) query.append(key, v);
  permanentRedirect(`/media/traffic/${query.size ? `?${query}` : ''}`);
}
