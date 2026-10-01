import { permanentRedirect } from 'next/navigation';

export default async function FormerDemo({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const search = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 100);
  permanentRedirect(search ? `/?${new URLSearchParams({ q: search })}` : '/');
}
