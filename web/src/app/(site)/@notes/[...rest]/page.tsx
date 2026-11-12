import { sectionsFor } from '@/components/method/sections-for';

// Every page without notes of its own: the footer's method blocks for its path.
// Matching every other page also clears a previous page's notes on client navigation.
export default async function PathNotes({ params }: { params: Promise<{ rest: string[] }> }) {
  const { rest } = await params;
  return sectionsFor(`/${rest.join('/')}`);
}
