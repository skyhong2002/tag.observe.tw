// The one list of site sections: the header shows `short` labels in groups,
// the footer columns show the full `label`.

export type NavLink = { href: string; label: string; short: string };

// Ordered by what a reader comes for: what is trending, then the news, then the outlets.
export const NAV_GROUPS: Array<{ label: string; links: NavLink[] }> = [
  {
    label: '看趨勢',
    links: [{ href: '/ranking/', label: '關鍵字排行', short: '關鍵字' }],
  },
  {
    label: '看新聞',
    links: [
      { href: '/event/', label: '事件表', short: '事件' },
      { href: '/topic/', label: '議題表', short: '議題' },
      { href: '/feature/', label: '專題', short: '專題' },
    ],
  },
  {
    label: '看媒體',
    links: [
      { href: '/media/', label: '媒體來源', short: '媒體' },
      { href: '/similarity/', label: '新聞關係圖', short: '關係圖' },
      { href: '/journalist/', label: '記者', short: '記者' },
    ],
  },
];

export const METHOD_HREF = '/method/';
