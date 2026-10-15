import { redirect } from 'next/navigation';

export default async function LegacyTagAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams({ view: 'pictures' });
  for (const [key, value] of Object.entries(query)) if (key !== 'view' && typeof value === 'string') params.set(key, value);
  redirect(`/admin/tags/?${params}`);
}
