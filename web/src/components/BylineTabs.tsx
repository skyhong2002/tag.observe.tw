import SectionTabs from '@/components/SectionTabs';
import { CREDIT_KINDS, CREDIT_LABELS, type CreditKind } from '@/lib/bylines';

export default function BylineTabs({
  current,
  hours = 48,
  q,
  media,
}: {
  current: CreditKind | 'all';
  hours?: number;
  q?: string;
  media?: string;
}) {
  const href = (kind: CreditKind | 'all') =>
    `/byline/?${new URLSearchParams({ hours: String(kind === 'person' ? Math.min(hours, 168) : hours), ...(kind !== 'person' ? { kind } : {}), ...(q ? { q } : {}), ...(media ? { media } : {}) })}`;
  return (
    <SectionTabs
      label="署名類型"
      tabs={[
        ...CREDIT_KINDS.map((kind) => ({
          href: href(kind),
          label: kind === 'person' ? '記者' : CREDIT_LABELS[kind],
          current: current === kind,
        })),
        { href: href('all'), label: '全部', current: current === 'all' },
      ]}
    />
  );
}
