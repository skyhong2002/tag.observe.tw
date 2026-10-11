import { permanentRedirect } from 'next/navigation';

// 轉載統計 moved from /similarity/daily/ to /similarity/reposts/ (2026-10-11), keeping the query.
export default async function Moved({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const v of [value ?? []].flat()) query.append(key, v);
  permanentRedirect(`/similarity/reposts/${query.size ? `?${query}` : ''}`);
}
