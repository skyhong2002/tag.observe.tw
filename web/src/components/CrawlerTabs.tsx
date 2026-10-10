import SectionTabs from './SectionTabs';

/** 資料蒐集: how the site collects outside data — news crawlers, and Similarweb/Radar traffic fetches. */
export default function CrawlerTabs({ current }: { current: 'news' | 'traffic' }) {
  return (
    <SectionTabs
      label="資料蒐集"
      className="mb-5"
      tabs={[
        { key: 'news', href: '/crawlers/', label: '新聞爬蟲' },
        { key: 'traffic', href: '/crawlers/traffic/', label: '流量資料' },
      ].map((tab) => ({ ...tab, current: current === tab.key }))}
    />
  );
}
