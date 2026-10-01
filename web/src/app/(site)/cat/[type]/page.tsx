import { permanentRedirect } from 'next/navigation';
// Legacy /cat/<type>/ (index.php?type=) now lives at /ranking/?category=<type>.
export default async function CatRedirect({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  permanentRedirect(`/ranking/?category=${encodeURIComponent(type)}`);
}
