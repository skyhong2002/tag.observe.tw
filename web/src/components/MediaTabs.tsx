import SectionTabs from './SectionTabs';

export default function MediaTabs({ current }: { current: 'media' | 'traffic' }) {
  return (
    <SectionTabs
      label="媒體資料"
      className="mb-5"
      tabs={[
        { key: 'media', href: '/media/', label: '收錄概況' },
        { key: 'traffic', href: '/media/traffic/', label: '流量與排名' },
      ].map((tab) => ({ ...tab, current: current === tab.key }))}
    />
  );
}
