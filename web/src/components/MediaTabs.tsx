import SectionTabs from './SectionTabs';

export default function MediaTabs({ current }: { current: 'media' | 'sources' | 'crawlers' }) {
  return (
    <SectionTabs
      label="媒體資料"
      className="mb-5"
      tabs={[
        { key: 'media', href: '/media/', label: '收錄概況' },
        { key: 'sources', href: '/media/sources/', label: 'Similar Web' },
        { key: 'crawlers', href: '/media/crawlers/', label: '爬蟲資訊' },
      ].map((tab) => ({ ...tab, current: current === tab.key }))}
    />
  );
}
