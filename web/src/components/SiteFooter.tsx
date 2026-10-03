import Link from 'next/link';
import InstallApp from './InstallApp';
import Wordmark from './Wordmark';

// The one footer for every page: 資料來源與計算方式 first, then brand and link columns.
// Pages may add their own method notes (`notes`) after the site-wide ones.

// Three link columns like 報導者's footer: site, data, subscribe.
type FooterLink = { href: string; label: string; external?: boolean };
const COLUMNS: Array<{ label: string; links: FooterLink[]; install?: boolean }> = [
  {
    label: '網站導覽',
    links: [
      { href: '/', label: '首頁' },
      { href: '/ranking/', label: '關鍵字排行' },
      { href: '/event/', label: '事件表' },
      { href: '/topic/', label: '議題表' },
      { href: '/media/', label: '媒體來源' },
      { href: '/media/sources/', label: '媒體流量與收錄比較' },
    ],
  },
  {
    label: '資料與開發',
    links: [
      { href: '/search/', label: '搜尋報導' },
      { href: '/api/', label: 'API 文件' },
      { href: '#method', label: '資料來源與計算方式' },
      { href: 'https://github.com/skyhong2002/tag.observe.tw', label: 'GitHub 原始碼', external: true },
      { href: 'https://tag.analysis.tw', label: '母站 tag.analysis.tw', external: true },
    ],
  },
  {
    label: '訂閱',
    links: [{ href: '/feeds/events.xml', label: '訂閱 RSS' }],
    install: true,
  },
];

const methodHeading = 'pt-2 text-[13px] font-semibold text-zinc-800 first:pt-0 dark:text-zinc-200';
const methodTerm = 'font-medium text-zinc-800 dark:text-zinc-200';
const inlineLink = 'text-brand-700 underline underline-offset-2 dark:text-brand-400';
const linkClass = 'hover:text-brand-700 hover:underline underline-offset-4 dark:hover:text-brand-400';

export default function SiteFooter({ notes }: { notes?: React.ReactNode }) {
  return (
    <footer className="mt-10 border-t border-zinc-300 pb-10 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
      <details className="group border-b border-zinc-200 dark:border-zinc-800">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[13px] hover:text-zinc-900 dark:hover:text-zinc-100 [&::-webkit-details-marker]:hidden">
          資料來源與計算方式
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
            className="shrink-0 transition-transform group-open:rotate-180"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        {/* The anchor sits inside <details> so /#method opens it (browsers reveal fragment targets). */}
        <div id="method" className="max-w-3xl scroll-mt-32 space-y-2.5 pb-5 leading-[1.9]">
          <h3 className={methodHeading}>資料來源</h3>
          <p>
            新聞媒體每 9 分鐘、其他媒體每小時抓取一次新文章，只保存標題、摘要、連結、圖片網址與標籤，不保存內文；收錄的媒體與抓取狀態見
            <Link href="/media/" className={inlineLink}>
              媒體來源
            </Link>
            。
          </p>
          <p>
            標籤是媒體自己在文章頁標記的關鍵字（news_keywords、keywords、article:tag
            等）。文章頁沒有標記時，才用其他媒體近期用過的標籤比對標題補上。
          </p>

          <h3 className={methodHeading}>關鍵字排行的指標</h3>
          <p>每 10 分鐘以過去 24 小時的文章重算一次。</p>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
            <dt className={methodTerm}>篇數</dt>
            <dd>過去 24 小時帶有這個標籤的文章數。</dd>
            <dt className={methodTerm}>媒體</dt>
            <dd>過去 24 小時用過這個標籤的媒體家數。</dd>
            <dt className={methodTerm}>分數</dt>
            <dd>
              同一家媒體的第 1 篇記 1 分，第 2、3、4 篇依序記 0.5、0.25、0.125
              分（避免單一媒體洗版）；各媒體加總後，除以固定基準名單的媒體數，再乘以
              50。名單內未發稿的媒體也保留在分母；新來源待下一版基準才納入。分數 50 大約等於「基準內每家媒體都報了一篇」。
            </dd>
            <dt className={methodTerm}>爆發力</dt>
            <dd>
              分數＋Σ（現在分數 − N 小時前分數）× 權重；N 為 3、6、12、24、48 小時，權重依序
              0.92、0.84、0.70、0.50、0.25，前後使用同一媒體基準。缺少可比較歷史或舊榜截斷而無法確認分數時顯示「—」，不當成零；持平的話題約等於分數，退燒中的話題會低於分數。排行榜上爆發力高於分數時以紅字標示。
            </dd>
            <dt className={methodTerm}>趨勢</dt>
            <dd>
              小圖以每小時等距顯示新聞篇數的 24 小時移動平均：當小時及前 23 小時收錄篇數加總除以 24。依「趨勢」排序時比較最新完整小時與 48
              小時前的平均值；點關鍵字可看每小時篇數與平均線。爆發力仍依上面的加權分數計算。
            </dd>
          </dl>

          <h3 className={methodHeading}>事件、議題與藍綠</h3>
          <p>事件每半小時依標籤共現分群，標題取自註明的媒體；議題表每小時收錄各媒體新推出的專題頁。</p>
          <p>
            本站基準名單的 29
            家媒體依來源試算表人工分類，其他既有媒體沿用原設定，新加入來源未另行標記政治傾向。全部新聞來源、抓取狀態與分類依據可於
            <Link href="/media/sources/#classification-method" className={inlineLink}>
              「媒體流量與收錄比較」
            </Link>
            查看；「未列藍綠」不代表中立。
          </p>
          {notes}
          <p>新聞內容著作權屬原媒體。本站提供報導索引、統計與保留期間內的文章文字；標示 ↗ 的連結會開啟外部網站。</p>
        </div>
      </details>

      <div className="grid gap-10 pt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        <div className="space-y-4">
          <Link href="/" aria-label="新文易數 首頁" className="inline-block text-zinc-900 dark:text-zinc-100">
            <Wordmark className="h-8 w-auto" />
          </Link>
          <p className="max-w-md text-sm leading-7 text-zinc-600 dark:text-zinc-400">
            同一件事，各家怎麼說。追蹤台灣新聞媒體的標籤、事件與議題，並排比較各家標題。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-8 text-sm sm:grid-cols-3 sm:gap-x-16">
          {COLUMNS.map((col) => (
            <nav key={col.label} aria-label={col.label}>
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
