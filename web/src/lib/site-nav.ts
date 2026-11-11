// The one list of site sections, both levels. The header shows the sections;
// each section's pages show its `tabs` (SectionTabs), first tab the section's
// own page. Choices within one page (period, kind) are filters, not tabs.

export type NavTab = { href: string; label: string };

// `also`: detail pages that belong to the section without being a tab, lit in the header too.
export type NavLink = { href: string; label: string; short: string; tabs?: NavTab[]; also?: string[] };

// Grouped by what a reader looks at: the news (three groupings of the same
// articles, finest first, then the words in them), then the outlets: who they
// are, how they relate, who signs and how they write; last the full-screen
// board for a wall screen (live.observe.tw).
export const NAV_GROUPS: Array<{ label: string; links: NavLink[] }> = [
  {
    label: '看新聞',
    links: [
      {
        href: '/article/',
        label: '最新文章',
        short: '文章',
        tabs: [
          { href: '/article/', label: '最新文章' },
          { href: '/article/query/', label: '進階查詢' },
        ],
      },
      {
        href: '/event/',
        label: '事件表',
        short: '事件',
        tabs: [
          { href: '/event/', label: '事件表' },
          { href: '/tracking/', label: '長期觀察' },
        ],
      },
      {
        href: '/topic/',
        label: '議題表',
        short: '議題',
        tabs: [
          { href: '/topic/', label: '議題表' },
          { href: '/feature/', label: '專題' },
        ],
      },
      { href: '/ranking/', label: '關鍵字排行', short: '關鍵字' },
    ],
  },
  {
    label: '看媒體',
    links: [
      {
        href: '/media/',
        label: '媒體來源',
        short: '媒體',
        tabs: [
          { href: '/media/', label: '收錄概況' },
          { href: '/media/traffic/', label: '流量與排名' },
        ],
      },
      {
        href: '/similarity/',
        label: '媒體關係圖',
        short: '媒體關係',
        tabs: [
          { href: '/similarity/', label: '關係探索' },
          { href: '/similarity/sources/', label: '來源排行' },
          { href: '/similarity/reposts/', label: '轉載統計' },
          { href: '/similarity/about/', label: '擷取狀態' },
        ],
      },
      { href: '/byline/', label: '新聞署名', short: '署名', also: ['/journalist/'] },
      {
        href: '/writing/',
        label: '看寫法',
        short: '寫法',
        tabs: [
          { href: '/writing/', label: '轉述社群貼文' },
          { href: '/writing/titles/', label: '標題用詞' },
        ],
      },
    ],
  },
  {
    label: '看即時',
    links: [{ href: 'https://live.observe.tw/', label: '即時看板', short: '即時看板' }],
  },
];

// Sections reached from the footer or the account menu rather than the header.
const OTHER_SECTIONS: Array<{ label: string; tabs: NavTab[] }> = [
  {
    label: '資料蒐集',
    tabs: [
      { href: '/crawlers/', label: '新聞爬蟲' },
      { href: '/crawlers/traffic/', label: '流量資料' },
    ],
  },
  {
    label: 'API 文件與狀態',
    tabs: [
      { href: '/api/', label: 'API 文件' },
      { href: '/api/status/', label: 'API 狀態' },
    ],
  },
  {
    label: '我的新文易數',
    tabs: [
      { href: '/my/', label: '我的動態' },
      { href: '/my/following/', label: '追蹤清單' },
      { href: '/my/saved/', label: '收藏' },
      { href: '/my/reading/', label: '閱讀報告' },
      { href: '/my/settings/', label: '設定' },
    ],
  },
  {
    label: '管理後台',
    tabs: [
      { href: '/admin/', label: '讀者回報' },
      { href: '/admin/media/', label: '媒體設定' },
      { href: '/admin/tags/', label: '標籤管理' },
      { href: '/admin/accounts/', label: '帳號' },
      { href: '/admin/database/', label: '資料庫' },
    ],
  },
];

/** The section whose tabs include `href`, named as in the header. */
export function sectionOf(href: string): { label: string; tabs: NavTab[] } | undefined {
  const sections = [
    ...NAV_GROUPS.flatMap((group) => group.links).flatMap((link) => (link.tabs ? [{ label: link.label, tabs: link.tabs }] : [])),
    ...OTHER_SECTIONS,
  ];
  return sections.find((section) => section.tabs.some((tab) => tab.href === href));
}

export const METHOD_HREF = '/method/';
