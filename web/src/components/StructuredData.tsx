import { jsonLd } from '@/lib/seo';

export default function StructuredData({ data }: { data: unknown }) {
  // Escape '<' so article titles and tags cannot terminate the JSON script.
  // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON is serialized with '<' escaped by jsonLd.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}
