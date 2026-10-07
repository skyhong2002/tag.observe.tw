import SectionTabs from './SectionTabs';

export default function ArticleTabs({ current }: { current: 'latest' | 'query' }) {
  return (
    <SectionTabs
      label="文章瀏覽"
      tabs={[
        { href: '/article/', label: '最新文章', current: current === 'latest' },
        { href: '/article/query/', label: '進階查詢', current: current === 'query' },
      ]}
    />
  );
}
