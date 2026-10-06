import Link from 'next/link';
import { Suspense } from 'react';
import { API_ORIGIN } from '@/lib/api';
import { METHOD_HREF } from '@/lib/site-nav';
import BackToTop from './BackToTop';
import FooterMethod from './FooterMethod';
import InstallApp from './InstallApp';
import Wordmark from './Wordmark';

// The one footer for every page: this page's 資料來源與計算方式, then a full-width
// band with the brand, live collection numbers, channels and the link columns,
// then the rights line. Pages may add their own method notes (`notes`) after the
// blocks FooterMethod picks for them.

export { methodHeading } from './MethodNotes';

type FooterLink = { href: string; label: string; external?: boolean };
// Only what the header does not already link: its sections stay up there, and
// search has the header's box. Channels are the buttons under the brand.
const COLUMNS: Array<{ label: string; links: FooterLink[] }> = [
  {
    label: '資料與透明度',
    links: [
      { href: '/observe/', label: '網站觀測' },
      // The always-on wall-screen board; not in the header since it is not a reading page.
      { href: '/liveboard/', label: '即時看板' },
      { href: '/media/sources/', label: '媒體流量與收錄比較' },
      { href: '/media/crawlers/', label: '爬蟲資訊' },
      { href: METHOD_HREF, label: '資料來源與計算方式' },
    ],
  },
  {
    label: '開發與聯絡',
    links: [
      { href: '/api/', label: 'API 文件' },
      { href: 'https://github.com/skyhong2002/tag.observe.tw/issues/new', label: '聯絡與移除請求', external: true },
      { href: 'https://tag.analysis.tw', label: '母站 tag.analysis.tw', external: true },
    ],
  },
];

const link = 'inline-flex min-h-8 items-center py-0.5 hover:text-brand-700 hover:underline underline-offset-4 dark:hover:text-brand-400';
const pill =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 text-[13px] text-zinc-700 transition-colors hover:border-brand-600 hover:text-brand-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-brand-400 dark:hover:text-brand-400';
// The band reaches the viewport edges from inside the centred column without
// widening the page: a spread shadow in the band colour, clipped vertically.
const band =
  'bg-zinc-50 shadow-[0_0_0_100vmax_var(--color-zinc-50)] [clip-path:inset(0_-100vmax)] dark:bg-zinc-900 dark:shadow-[0_0_0_100vmax_var(--color-zinc-900)]';

const Icon = ({ d, fill = false }: { d: string; fill?: boolean }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="shrink-0"
    {...(fill ? { fill: 'currentColor' } : { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const })}
  >
    <path d={d} />
  </svg>
);
const ICONS = {
  telegram:
    'M21.5 4.2 2.9 11.4c-1.3.5-1.3 1.2-.2 1.6l4.8 1.5 1.8 5.6c.2.6.4.8.8.8.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8L22.9 5.6c.3-1.3-.5-1.9-1.4-1.4ZM8.3 14.2l9.9-6.2c.5-.3.9-.1.5.2l-8.5 7.7-.3 3.4-1.6-5.1Z',
  rss: 'M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14M6 19h.01',
  github:
    'M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 2.9.8.1-.7.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z',
  install: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
};

interface Totals {
  today: number;
  publishingMedia24h: number;
}

/** Today's collection, from the same numbers as 媒體來源; omitted when the API is slow or down. */
async function FooterStats() {
  const response = await fetch(`${API_ORIGIN}/api/v1/media-stats`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(4000) }).catch(
    () => null,
  );
  const totals: Totals | undefined = response?.ok ? (await response.json()).totals : undefined;
  if (!totals?.today) return null;
  return (
    <Link href="/media/" className="group inline-flex items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-400">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="group-hover:text-brand-700 group-hover:underline underline-offset-4 dark:group-hover:text-brand-400">
        今天已收錄 <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{totals.today.toLocaleString('zh-TW')}</span>{' '}
        篇 · 24 小時內 <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{totals.publishingMedia24h}</span>{' '}
        家媒體發稿
      </span>
    </Link>
  );
}

export default function SiteFooter({ notes }: { notes?: React.ReactNode }) {
  return (
    <footer className="mt-14 text-sm text-zinc-600 dark:text-zinc-400">
      <FooterMethod notes={notes} />

      <div className={`${band} mt-10 pt-12 pb-6`}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
          <div className="space-y-5">
            <Link href="/" aria-label="新文易數 首頁" className="inline-block text-zinc-900 dark:text-zinc-100">
              <Wordmark className="h-9 w-auto" />
            </Link>
            <div className="space-y-1.5">
              <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">同一件事，各家怎麼說。</p>
              <p className="leading-7">
                追蹤台灣新聞媒體的標籤、事件與議題，<span className="whitespace-nowrap">並排比較各家標題。</span>
              </p>
            </div>
            <div className="min-h-10 sm:min-h-5" data-vital-region="footer-stats">
              <Suspense fallback={null}>
                <FooterStats />
              </Suspense>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="https://t.me/tag_observe_tw" target="_blank" rel="noopener noreferrer" className={pill}>
                <Icon d={ICONS.telegram} fill />
                Telegram 討論群
              </a>
              <a href="/feeds/events.xml" className={pill}>
                <Icon d={ICONS.rss} />
                RSS
              </a>
              <a href="https://github.com/skyhong2002/tag.observe.tw" target="_blank" rel="noopener noreferrer" className={pill}>
                <Icon d={ICONS.github} fill />
                GitHub
              </a>
              <InstallApp className={pill}>
                <Icon d={ICONS.install} />
                安裝 Web App
              </InstallApp>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:max-w-md sm:gap-x-16 lg:max-w-none">
            {COLUMNS.map((col) => (
              <nav key={col.label} aria-label={col.label}>
                <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">{col.label}</h2>
                <ul className="space-y-0.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      {l.external ? (
                        <a href={l.href} target="_blank" rel="noopener noreferrer" className={link}>
                          {l.label}
                          <span aria-hidden="true" className="ml-0.5 text-zinc-400">
                            ↗
                          </span>
                        </a>
                      ) : (
                        <Link href={l.href} className={link}>
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-zinc-200 pt-5 text-xs leading-6 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <p>
            © 2026 新文易數 · 程式碼以{' '}
            <a
              href="https://github.com/skyhong2002/tag.observe.tw/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:text-brand-700 hover:underline dark:hover:text-brand-400"
            >
              MIT 授權
            </a>
            開源 · 新聞標題、摘要與圖片著作權屬各媒體
          </p>
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}
