import Link from 'next/link';
import { METHOD_HREF, NAV_GROUPS } from '@/lib/site-nav';
import FooterMethod from './FooterMethod';
import InstallApp from './InstallApp';
import Wordmark from './Wordmark';

// The one footer for every page: this page's 資料來源與計算方式 first, then brand
// and link columns, then the copyright line. Pages may add their own method notes
// (`notes`) after the blocks FooterMethod picks for them.

export { methodHeading } from './MethodNotes';

// Four link columns: the header's sections (趨勢 and 新聞 share a column), then
// tools and about.
type FooterLink = { href: string; label: string; external?: boolean };
const [trend, news, media] = NAV_GROUPS;
const COLUMNS: Array<{ label: string; links: FooterLink[]; install?: boolean }> = [
  { label: '新聞', links: [...trend.links, ...news.links] },
  // The media comparison page only lives here.
  { label: '媒體', links: [media.links[0], { href: '/media/sources/', label: '媒體流量與收錄比較' }, ...media.links.slice(1)] },
  {
    label: '工具',
    links: [
      { href: '/search/', label: '搜尋報導' },
      { href: '/api/', label: 'API 文件' },
      { href: '/feeds/events.xml', label: '訂閱 RSS' },
    ],
    install: true,
  },
  {
    label: '關於',
    links: [
      { href: METHOD_HREF, label: '資料來源與計算方式' },
      { href: 'https://t.me/tag_observe_tw', label: 'Telegram 討論群', external: true },
      { href: 'https://github.com/skyhong2002/tag.observe.tw/issues/new', label: '聯絡與移除請求', external: true },
      { href: 'https://github.com/skyhong2002/tag.observe.tw', label: 'GitHub 原始碼', external: true },
      { href: 'https://tag.analysis.tw', label: '母站 tag.analysis.tw', external: true },
    ],
  },
];

const linkClass = 'hover:text-brand-700 hover:underline underline-offset-4 dark:hover:text-brand-400';

export default function SiteFooter({ notes }: { notes?: React.ReactNode }) {
  return (
    <footer className="mt-10 border-t border-zinc-300 pb-10 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
      <FooterMethod notes={notes} />

      <div className="grid gap-10 pt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        <div className="space-y-4">
          <Link href="/" aria-label="新文易數 首頁" className="inline-block text-zinc-900 dark:text-zinc-100">
            <Wordmark className="h-8 w-auto" />
          </Link>
          <p className="max-w-md text-sm leading-7 text-zinc-600 dark:text-zinc-400">
            同一件事，各家怎麼說。追蹤台灣新聞媒體的標籤、事件與議題，並排比較各家標題。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-8 text-sm sm:grid-cols-4 sm:gap-x-12">
          {COLUMNS.map((col) => (
            <nav key={col.label} aria-label={col.label}>
              <h2 className="mb-4 text-xs font-medium text-zinc-500 dark:text-zinc-500">{col.label}</h2>
              <ul className="space-y-4">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.href.startsWith('/') && !l.href.startsWith('/feeds/') ? (
                      <Link href={l.href} className={linkClass}>
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href} className={linkClass} {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                        {l.label}
                        {l.external && <span aria-hidden="true"> ↗</span>}
                      </a>
                    )}
                  </li>
                ))}
                {col.install && (
                  <li>
                    <InstallApp className={linkClass} />
                  </li>
                )}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
